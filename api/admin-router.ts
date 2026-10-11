import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, like, or, sql } from "drizzle-orm";

import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { createUser, findUserByUsername } from "./queries/users";
import { hashPassword } from "./lib/passwords";
import {
  destroyUserSessions,
  destroyUserSessionsExcept,
  getSessionToken,
} from "./lib/session";
import { profiles, users } from "@db/schema";

const usernameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z0-9_]{3,32}$/,
    "Username должен содержать 3–32 символа: латиницу, цифры или _",
  );

const passwordSchema = z
  .string()
  .min(8, "Пароль должен содержать минимум 8 символов")
  .max(128, "Пароль слишком длинный");

export const adminRouter = createRouter({
  stats: adminQuery.query(async () => {
    const db = getDb();

    const [userCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const [adminCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "admin"));

    return {
      totalUsers: Number(userCount?.count ?? 0),
      totalAdmins: Number(adminCount?.count ?? 0),
    };
  }),

  users: createRouter({
    list: adminQuery
      .input(
        z.object({
          search: z.string().trim().max(64).optional().default(""),
          limit: z.number().int().min(1).max(100).optional().default(100),
        }),
      )
      .query(async ({ input }) => {
        const db = getDb();
        const search = input.search;

        const condition = search
          ? or(
              like(users.username, `%${search}%`),
              like(users.name, `%${search}%`),
              like(users.email, `%${search}%`),
            )
          : undefined;

        return db
          .select({
            id: users.id,
            username: users.username,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
            lastSignInAt: users.lastSignInAt,
            displayName: profiles.displayName,
            avatarKey: profiles.avatarKey,
          })
          .from(users)
          .leftJoin(profiles, eq(profiles.userId, users.id))
          .where(condition)
          .orderBy(desc(users.id))
          .limit(input.limit);
      }),

    create: adminQuery
      .input(
        z.object({
          username: usernameSchema,
          name: z.string().trim().min(1).max(255).optional(),
          password: passwordSchema,
        }),
      )
      .mutation(async ({ input }) => {
        const db = getDb();
        const username = input.username.toLowerCase();

        const existingUser = await findUserByUsername(username);

        const [existingProfile] = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.username, username))
          .limit(1);

        if (existingUser || existingProfile) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Такой username уже занят.",
          });
        }

        let user;

        try {
          user = await createUser({
            username,
            name: input.name?.trim() || username,
            passwordHash: await hashPassword(input.password),
          });
        } catch (error) {
          if (await findUserByUsername(username)) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Такой username уже занят.",
            });
          }

          throw error;
        }

        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Не удалось создать аккаунт.",
          });
        }

        return {
          id: user.id,
          username: user.username,
          role: user.role,
        };
      }),

    setRole: adminQuery
      .input(
        z.object({
          userId: z.number().int().positive(),
          role: z.enum(["user", "admin"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = getDb();

        if (ctx.user.id === input.userId && input.role === "user") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Нельзя снять права администратора с собственного аккаунта.",
          });
        }

        const [target] = await db
          .select({
            id: users.id,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);

        if (!target) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Пользователь не найден.",
          });
        }

        if (target.role === "admin" && input.role === "user") {
          const [adminCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(eq(users.role, "admin"));

          if (Number(adminCount?.count ?? 0) <= 1) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Нельзя снять права у последнего администратора.",
            });
          }
        }

        await db
          .update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId));

        return { ok: true };
      }),

    resetPassword: adminQuery
      .input(
        z.object({
          userId: z.number().int().positive(),
          newPassword: passwordSchema,
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = getDb();

        const [target] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);

        if (!target) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Пользователь не найден.",
          });
        }

        const passwordHash = await hashPassword(input.newPassword);

        await db
          .update(users)
          .set({ passwordHash })
          .where(eq(users.id, input.userId));

        if (ctx.user.id === input.userId) {
          const currentToken = getSessionToken(ctx.req.headers);
          await destroyUserSessionsExcept(input.userId, currentToken);
        } else {
          await destroyUserSessions(input.userId);
        }

        return { ok: true };
      }),
  }),
});
