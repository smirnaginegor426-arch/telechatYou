import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, like, or, sql } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "@db/schema";

export const adminRouter = createRouter({
  stats: adminQuery.query(async () => {
    const db = getDb();

    const [total] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    const [admins] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "admin"));

    return {
      totalUsers: Number(total?.count ?? 0),
      totalAdmins: Number(admins?.count ?? 0),
    };
  }),

  users: createRouter({
    list: adminQuery
      .input(
        z.object({
          search: z.string().trim().max(64).optional().default(""),
          limit: z.number().int().min(1).max(100).optional().default(50),
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
          })
          .from(users)
          .where(condition)
          .orderBy(desc(users.id))
          .limit(input.limit);
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
          .select({ id: users.id, role: users.role })
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
  }),
});
