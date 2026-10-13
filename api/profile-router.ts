import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, ne } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { profiles, users } from "@db/schema";
import {
  ensureSettings,
  getProfileByUserId,
  getProfilesByIds,
  searchProfiles,
} from "./queries/telechat";

const usernameRe = /^[a-zA-Z0-9_]{3,32}$/;

export const profileRouter = createRouter({
  /** current user + messenger profile (null if onboarding not finished) */
  me: authedQuery.query(async ({ ctx }) => {
    const profile = await getProfileByUserId(ctx.user.id);
    return { user: ctx.user, profile };
  }),

  /** username availability */
  checkUsername: authedQuery
    .input(z.object({ username: z.string().regex(usernameRe) }))
    .query(async ({ ctx, input }) => {
      const taken = await getDb().query.profiles.findFirst({
        where: eq(profiles.username, input.username.toLowerCase()),
      });
      return { available: !taken || taken.userId === ctx.user.id };
    }),

  /** finish onboarding: create profile */
  setup: authedQuery
    .input(
      z.object({
        username: z.string().regex(usernameRe),
        displayName: z.string().min(1).max(64),
        bio: z.string().max(280).optional(),
        avatarKey: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const username = input.username.toLowerCase();
      const existing = await getProfileByUserId(ctx.user.id);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Профиль уже создан" });
      const taken = await getDb().query.profiles.findFirst({
        where: eq(profiles.username, username),
      });
      if (taken) throw new TRPCError({ code: "CONFLICT", message: "Этот username уже занят" });
      await getDb().insert(profiles).values({
        userId: ctx.user.id,
        username,
        displayName: input.displayName.trim(),
        bio: input.bio?.trim() ?? "",
        avatarKey: input.avatarKey,
      });
      await getDb()
        .update(users)
        .set({ name: input.displayName.trim() })
        .where(eq(users.id, ctx.user.id));
      await ensureSettings(ctx.user.id);
      return getProfileByUserId(ctx.user.id);
    }),

  update: authedQuery
    .input(
      z.object({
        displayName: z.string().min(1).max(64).optional(),
        bio: z.string().max(280).optional(),
        username: z.string().regex(usernameRe).optional(),
        avatarKey: z.string().max(255).nullable().optional(),
        bannerKey: z.string().max(255).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await getProfileByUserId(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      const patch: Partial<typeof profiles.$inferInsert> = {};
      if (input.displayName) patch.displayName = input.displayName.trim();
      if (input.bio !== undefined) patch.bio = input.bio.trim();
      if (input.avatarKey !== undefined) patch.avatarKey = input.avatarKey;
      if (input.bannerKey !== undefined) patch.bannerKey = input.bannerKey;
      if (input.username) {
        const username = input.username.toLowerCase();
        const taken = await getDb().query.profiles.findFirst({
          where: eq(profiles.username, username),
        });
        if (taken && taken.userId !== ctx.user.id)
          throw new TRPCError({ code: "CONFLICT", message: "Этот username уже занят" });
        patch.username = username;
      }
      await getDb().update(profiles).set(patch).where(eq(profiles.userId, ctx.user.id));
      return getProfileByUserId(ctx.user.id);
    }),

  /** heartbeat — keeps online status fresh */
  heartbeat: authedQuery.mutation(async ({ ctx }) => {
    await getDb()
      .update(profiles)
      .set({ lastSeenAt: new Date() })
      .where(eq(profiles.userId, ctx.user.id));
    return { ok: true };
  }),

  search: authedQuery
    .input(z.object({ query: z.string().min(1).max(64) }))
    .query(({ ctx, input }) => searchProfiles(input.query.trim(), ctx.user.id)),

  byId: authedQuery
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const p = await getProfileByUserId(input.userId);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      return p;
    }),

  byIds: authedQuery
    .input(z.object({ userIds: z.array(z.number()).max(100) }))
    .query(({ input }) => getProfilesByIds(input.userIds)),

  /** all known users except me (contacts directory) */
  directory: authedQuery.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(profiles)
      .where(ne(profiles.userId, ctx.user.id))
      .limit(200);
  }),
});
