import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull, like, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { channelPostComments, channels, chatMembers, chats, messages, profiles } from "@db/schema";
import { getChatMembers, getMembership, getProfilesByIds, touchChat } from "./queries/telechat";
import { makeInviteToken, readInviteToken } from "./lib/invite";

const channelUsername = z.string().trim().toLowerCase().min(3).max(32).regex(
  /^[a-z0-9_]+$/,
  "Username может содержать только латинские буквы, цифры и _",
);

export const channelsRouter = createRouter({
  /** Public directory; private channels are never exposed here. */
  directory: authedQuery
    .input(z.object({ query: z.string().trim().max(64).optional() }).optional())
    .query(async ({ input }) => {
      const query = input?.query?.trim().replace(/^@/, "");
      const isChannel = eq(channels.kind, "channel");
      const where = query
        ? and(eq(channels.isPublic, true), isChannel, like(channels.username, `%${query}%`))
        : and(eq(channels.isPublic, true), isChannel);
      const rows = await getDb()
        .select({ channel: channels, chat: chats })
        .from(channels)
        .innerJoin(chats, eq(channels.chatId, chats.id))
        .where(where)
        .orderBy(desc(channels.createdAt))
        .limit(100);

      return Promise.all(rows.map(async ({ channel, chat }) => ({
        chatId: chat.id,
        title: chat.title ?? "Канал",
        avatarKey: chat.avatarKey,
        description: channel.description,
        username: channel.username,
        isPublic: channel.isPublic,
        ownerId: channel.ownerId,
        membersCount: (await getChatMembers(chat.id)).length,
        createdAt: channel.createdAt,
      })));
    }),

  /** Resolve a public channel handle for links like https://telechatyou.app/@name. */
  byUsername: authedQuery
    .input(z.object({ username: channelUsername }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select({ channel: channels, chat: chats })
        .from(channels)
        .innerJoin(chats, eq(channels.chatId, chats.id))
        .where(and(eq(channels.username, input.username), eq(channels.isPublic, true)))
        .limit(1);
      const found = rows[0];
      if (!found || !found.channel.username) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Публичный канал не найден" });
      }

      return {
        chatId: found.chat.id,
        kind: found.channel.kind,
        title: found.chat.title ?? (found.channel.kind === "group" ? "Группа" : "Канал"),
        avatarKey: found.chat.avatarKey,
        description: found.channel.description,
        username: found.channel.username,
        membersCount: (await getChatMembers(found.chat.id)).length,
      };
    }),

  usernameAvailable: authedQuery
    .input(z.object({ username: z.string().trim().toLowerCase().max(32) }))
    .query(async ({ input }) => {
      const username = input.username;
      if (!/^[a-z0-9_]{3,32}$/.test(username)) {
        return { username, available: false };
      }
      const [existingChannel, existingProfile] = await Promise.all([
        getDb().query.channels.findFirst({ where: eq(channels.username, username) }),
        getDb().query.profiles.findFirst({ where: eq(profiles.username, username) }),
      ]);
      return { username, available: !existingChannel && !existingProfile };
    }),

  create: authedQuery
    .input(z.object({
      kind: z.enum(["channel", "group"]).default("channel"),
      title: z.string().trim().min(1).max(96),
      description: z.string().trim().max(280).default(""),
      avatarKey: z.string().max(255).optional(),
      isPublic: z.boolean(),
      username: z.string().trim().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let username: string | null = null;
      if (input.isPublic) {
        const parsed = channelUsername.safeParse(input.username ?? "");
        if (!parsed.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Для публичного ${input.kind === "group" ? "группы" : "канала"} укажите username от 3 до 32 символов: латиница, цифры и _`,
          });
        }
        username = parsed.data;
        const existing = await getDb().query.channels.findFirst({
          where: eq(channels.username, username),
        });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Этот username уже занят" });
        }
        const existingProfile = await getDb().query.profiles.findFirst({
          where: eq(profiles.username, username),
        });
        if (existingProfile) {
          throw new TRPCError({ code: "CONFLICT", message: "Этот username уже занят пользователем" });
        }
      }

      const [{ id: chatId }] = await getDb()
        .insert(chats)
        .values({
          type: "group",
          title: input.title,
          avatarKey: input.avatarKey,
          createdById: ctx.user.id,
        })
        .$returningId();

      await getDb().insert(chatMembers).values({
        chatId,
        userId: ctx.user.id,
        role: "owner",
      });

      try {
        await getDb().insert(channels).values({
          chatId,
          ownerId: ctx.user.id,
          kind: input.kind,
          username,
          description: input.description,
          isPublic: input.isPublic,
        });
      } catch (error) {
        // The unique index also protects against two users claiming a username simultaneously.
        const code = (error as { code?: string }).code;
        if (code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "Этот username уже занят" });
        }
        throw error;
      }

      return { chatId, username, inviteToken: input.isPublic ? null : makeInviteToken(chatId) };
    }),

  /** Update a group/channel profile. Only its owner (or a group admin) may edit it. */
  updateDetails: authedQuery
    .input(z.object({
      chatId: z.number(),
      title: z.string().trim().min(1).max(96),
      avatarKey: z.string().max(255).nullable().optional(),
      isPublic: z.boolean(),
      username: z.string().trim().toLowerCase().max(32).optional().nullable(),
      description: z.string().trim().max(280).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const community = await getDb().query.channels.findFirst({
        where: eq(channels.chatId, input.chatId),
      });
      if (!community) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Группа или канал не найдены" });
      }

      const member = await getMembership(input.chatId, ctx.user.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Недостаточно прав для редактирования" });
      }
      if (community.kind === "channel" && (member.role !== "owner" || community.ownerId !== ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Изменять настройки канала может только владелец" });
      }

      let username: string | null = null;
      if (input.isPublic) {
        const parsed = channelUsername.safeParse(input.username ?? community.username ?? "");
        if (!parsed.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Для публичного канала нужен username от 3 до 32 символов: латиница, цифры и _",
          });
        }
        username = parsed.data;
        const existing = await getDb().query.channels.findFirst({
          where: eq(channels.username, username),
        });
        if (existing && existing.chatId !== input.chatId) {
          throw new TRPCError({ code: "CONFLICT", message: "Этот username уже занят" });
        }
        const existingProfile = await getDb().query.profiles.findFirst({
          where: eq(profiles.username, username),
        });
        if (existingProfile) {
          throw new TRPCError({ code: "CONFLICT", message: "Этот username уже занят пользователем" });
        }
      }

      const chatPatch: { title: string; avatarKey?: string | null } = {
        title: input.title,
      };
      if (input.avatarKey !== undefined) chatPatch.avatarKey = input.avatarKey;
      await getDb().update(chats).set(chatPatch).where(eq(chats.id, input.chatId));
      await getDb().update(channels).set({
        isPublic: input.isPublic,
        username,
        ...(input.description !== undefined ? { description: input.description } : {}),
      }).where(eq(channels.chatId, input.chatId));
      await touchChat(input.chatId);

      return { ok: true, username, isPublic: input.isPublic };
    }),

  /** Counts comments attached to each channel post in the requested channel. */
  commentCounts: authedQuery
    .input(z.object({ chatId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getMembership(input.chatId, ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const channel = await getDb().query.channels.findFirst({
        where: and(eq(channels.chatId, input.chatId), eq(channels.kind, "channel")),
      });
      if (!channel || !channel.commentsEnabled) return [];
      const rows = await getDb()
        .select({
          postId: channelPostComments.postId,
          count: sql<number>`count(*)`,
        })
        .from(channelPostComments)
        .where(eq(channelPostComments.chatId, input.chatId))
        .groupBy(channelPostComments.postId);
      return rows.map((row) => ({ postId: row.postId, count: Number(row.count) }));
    }),

  /** List a post's discussion thread. Only members of channels with comments enabled may read it. */
  listComments: authedQuery
    .input(z.object({ chatId: z.number(), postId: z.number() }))
    .query(async ({ ctx, input }) => {
      const member = await getMembership(input.chatId, ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const channel = await getDb().query.channels.findFirst({
        where: and(eq(channels.chatId, input.chatId), eq(channels.kind, "channel")),
      });
      if (!channel || !channel.commentsEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Комментарии в этом канале отключены" });
      }
      const post = await getDb().query.messages.findFirst({
        where: and(
          eq(messages.id, input.postId),
          eq(messages.chatId, input.chatId),
          isNull(messages.deletedAt),
        ),
      });
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Публикация не найдена" });

      const rows = await getDb()
        .select()
        .from(channelPostComments)
        .where(and(
          eq(channelPostComments.chatId, input.chatId),
          eq(channelPostComments.postId, input.postId),
        ))
        .orderBy(asc(channelPostComments.id))
        .limit(300);
      const senderIds = [...new Set(rows.map((row) => row.senderId))];
      const senders = await getProfilesByIds(senderIds);
      const byId = new Map(senders.map((profile) => [profile.userId, profile]));
      return rows.map((row) => {
        const sender = byId.get(row.senderId);
        return {
          id: row.id,
          postId: row.postId,
          body: row.body,
          createdAt: row.createdAt,
          sender: sender ? {
            userId: sender.userId,
            username: sender.username,
            displayName: sender.displayName,
            avatarKey: sender.avatarKey,
          } : null,
        };
      });
    }),

  /** Add a text comment to a channel post; comments are stored outside the channel feed. */
  addComment: authedQuery
    .input(z.object({
      chatId: z.number(),
      postId: z.number(),
      body: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await getMembership(input.chatId, ctx.user.id);
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      const channel = await getDb().query.channels.findFirst({
        where: and(eq(channels.chatId, input.chatId), eq(channels.kind, "channel")),
      });
      if (!channel || !channel.commentsEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Комментарии в этом канале отключены" });
      }
      const post = await getDb().query.messages.findFirst({
        where: and(
          eq(messages.id, input.postId),
          eq(messages.chatId, input.chatId),
          isNull(messages.deletedAt),
        ),
      });
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Публикация не найдена" });

      await getDb().insert(channelPostComments).values({
        postId: input.postId,
        chatId: input.chatId,
        senderId: ctx.user.id,
        body: input.body,
      });
      return { ok: true };
    }),

  /** Public channels can be joined by username. Private channels need an invite from an owner/admin. */
  joinPublic: authedQuery
    .input(z.object({ username: channelUsername }))
    .mutation(async ({ ctx, input }) => {
      const channel = await getDb().query.channels.findFirst({
        where: and(eq(channels.username, input.username), eq(channels.isPublic, true)),
      });
      if (!channel) throw new TRPCError({ code: "NOT_FOUND", message: "Публичный канал не найден" });

      const existing = await getMembership(channel.chatId, ctx.user.id);
      if (existing) {
        await getDb()
          .update(chatMembers)
          .set({ cleared: false })
          .where(and(eq(chatMembers.chatId, channel.chatId), eq(chatMembers.userId, ctx.user.id)));
        return { chatId: channel.chatId, alreadyJoined: true };
      }

      await getDb().insert(chatMembers).values({
        chatId: channel.chatId,
        userId: ctx.user.id,
        role: "member",
      });
      return { chatId: channel.chatId, alreadyJoined: false };
    }),

  /** Resolve an invite link `${chatId}_${tag}` so a user can preview the chat. */
  invitePreview: authedQuery
    .input(z.object({ token: z.string().trim().min(6).max(72) }))
    .query(async ({ ctx, input }) => {
      const chatId = readInviteToken(input.token);
      if (!chatId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ссылка-приглашение недействительна" });
      }

      const rows = await getDb()
        .select({ channel: channels, chat: chats })
        .from(channels)
        .innerJoin(chats, eq(channels.chatId, chats.id))
        .where(eq(channels.chatId, chatId))
        .limit(1);
      const found = rows[0];
      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Канал недоступен" });
      }

      const membership = await getMembership(chatId, ctx.user.id);
      const joined = Boolean(membership) && membership?.cleared === false;

      return {
        chatId,
        kind: found.channel.kind,
        title: found.chat.title ?? (found.channel.kind === "group" ? "Группа" : "Канал"),
        avatarKey: found.chat.avatarKey,
        membersCount: (await getChatMembers(chatId)).length,
        joined,
      };
    }),

  /** Join a private/public chat through a valid invite link. */
  joinByInvite: authedQuery
    .input(z.object({ token: z.string().trim().min(6).max(72) }))
    .mutation(async ({ ctx, input }) => {
      const chatId = readInviteToken(input.token);
      if (!chatId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ссылка-приглашение недействительна" });
      }

      const channel = await getDb().query.channels.findFirst({ where: eq(channels.chatId, chatId) });
      if (!channel) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Канал недоступен" });
      }

      const existing = await getMembership(chatId, ctx.user.id);
      if (existing) {
        await getDb()
          .update(chatMembers)
          .set({ cleared: false })
          .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, ctx.user.id)));
        return { chatId, alreadyJoined: true };
      }

      await getDb().insert(chatMembers).values({
        chatId,
        userId: ctx.user.id,
        role: "member",
      });
      return { chatId, alreadyJoined: false };
    }),
});
