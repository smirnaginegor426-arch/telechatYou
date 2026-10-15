import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { channels, chatMembers, chats, messages, profiles, userBlocks } from "@db/schema";
import {
  getChatMembers,
  getLastMessage,
  getMembership,
  getProfilesByIds,
  getUnreadCount,
  touchChat,
} from "./queries/telechat";

const directKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join(":");

async function buildChatListItem(m: typeof chatMembers.$inferSelect, userId: number) {
  const chat = await getDb().query.chats.findFirst({ where: eq(chats.id, m.chatId) });
  if (!chat) return null;
  const lastMessage = await getLastMessage(chat.id);
  const unread = await getUnreadCount(chat.id, userId, m.lastReadMessageId);
  let peer: typeof profiles.$inferSelect | null = null;
  let membersCount = 0;
  if (chat.type === "direct") {
    const members = await getDb()
      .select()
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chat.id), ne(chatMembers.userId, userId)));
    if (members[0]) {
      peer = (await getProfilesByIds([members[0].userId]))[0] ?? null;
    }
  } else {
    const members = await getChatMembers(chat.id);
    membersCount = members.length;
  }
  const lastSender = lastMessage
    ? (await getProfilesByIds([lastMessage.senderId]))[0] ?? null
    : null;
  const selfKey = `${userId}:${userId}`;
  const isFavorites = chat.type === "direct" && chat.directKey === selfKey;
  if (isFavorites && !peer) peer = (await getProfilesByIds([userId]))[0] ?? null;
  const community = chat.type === "group"
    ? await getDb().query.channels.findFirst({ where: eq(channels.chatId, chat.id) }) ?? null
    : null;
  const channel = community?.kind === "channel" ? community : null;
  if (isFavorites && chat.title !== "Избранное") {
    await getDb().update(chats).set({ title: "Избранное" }).where(eq(chats.id, chat.id));
    chat.title = "Избранное";
  }
  return { chat, membership: m, lastMessage, lastSender, unread, peer, membersCount, channel };
}

export const chatsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const memberships = await getDb()
      .select()
      .from(chatMembers)
      .where(and(eq(chatMembers.userId, ctx.user.id), eq(chatMembers.cleared, false)));
    const items = (
      await Promise.all(memberships.map((m) => buildChatListItem(m, ctx.user.id)))
    ).filter((x): x is NonNullable<typeof x> => x !== null);
    items.sort((a, b) => {
      if (a.membership.pinned !== b.membership.pinned) return a.membership.pinned ? -1 : 1;
      return (
        new Date(b.chat.lastMessageAt).getTime() - new Date(a.chat.lastMessageAt).getTime()
      );
    });
    return items;
  }),

  ensureFavorites: authedQuery.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const key = directKey(userId, userId);
    const existing = await getDb().query.chats.findFirst({ where: eq(chats.directKey, key) });
    if (existing) {
      const membership = await getMembership(existing.id, userId);
      if (membership) {
        await getDb().update(chatMembers)
          .set({ cleared: false, pinned: true, archived: false })
          .where(and(eq(chatMembers.chatId, existing.id), eq(chatMembers.userId, userId)));
      } else {
        await getDb().insert(chatMembers).values({
          chatId: existing.id, userId, role: "member", pinned: true, cleared: false,
        });
      }
      await getDb().update(chats).set({ title: "Избранное" }).where(eq(chats.id, existing.id));
      return { chatId: existing.id };
    }

    const [{ id }] = await getDb().insert(chats).values({
      type: "direct",
      title: "Избранное",
      directKey: key,
      createdById: userId,
    }).$returningId();
    await getDb().insert(chatMembers).values({
      chatId: id, userId, role: "member", pinned: true,
    });
    return { chatId: id };
  }),

  createDirect: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя создать чат с собой" });
      const peer = (await getProfilesByIds([input.userId]))[0];
      if (!peer) throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
      const key = directKey(ctx.user.id, input.userId);
      const existing = await getDb().query.chats.findFirst({
        where: eq(chats.directKey, key),
      });
      if (existing) {
        // restore for current user if previously cleared
        await getDb()
          .update(chatMembers)
          .set({ cleared: false })
          .where(and(eq(chatMembers.chatId, existing.id), eq(chatMembers.userId, ctx.user.id)));
        return { chatId: existing.id };
      }
      const [{ id }] = await getDb()
        .insert(chats)
        .values({ type: "direct", directKey: key, createdById: ctx.user.id })
        .$returningId();
      await getDb().insert(chatMembers).values([
        { chatId: id, userId: ctx.user.id, role: "member" },
        { chatId: id, userId: input.userId, role: "member" },
      ]);
      return { chatId: id };
    }),

  createGroup: authedQuery
    .input(
      z.object({
        title: z.string().min(1).max(96),
        memberIds: z.array(z.number()).max(200).default([]),
        avatarKey: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [{ id }] = await getDb()
        .insert(chats)
        .values({
          type: "group",
          title: input.title.trim(),
          avatarKey: input.avatarKey,
          createdById: ctx.user.id,
        })
        .$returningId();
      const uniq = [...new Set(input.memberIds.filter((u) => u !== ctx.user.id))];
      await getDb()
        .insert(chatMembers)
        .values([
          { chatId: id, userId: ctx.user.id, role: "owner" },
          ...uniq.map((u) => ({ chatId: id, userId: u, role: "member" as const })),
        ]);
      await getDb().insert(messages).values({
        chatId: id,
        senderId: ctx.user.id,
        kind: "system",
        body: `Группа «${input.title.trim()}» создана`,
      });
      return { chatId: id };
    }),

  info: authedQuery
    .input(z.object({ chatId: z.number() }))
    .query(async ({ ctx, input }) => {
      const me = await getMembership(input.chatId, ctx.user.id);
      if (!me) throw new TRPCError({ code: "FORBIDDEN" });
      const chat = await getDb().query.chats.findFirst({
        where: eq(chats.id, input.chatId),
      });
      if (!chat) throw new TRPCError({ code: "NOT_FOUND" });
      const members = await getChatMembers(chat.id);
      const community = await getDb().query.channels.findFirst({
        where: eq(channels.chatId, chat.id),
      }) ?? null;
      const channel = community?.kind === "channel" ? community : null;
      const publicGroup = community?.kind === "group" ? community : null;
      let peer: typeof profiles.$inferSelect | null = null;
      if (chat.type === "direct") {
        const other = members.find((m) => m.userId !== ctx.user.id);
        if (other?.userId) peer = (await getProfilesByIds([other.userId]))[0] ?? null;
      }
      return { chat, members, me, peer, channel, publicGroup };
    }),

  blockStatus: authedQuery
    .input(z.object({ chatId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getMembership(input.chatId, ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const chat = await getDb().query.chats.findFirst({ where: eq(chats.id, input.chatId) });
      if (!chat) throw new TRPCError({ code: "NOT_FOUND" });
      if (chat.type !== "direct" || !chat.directKey) return { blocked: false, peerId: null };
      const participants = chat.directKey.split(":").map(Number);
      const peerId = participants.find((id) => id !== ctx.user.id) ?? null;
      if (!peerId || !Number.isSafeInteger(peerId) || peerId <= 0) return { blocked: false, peerId: null };
      const existing = await getDb().query.userBlocks.findFirst({
        where: and(eq(userBlocks.blockerId, ctx.user.id), eq(userBlocks.blockedId, peerId)),
      });
      return { blocked: !!existing, peerId };
    }),

  blockUser: authedQuery
    .input(z.object({ chatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getMembership(input.chatId, ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const chat = await getDb().query.chats.findFirst({ where: eq(chats.id, input.chatId) });
      if (!chat || chat.type !== "direct" || !chat.directKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Блокировка доступна только в личном чате" });
      }
      const peerId = chat.directKey.split(":").map(Number).find((id) => id !== ctx.user.id);
      if (!peerId || !Number.isSafeInteger(peerId) || peerId <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя заблокировать этот чат" });
      }
      await getDb().insert(userBlocks).values({ blockerId: ctx.user.id, blockedId: peerId })
        .onDuplicateKeyUpdate({ set: { blockerId: ctx.user.id } });
      return { ok: true, peerId };
    }),

  unblockUser: authedQuery
    .input(z.object({ chatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const member = await getMembership(input.chatId, ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const chat = await getDb().query.chats.findFirst({ where: eq(chats.id, input.chatId) });
      if (!chat || chat.type !== "direct" || !chat.directKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Это не личный чат" });
      }
      const peerId = chat.directKey.split(":").map(Number).find((id) => id !== ctx.user.id);
      if (!peerId || !Number.isSafeInteger(peerId) || peerId <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя разблокировать этот чат" });
      }
      await getDb().delete(userBlocks).where(and(
        eq(userBlocks.blockerId, ctx.user.id),
        eq(userBlocks.blockedId, peerId),
      ));
      return { ok: true, peerId };
    }),

  updateGroup: authedQuery
    .input(
      z.object({
        chatId: z.number(),
        title: z.string().min(1).max(96).optional(),
        avatarKey: z.string().max(255).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getMembership(input.chatId, ctx.user.id);
      if (!me || (me.role !== "owner" && me.role !== "admin"))
        throw new TRPCError({ code: "FORBIDDEN" });
      const patch: Partial<typeof chats.$inferInsert> = {};
      if (input.title) patch.title = input.title.trim();
      if (input.avatarKey !== undefined) patch.avatarKey = input.avatarKey;
      await getDb().update(chats).set(patch).where(eq(chats.id, input.chatId));
      await touchChat(input.chatId);
      return { ok: true };
    }),

  addMembers: authedQuery
    .input(z.object({ chatId: z.number(), memberIds: z.array(z.number()).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const me = await getMembership(input.chatId, ctx.user.id);
      if (!me) throw new TRPCError({ code: "FORBIDDEN" });
      const chat = await getDb().query.chats.findFirst({
        where: eq(chats.id, input.chatId),
      });
      if (!chat || chat.type !== "group")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Не группа" });
      const channel = await getDb().query.channels.findFirst({
        where: eq(channels.chatId, input.chatId),
      });
      if (channel && channel.kind === "channel" && me.role !== "owner" && me.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Добавлять участников в канал может только владелец или администратор" });
      }
      const existing = await getChatMembers(input.chatId);
      const existingIds = new Set(existing.map((m) => m.userId));
      const fresh = input.memberIds.filter((u) => !existingIds.has(u));
      if (fresh.length) {
        await getDb()
          .insert(chatMembers)
          .values(fresh.map((u) => ({ chatId: input.chatId, userId: u, role: "member" as const })));
        if (!channel || channel.kind === "group") {
          const profs = await getProfilesByIds(fresh);
          const meProfile = (await getProfilesByIds([ctx.user.id]))[0];
          await getDb().insert(messages).values({
            chatId: input.chatId,
            senderId: ctx.user.id,
            kind: "system",
            body: `${meProfile?.displayName ?? "Пользователь"} добавил(а): ${profs
              .map((p) => p.displayName)
              .join(", ")}`,
          });
        }
        await touchChat(input.chatId);
      }
      return { added: fresh.length };
    }),

  setChannelAdmin: authedQuery
    .input(z.object({ chatId: z.number(), userId: z.number(), isAdmin: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await getDb().query.channels.findFirst({
        where: eq(channels.chatId, input.chatId),
      });
      if (!channel || channel.kind !== "channel") throw new TRPCError({ code: "BAD_REQUEST", message: "Это не канал" });
      const actor = await getMembership(input.chatId, ctx.user.id);
      if (!actor || actor.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только владелец канала может менять администраторов" });
      }
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя менять собственную роль владельца" });
      }
      const target = await getMembership(input.chatId, input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Подписчик не найден" });
      if (target.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя менять роль владельца канала" });
      }
      await getDb()
        .update(chatMembers)
        .set({ role: input.isAdmin ? "admin" : "member" })
        .where(and(eq(chatMembers.chatId, input.chatId), eq(chatMembers.userId, input.userId)));
      await touchChat(input.chatId);
      return { ok: true };
    }),

  removeChannelMember: authedQuery
    .input(z.object({ chatId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await getDb().query.channels.findFirst({
        where: eq(channels.chatId, input.chatId),
      });
      if (!channel) throw new TRPCError({ code: "BAD_REQUEST", message: "Это не канал" });
      const actor = await getMembership(input.chatId, ctx.user.id);
      if (!actor || (actor.role !== "owner" && actor.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Недостаточно прав для удаления подписчика" });
      }
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя удалить самого себя этой командой" });
      }
      const target = await getMembership(input.chatId, input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Подписчик не найден" });
      if (target.role === "owner" || (actor.role === "admin" && target.role === "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Нельзя удалить владельца или администратора с такими же правами" });
      }
      await getDb()
        .delete(chatMembers)
        .where(and(eq(chatMembers.chatId, input.chatId), eq(chatMembers.userId, input.userId)));
      await touchChat(input.chatId);
      return { ok: true };
    }),

  setFlags: authedQuery
    .input(
      z.object({
        chatId: z.number(),
        pinned: z.boolean().optional(),
        muted: z.boolean().optional(),
        archived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const me = await getMembership(input.chatId, ctx.user.id);
      if (!me) throw new TRPCError({ code: "FORBIDDEN" });
      const patch: Partial<typeof chatMembers.$inferInsert> = {};
      if (input.pinned !== undefined) patch.pinned = input.pinned;
      if (input.muted !== undefined) patch.muted = input.muted;
      if (input.archived !== undefined) {
        patch.archived = input.archived;
        if (input.archived) patch.pinned = false;
      }
      await getDb()
        .update(chatMembers)
        .set(patch)
        .where(and(eq(chatMembers.chatId, input.chatId), eq(chatMembers.userId, ctx.user.id)));
      return { ok: true };
    }),

  /** hide chat from own list (direct: keep row; group: leave if requested) */
  remove: authedQuery
    .input(z.object({ chatId: z.number(), leave: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const me = await getMembership(input.chatId, ctx.user.id);
      if (!me) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.leave) {
        await getDb()
          .delete(chatMembers)
          .where(and(eq(chatMembers.chatId, input.chatId), eq(chatMembers.userId, ctx.user.id)));
      } else {
        await getDb()
          .update(chatMembers)
          .set({ cleared: true, pinned: false, archived: false })
          .where(and(eq(chatMembers.chatId, input.chatId), eq(chatMembers.userId, ctx.user.id)));
      }
      return { ok: true };
    }),

  markRead: authedQuery
    .input(z.object({ chatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const me = await getMembership(input.chatId, ctx.user.id);
      if (!me) throw new TRPCError({ code: "FORBIDDEN" });
      const last = await getLastMessage(input.chatId);
      await getDb()
        .update(chatMembers)
        .set({ lastReadMessageId: last?.id ?? 0 })
        .where(and(eq(chatMembers.chatId, input.chatId), eq(chatMembers.userId, ctx.user.id)));
      return { ok: true };
    }),
});
