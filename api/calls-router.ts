import { and, eq, gt, lt, ne, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { callSessions, callSignals, chats, userBlocks } from "@db/schema";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { getMembership, getProfilesByIds } from "./queries/telechat";

const RING_TIMEOUT_MS = 90_000;
const MAX_CALL_DURATION_MS = 4 * 60 * 60 * 1000;
const MAX_ICE_SIGNALS_PER_SENDER = 250;

function isStale(session: typeof callSessions.$inferSelect): boolean {
  const age = Date.now() - new Date(session.createdAt).getTime();
  return session.status === "ringing"
    ? age > RING_TIMEOUT_MS
    : session.status === "accepted" && age > MAX_CALL_DURATION_MS;
}

async function expireIfStale(session: typeof callSessions.$inferSelect) {
  if (!isStale(session)) return session;
  const status = session.status === "ringing" ? "missed" : "ended";
  await getDb().update(callSessions).set({ status, endedAt: new Date() }).where(eq(callSessions.id, session.id));
  return { ...session, status, endedAt: new Date() };
}

async function getParticipantSession(callId: number, chatId: number, userId: number) {
  const session = await getDb().query.callSessions.findFirst({
    where: and(eq(callSessions.id, callId), eq(callSessions.chatId, chatId)),
  });
  if (!session || (session.callerId !== userId && session.calleeId !== userId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Звонок не найден" });
  }
  return session;
}

const candidateSchema = z.object({
  candidate: z.string().max(4096),
  sdpMid: z.string().max(256).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(128).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional(),
});

export const callsRouter = createRouter({
  /** Find the latest active call visible to a member of this direct chat. */
  state: authedQuery
    .input(z.object({
      chatId: z.number().int().positive(),
      callId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!(await getMembership(input.chatId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к этому чату" });
      }

      const session = input.callId
        ? await getParticipantSession(input.callId, input.chatId, ctx.user.id)
        : await getDb().query.callSessions.findFirst({
            where: and(
              eq(callSessions.chatId, input.chatId),
              or(eq(callSessions.status, "ringing"), eq(callSessions.status, "accepted")),
            ),
            orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
          });

      if (!session) return null;
      if (session.callerId !== ctx.user.id && session.calleeId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Этот звонок предназначен не вам" });
      }

      const current = await expireIfStale(session);
      if (!input.callId && current.status !== "ringing" && current.status !== "accepted") return null;
      return {
        id: current.id,
        chatId: current.chatId,
        callerId: current.callerId,
        calleeId: current.calleeId,
        callType: current.callType,
        status: current.status,
        offerSdp: current.offerSdp,
        answerSdp: current.answerSdp,
        createdAt: current.createdAt,
      };
    }),

  /** A small global inbox check lets the UI show an incoming-call notice outside the chat screen. */
  incoming: authedQuery.query(async ({ ctx }) => {
    const session = await getDb().query.callSessions.findFirst({
      where: and(eq(callSessions.calleeId, ctx.user.id), eq(callSessions.status, "ringing")),
      orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
    });
    if (!session) return null;
    const current = await expireIfStale(session);
    if (current.status !== "ringing") return null;
    if (!(await getMembership(current.chatId, ctx.user.id))) return null;
    const caller = (await getProfilesByIds([current.callerId]))[0];
    return {
      id: current.id,
      chatId: current.chatId,
      callerId: current.callerId,
      callType: current.callType,
      callerName: caller?.displayName ?? caller?.username ?? "Пользователь",
    };
  }),

  /** Start a one-to-one call. Group and self-chats are intentionally unsupported in v1. */
  start: authedQuery
    .input(z.object({
      chatId: z.number().int().positive(),
      callType: z.enum(["audio", "video"]),
      offerSdp: z.string().min(20).max(50_000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (!(await getMembership(input.chatId, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к этому чату" });
      }
      const chat = await db.query.chats.findFirst({ where: eq(chats.id, input.chatId) });
      if (!chat || chat.type !== "direct" || !chat.directKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Звонки пока доступны только в личных чатах" });
      }
      const participants = chat.directKey.split(":").map(Number);
      const calleeId = participants.find((id) => id !== ctx.user.id);
      if (
        participants.length !== 2 ||
        !participants.includes(ctx.user.id) ||
        !calleeId ||
        !Number.isSafeInteger(calleeId) ||
        calleeId <= 0
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя позвонить в этот чат" });
      }

      const block = await db.select({ id: userBlocks.id }).from(userBlocks).where(or(
        and(eq(userBlocks.blockerId, ctx.user.id), eq(userBlocks.blockedId, calleeId)),
        and(eq(userBlocks.blockerId, calleeId), eq(userBlocks.blockedId, ctx.user.id)),
      )).limit(1);
      if (block.length) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Звонок недоступен из-за блокировки" });
      }

      const previous = await db.query.callSessions.findFirst({
        where: and(
          eq(callSessions.chatId, input.chatId),
          or(eq(callSessions.status, "ringing"), eq(callSessions.status, "accepted")),
        ),
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.createdAt)],
      });
      if (previous) {
        const current = await expireIfStale(previous);
        if (current.status === "ringing" || current.status === "accepted") {
          throw new TRPCError({ code: "CONFLICT", message: "В этом чате уже есть активный звонок" });
        }
      }

      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await db.delete(callSignals).where(lt(callSignals.createdAt, cutoff));
      await db.delete(callSessions).where(lt(callSessions.createdAt, cutoff));

      const [created] = await db.insert(callSessions).values({
        chatId: input.chatId,
        callerId: ctx.user.id,
        calleeId,
        callType: input.callType,
        status: "ringing",
        offerSdp: input.offerSdp,
      }).$returningId();
      return { callId: created.id };
    }),

  /** The recipient may accept only while an invitation is ringing. */
  accept: authedQuery
    .input(z.object({
      chatId: z.number().int().positive(),
      callId: z.number().int().positive(),
      answerSdp: z.string().min(20).max(50_000),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await getParticipantSession(input.callId, input.chatId, ctx.user.id);
      if (session.calleeId !== ctx.user.id || session.status !== "ringing") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нельзя принять этот звонок" });
      }
      if (isStale(session)) {
        await expireIfStale(session);
        throw new TRPCError({ code: "TIMEOUT", message: "Время ожидания вызова истекло" });
      }
      await getDb().update(callSessions).set({
        answerSdp: input.answerSdp,
        status: "accepted",
        updatedAt: new Date(),
      }).where(and(eq(callSessions.id, input.callId), eq(callSessions.status, "ringing")));
      return { ok: true };
    }),

  /** Send one trickle-ICE candidate; only the two call participants can write signals. */
  addIce: authedQuery
    .input(z.object({
      chatId: z.number().int().positive(),
      callId: z.number().int().positive(),
      candidate: candidateSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await getParticipantSession(input.callId, input.chatId, ctx.user.id);
      if (session.status !== "ringing" && session.status !== "accepted") {
        throw new TRPCError({ code: "CONFLICT", message: "Звонок уже завершён" });
      }
      const recent = await getDb().select({ id: callSignals.id }).from(callSignals).where(and(
        eq(callSignals.callId, input.callId),
        eq(callSignals.senderId, ctx.user.id),
      )).limit(MAX_ICE_SIGNALS_PER_SENDER + 1);
      if (recent.length >= MAX_ICE_SIGNALS_PER_SENDER) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Слишком много сетевых сигналов для звонка" });
      }
      await getDb().insert(callSignals).values({
        callId: input.callId,
        senderId: ctx.user.id,
        payload: JSON.stringify(input.candidate),
      });
      return { ok: true };
    }),

  /** Return only ICE candidates from the other participant, incrementally by row id. */
  signals: authedQuery
    .input(z.object({
      chatId: z.number().int().positive(),
      callId: z.number().int().positive(),
      afterId: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const session = await getParticipantSession(input.callId, input.chatId, ctx.user.id);
      if (session.status !== "ringing" && session.status !== "accepted") return [];
      const rows = await getDb().select().from(callSignals).where(and(
        eq(callSignals.callId, input.callId),
        ne(callSignals.senderId, ctx.user.id),
        gt(callSignals.id, input.afterId),
      )).orderBy(callSignals.id).limit(100);
      return rows.flatMap((row) => {
        try {
          const candidate: unknown = JSON.parse(row.payload);
          return candidate && typeof candidate === "object" && "candidate" in candidate
            ? [{ id: row.id, candidate: candidate as z.infer<typeof candidateSchema> }]
            : [];
        } catch {
          return [];
        }
      });
    }),

  /** Either participant can hang up; only the invited person can reject an incoming call. */
  end: authedQuery
    .input(z.object({
      chatId: z.number().int().positive(),
      callId: z.number().int().positive(),
      action: z.enum(["reject", "end"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await getParticipantSession(input.callId, input.chatId, ctx.user.id);
      if (input.action === "reject" && (session.calleeId !== ctx.user.id || session.status !== "ringing")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нельзя отклонить этот звонок" });
      }
      if (session.status === "ringing" || session.status === "accepted") {
        await getDb().update(callSessions).set({
          status: input.action === "reject" ? "rejected" : "ended",
          endedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(callSessions.id, input.callId));
      }
      return { ok: true };
    }),
});
