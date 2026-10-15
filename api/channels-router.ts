import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, like } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { channels, chatMembers, chats, profiles } from "@db/schema";
import { getChatMembers, getMembership } from "./queries/telechat";

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

      return { chatId, username };
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
});
