import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { adminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { profiles, users } from "@db/schema";

const userRoleSchema = z.enum(["user", "admin", "official_tester"]);
const verificationBadgeSchema = z.enum(["none", "verified", "official_tester"]);

export const adminRouter = createRouter({
  users: adminQuery.query(async () => {
    const rows = await getDb()
      .select({
        user: users,
        profile: profiles,
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .orderBy(desc(users.id))
      .limit(200);

    return rows.map(({ user, profile }) => ({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        lastSignInAt: user.lastSignInAt,
      },
      profile: profile
        ? {
            id: profile.id,
            userId: profile.userId,
            displayName: profile.displayName,
            username: profile.username,
            officialTester: profile.officialTester,
            verificationBadge: profile.verificationBadge,
            bio: profile.bio,
            avatarKey: profile.avatarKey,
          }
        : null,
    }));
  }),

  setRole: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: userRoleSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const target = await getDb().query.users.findFirst({ where: eq(users.id, input.userId) });
      if (!target) throw new Error("User not found");

      await getDb().update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      if (input.role === "official_tester") {
        await getDb()
          .update(profiles)
          .set({ officialTester: true, verificationBadge: "official_tester" })
          .where(eq(profiles.userId, input.userId));
      }
      if (input.role !== "official_tester") {
        await getDb()
          .update(profiles)
          .set({ officialTester: false })
          .where(eq(profiles.userId, input.userId));
      }

      return { ok: true };
    }),

  setOfficialTester: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        officialTester: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const target = await getDb().query.profiles.findFirst({ where: eq(profiles.userId, input.userId) });
      if (!target) throw new Error("Profile not found");

      await getDb()
        .update(profiles)
        .set({
          officialTester: input.officialTester,
          verificationBadge: input.officialTester ? "official_tester" : "none",
        })
        .where(eq(profiles.userId, input.userId));

      await getDb()
        .update(users)
        .set({ role: input.officialTester ? "official_tester" : "user" })
        .where(eq(users.id, input.userId));

      return { ok: true };
    }),

  setVerificationBadge: adminQuery
    .input(
      z.object({
        userId: z.number().int().positive(),
        badge: verificationBadgeSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const target = await getDb().query.profiles.findFirst({ where: eq(profiles.userId, input.userId) });
      if (!target) throw new Error("Profile not found");

      await getDb()
        .update(profiles)
        .set({ verificationBadge: input.badge })
        .where(eq(profiles.userId, input.userId));

      return { ok: true };
    }),
});
