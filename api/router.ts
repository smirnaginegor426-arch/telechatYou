import { z } from "zod";
import { desc, eq, and, sql } from "drizzle-orm";
import { adminQuery, authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { channels, channelMembers, channelPosts, profiles, users } from "@db/schema";

const channelSchema = z.object({
  title: z.string().min(1).max(96),
  description: z.string().max(600).optional(),
  avatarKey: z.string().max(255).optional(),
});

export const channelsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb()
      .select()
      .from(channels)
      .where(and(eq(channels.deletedAt, null), eq(channels.ownerId, ctx.user.id)))
      .orderBy(desc(channels.createdAt));

    return rows;
  }),

  all: authedQuery.query(async () => {
    return getDb()
      .select()
      .from(channels)
      .where(eq(channels.deletedAt, null))
      .orderBy(desc(channels.createdAt))
      .limit(200);
  }),

  create: authedQuery
    .input(channelSchema)
    .mutation(async ({ ctx, input }) => {
      const channel = await getDb().insert(channels).values({
        ownerId: ctx.user.id,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        avatarKey: input.avatarKey,
        createdAt: new Date(),
      });

      const createdId = channel[0]?.insertId ?? 0;
      if (createdId) {
        await getDb().insert(channelMembers).values({
          channelId: Number(createdId),
          userId: ctx.user.id,
          role: "owner",
          joinedAt: new Date(),
        });
      }

      return { ok: true, channelId: Number(createdId) };
    }),

  subscribe: authedQuery
    .input(z.object({ channelId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await getDb().query.channels.findFirst({ where: eq(channels.id, input.channelId) });
      if (!channel || channel.deletedAt) throw new Error("Channel not found");

      const existing = await getDb().query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, input.channelId), eq(channelMembers.userId, ctx.user.id)),
      });

      if (existing) return { ok: true, subscribed: true };

      await getDb().insert(channelMembers).values({
        channelId: input.channelId,
        userId: ctx.user.id,
        role: "member",
        joinedAt: new Date(),
      });
      return { ok: true, subscribed: true };
    }),

  publish: authedQuery
    .input(
      z.object({
        channelId: z.number().int().positive(),
        body: z.string().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await getDb().query.channelMembers.findFirst({
        where: and(eq(channelMembers.channelId, input.channelId), eq(channelMembers.userId, ctx.user.id)),
      });
      if (!membership) throw new Error("Not subscribed to channel");

      await getDb().insert(channelPosts).values({
        channelId: input.channelId,
        authorId: ctx.user.id,
        body: input.body.trim(),
        createdAt: new Date(),
      });

      return { ok: true };
    }),

  members: authedQuery
    .input(z.object({ channelId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select()
        .from(channelMembers)
        .where(eq(channelMembers.channelId, input.channelId));

      const userIds = rows.map((row) => row.userId);
      if (!userIds.length) return [];

      const userRows = await getDb().select().from(users).where(sql`id IN (${userIds})`);
      const profileRows = await getDb().select().from(profiles).where(sql`userId IN (${userIds})`);
      return rows.map((row) => ({
        ...row,
        user: userRows.find((u) => u.id === row.userId) ?? null,
        profile: profileRows.find((p) => p.userId === row.userId) ?? null,
      }));
    }),

  deleteChannel: adminQuery
    .input(z.object({ channelId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(channels)
        .set({ deletedAt: new Date() })
        .where(eq(channels.id, input.channelId));
      return { ok: true };
    }),
});
