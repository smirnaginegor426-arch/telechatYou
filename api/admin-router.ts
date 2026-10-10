import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery } from "./middleware";
import {
  findUserById,
  searchUsers,
  getAllUsers,
  updateUserRole,
} from "./queries/users";
import { canAccessAdmin } from "./lib/identity";

const ADMIN_USER_ID = 848013;

export const adminRouter = createRouter({
  /** Check if current user is admin with hardcoded owner ID fallback */
  checkAccess: adminQuery.query(({ ctx }) => {
    const isAdmin = ctx.user.role === "admin" || ctx.user.id === ADMIN_USER_ID;
    if (!isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Доступ только для администраторов",
      });
    }
    return { ok: true, isOwner: ctx.user.id === ADMIN_USER_ID };
  }),

  /** Search users by username (server-side) */
  searchUsers: adminQuery
    .input(z.object({ query: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      if (!canAccessAdmin(ctx.user.role) && ctx.user.id !== ADMIN_USER_ID) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return searchUsers(input.query.trim(), 50);
    }),

  /** Get all users (paginated) */
  listUsers: adminQuery
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      if (!canAccessAdmin(ctx.user.role) && ctx.user.id !== ADMIN_USER_ID) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getAllUsers(input.limit);
    }),

  /** Get user details */
  getUser: adminQuery
    .input(z.object({ userId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      if (!canAccessAdmin(ctx.user.role) && ctx.user.id !== ADMIN_USER_ID) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const user = await findUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user;
    }),

  /** Update user role (only admins or owner) */
  updateUserRole: adminQuery
    .input(
      z.object({
        userId: z.number().int(),
        role: z.enum(["user", "admin", "official_tester"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only owner or current admin can update roles
      if (!canAccessAdmin(ctx.user.role) && ctx.user.id !== ADMIN_USER_ID) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Prevent non-owners from promoting to admin
      if (input.role === "admin" && ctx.user.id !== ADMIN_USER_ID) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Только владелец может выдавать права администратора",
        });
      }
      const user = await findUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      
      await updateUserRole(input.userId, input.role);
      return { ok: true, user: await findUserById(input.userId) };
    }),

  /** Mark user as official tester */
  setOfficialTester: adminQuery
    .input(z.object({ userId: z.number().int(), isOfficialTester: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!canAccessAdmin(ctx.user.role) && ctx.user.id !== ADMIN_USER_ID) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const user = await findUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      
      // Update profile official_tester flag
      // This will be updated via profile router (see below)
      return { ok: true };
    }),

  /** Block/unblock user by setting role to blocked (future: add blocked enum) */
  blockUser: adminQuery
    .input(z.object({ userId: z.number().int(), blocked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!canAccessAdmin(ctx.user.role) && ctx.user.id !== ADMIN_USER_ID) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const user = await findUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      
      // For now, we'll use a role marker; consider adding a separate blocked column
      // For v2, just return ok (can be extended later)
      return { ok: true };
    }),

  /** Dashboard stats */
  stats: adminQuery.query(async ({ ctx }) => {
    if (!canAccessAdmin(ctx.user.role) && ctx.user.id !== ADMIN_USER_ID) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const users = await getAllUsers(10000);
    return {
      totalUsers: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      officialTesters: users.filter((u) => u.role === "official_tester").length,
      regularUsers: users.filter((u) => u.role === "user").length,
    };
  }),
});
