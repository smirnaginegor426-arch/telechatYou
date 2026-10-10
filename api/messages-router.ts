import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { chatMembers, messages, reactions } from "@db/schema";
import { getMembership, getProfilesByIds, searchMessages, touchChat } from "./queries/telechat";

const PAGE = 40;

async function hydrate(rows: (typeof messages.$inferSelect)[]) {
  if (!rows.length) return [];
  const senderIds = [...new Set(rows.map((m) => m.senderId))];
  const replyIds = [...new Set(rows.map((m) => m.replyToId).filter((x): x is number => !!x))];
  const msgIds = rows.map((m) => m.id);
  const [senders, replyRows, reactionRows] = await Promise.all([
    getProfilesByIds(senderIds),
    replyIds.length
      ? getDb().select().from(messages).where(inArray(messages.id, replyIds))
      : Promise.resolve([]),
    getDb().select().from(reactions).where(inArray(reactions.messageId, msgIds)),
  ]);
  const senderMap = new Map(senders.map((p) => [p.userId, p]));
  const replyMap = new Map(replyRows.map((r) => [r.id, r]));
  const replySenderIds = [...new Set(replyRows.map((r) => r.senderId))];
  const replySenders = await getProfilesByIds(replySenderIds);
  const replySenderMap = new Map(replySenders.map((p) => [p.userId, p]));
  const reactionMap = new Map<number, { emoji: string; userId: number }[]>();
  for (const r of reactionRows) {
    const arr = reactionMap.get(r.messageId) ?? [];
    arr.push({ emoji: r.emoji, userId: r.userId });
    reactionMap.set(r.messageId, arr);
  }
  return rows.map((m) => {
    const reply = m.replyToId ? replyMap.get(m.replyToId) : null;
    return {
      ...m,
      sender: senderMap.get(m.senderId) ?? null,
      replyTo: reply
        ? { ...reply, sender: replySenderMap.get(reply.senderId) ?? null }
        : null,
      reactions: reactionMap.get(m.id) ?? [],
    };
  });
}

export const messagesRouter = createRouter({
  /** paginated history, newest page first; pass beforeId for older */
  list: authedQuery
    .input(
      z.object({
        chatId: z.number(),
        beforeId: z.number().optional(),
        afterId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const me = await getMembership(input.chatId, ctx.user.id);
      if (!me) throw new TRPCError({ code: "FORBIDDEN" });
      const db = getDb();
      if (input.afterId) {
        const rows = await db
          .select()
          .from(messages)
          .where(and(eq(messages.chatId, input.chatId), sql`${messages.id} > ${input.afterId}`))
          .orderBy(asc(messages.id))
          .limit(100);
        return { items: await hydrate(rows), hasMore: false };
      }
      const cond = input.beforeId
        ? and(eq(messages.chatId, input.chatId), lt(messages.id, input.beforeId))
        : eq(messages.chatId, input.chatId);
      const rows = await db
        .select()
        .from(messages)
        .where(cond)
        .orderBy(desc(messages.id))
        .limit(PAGE + 1);
      const hasMore = rows.length > PAGE;
      const page = rows.slice(0, PAGE).reverse();
      return { items: await hydrate(page), hasMore };
    }),

  send: authedQuery
    .input(
      z.object({
        chatId: z.number(),
        kind: z.enum(["text", "image", "file", "voice"]).default("text"),
        body: z.string().max(8000).optional(),
        attachmentKey: z.string().max(255).optional(),
        attachmentName: z.string().max(255).optional(),
        attachmentSize: z.number().optional(),
        attachmentMime: z.string().max(128).optional(),
        voiceMeta: z.string().max(4000).optional(),
        replyToId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getMembership(input.chatId, ctx.user.id);
      if (!me) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.kind === "text" && !input.body?.trim())
        throw new TRPCError({ code: "BAD_REQUEST", message: "Пустое сообщение" });
      const [{ id }] = await getDb()
        .insert(messages)
        .values({
          chatId: input.chatId,
          senderId: ctx.user.id,
          kind: input.kind,
          body: input.body?.trim() || null,
          attachmentKey: input.attachmentKey,
          attachmentName: input.attachmentName,
          attachmentSize: input.attachmentSize,
          attachmentMime: input.attachmentMime,
          voiceMeta: input.voiceMeta,
          replyToId: input.replyToId,
        })
        .$returningId();
      await touchChat(input.chatId);
      // sender has obviously read up to own message
      await getDb()
        .update(chatMembers)
        .set({ lastReadMessageId: id })
        .where(
          and(eq(chatMembers.chatId, input.chatId), eq(chatMembers.userId, ctx.user.id)),
        );
      const row = await getDb().query.messages.findFirst({ where: eq(messages.id, id) });
      const [full] = await hydrate([row!]);
      return full;
    }),

  edit: authedQuery
    .input(z.object({ messageId: z.number(), body: z.string().min(1).max(8000) }))
    .mutation(async ({ ctx, input }) => {
      const msg = await getDb().query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!msg || msg.senderId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      if (msg.deletedAt)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Сообщение удалено" });
      if (msg.kind !== "text")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Можно редактировать только текст" });
      await getDb()
        .update(messages)
        .set({ body: input.body.trim(), editedAt: new Date() })
        .where(eq(messages.id, input.messageId));
      return { ok: true };
    }),

  remove: authedQuery
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await getDb().query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      const me = await getMembership(msg.chatId, ctx.user.id);
      const canDelete =
        msg.senderId === ctx.user.id || me?.role === "owner" || me?.role === "admin";
      if (!canDelete) throw new TRPCError({ code: "FORBIDDEN" });
      await getDb()
        .update(messages)
        .set({ deletedAt: new Date() })
        .where(eq(messages.id, input.messageId));
      return { ok: true };
    }),

  forward: authedQuery
    .input(z.object({ messageIds: z.array(z.number()).max(20), targetChatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const target = await getMembership(input.targetChatId, ctx.user.id);
      if (!target) throw new TRPCError({ code: "FORBIDDEN" });
      const source = await getDb()
        .select()
        .from(messages)
        .where(inArray(messages.id, input.messageIds));
      const senders = await getProfilesByIds([...new Set(source.map((m) => m.senderId))]);
      const nameMap = new Map(senders.map((p) => [p.userId, p.displayName]));
      for (const m of source.sort((a, b) => a.id - b.id)) {
        if (m.deletedAt || m.kind === "system") continue;
        const access = await getMembership(m.chatId, ctx.user.id);
        if (!access) continue;
        await getDb().insert(messages).values({
          chatId: input.targetChatId,
          senderId: ctx.user.id,
          kind: m.kind,
          body: m.body,
          attachmentKey: m.attachmentKey,
          attachmentName: m.attachmentName,
          attachmentSize: m.attachmentSize,
          attachmentMime: m.attachmentMime,
          voiceMeta: m.voiceMeta,
          forwardedFromName: nameMap.get(m.senderId) ?? "Неизвестный",
        });
      }
      await touchChat(input.targetChatId);
      return { ok: true };
    }),

  toggleReaction: authedQuery
    .input(z.object({ messageId: z.number(), emoji: z.string().min(1).max(16) }))
    .mutation(async ({ ctx, input }) => {
      const msg = await getDb().query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      const me = await getMembership(msg.chatId, ctx.user.id);
      if (!me) throw new TRPCError({ code: "FORBIDDEN" });
      const existing = await getDb().query.reactions.findFirst({
        where: and(
          eq(reactions.messageId, input.messageId),
          eq(reactions.userId, ctx.user.id),
          eq(reactions.emoji, input.emoji),
        ),
      });
      if (existing) {
        await getDb().delete(reactions).where(eq(reactions.id, existing.id));
        return { added: false };
      }
      await getDb()
        .insert(reactions)
        .values({ messageId: input.messageId, userId: ctx.user.id, emoji: input.emoji });
      return { added: true };
    }),

  search: authedQuery
    .input(z.object({ query: z.string().min(1).max(128) }))
    .query(async ({ ctx, input }) => {
      const rows = await searchMessages(ctx.user.id, input.query.trim());
      return hydrate(rows);
    }),
});
