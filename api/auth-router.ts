import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import {
  ACTIVE_ACCOUNT_COOKIE,
  accountCookieName,
  createSession,
  destroySession,
  getAccountSessionToken,
  getActiveAccountSlotId,
  getSessionToken,
  getSessionUser,
  isValidAccountSlotId,
} from "./lib/session";
import { hashPassword, verifyPassword } from "./lib/passwords";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { recoveryCodes } from "@db/schema";
import { getDb } from "./queries/connection";
import { assertRateLimit, affectedRows } from "./lib/rate-limit";
import {
  generateRecoveryKey,
  hashRecoveryKey,
  normalizeRecoveryKey,
  recoveryKeyMatches,
  RECOVERY_KEY_RE,
} from "./lib/recovery-key";
import { createUser, findUserByUsername, touchLastSignIn } from "./queries/users";

const usernameSchema = z.string().trim().regex(/^[a-zA-Z0-9_]{3,32}$/, "Имя пользователя: 3–32 символа, латиница, цифры и _");
const passwordSchema = z.string().min(8, "Пароль должен содержать минимум 8 символов").max(128, "Пароль слишком длинный");
const accountSlotIdSchema = z.string().regex(/^[a-f0-9]{32}$/, "Некорректный идентификатор аккаунта");
const recoveryAccountIdSchema = z.number().int().min(1).max(2_147_483_647);
const RECOVERY_KEY_TTL_MS = 15 * 60 * 1000;
const RECOVERY_RATE_WINDOW_MS = 60 * 60 * 1000;

function requestIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 64);
}

function appendCookie(
  ctx: { req: Request; resHeaders: Headers },
  name: string,
  value: string,
  maxAge = Session.maxAgeMs / 1000,
) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append("set-cookie", cookie.serialize(name, value, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: opts.secure,
    maxAge,
  }));
}

function clearCookie(ctx: { req: Request; resHeaders: Headers }, name: string) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append("set-cookie", cookie.serialize(name, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: opts.secure,
    maxAge: 0,
    expires: new Date(0),
  }));
}

function appendSessionCookie(
  ctx: { req: Request; resHeaders: Headers },
  token: string,
  slotId?: string,
) {
  if (!slotId) {
    appendCookie(ctx, Session.cookieName, token);
    return;
  }
  if (!isValidAccountSlotId(slotId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректный идентификатор аккаунта" });
  }
  appendCookie(ctx, accountCookieName(slotId), token);
  appendCookie(ctx, ACTIVE_ACCOUNT_COOKIE, slotId);
}

function activateAccountCookie(ctx: { req: Request; resHeaders: Headers }, slotId: string) {
  appendCookie(ctx, ACTIVE_ACCOUNT_COOKIE, slotId);
}

function clearSessionCookie(ctx: { req: Request; resHeaders: Headers }) {
  clearCookie(ctx, Session.cookieName);
}

function clearAccountCookie(ctx: { req: Request; resHeaders: Headers }, slotId: string) {
  clearCookie(ctx, accountCookieName(slotId));
}

function clearActiveAccountCookie(ctx: { req: Request; resHeaders: Headers }) {
  clearCookie(ctx, ACTIVE_ACCOUNT_COOKIE);
}
function sessionMeta(req: Request) {
  return {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  };
}

export const authRouter = createRouter({
  me: authedQuery.query(({ ctx }) => ctx.user),

  register: publicQuery
    .input(z.object({ username: usernameSchema, password: passwordSchema, slotId: accountSlotIdSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const username = input.username.toLowerCase();
      const existing = await findUserByUsername(username);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Это имя пользователя уже занято" });
      let user: Awaited<ReturnType<typeof createUser>>;
      try {
        user = await createUser({ username, passwordHash: await hashPassword(input.password), name: username });
      } catch (error) {
        // Covers the race where two requests choose the same username simultaneously.
        if (await findUserByUsername(username)) {
          throw new TRPCError({ code: "CONFLICT", message: "Это имя пользователя уже занято" });
        }
        throw error;
      }
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось создать аккаунт" });
      const token = await createSession(user.id, sessionMeta(ctx.req));
      appendSessionCookie(ctx, token, input.slotId);
      return { success: true };
    }),

  login: publicQuery
    .input(z.object({ username: usernameSchema, password: passwordSchema, slotId: accountSlotIdSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const user = await findUserByUsername(input.username.toLowerCase());
      const ok = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;
      if (!user || !ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверное имя пользователя или пароль" });
      // Keep the previous account session alive; each saved account has its own
      // HttpOnly cookie and can be selected again without signing in.
      await touchLastSignIn(user.id);
      const token = await createSession(user.id, sessionMeta(ctx.req));
      appendSessionCookie(ctx, token, input.slotId);
      return { success: true };
    }),

  /**
   * Issue a one-time sign-in key after checking the username and numeric account ID.
   * Only a hash is stored; the key expires after 15 minutes and older keys are invalidated.
   */
  requestRecoveryKey: publicQuery
    .input(z.object({
      username: usernameSchema,
      accountId: recoveryAccountIdSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const username = input.username.toLowerCase();
      const ip = requestIp(ctx.req);
      assertRateLimit(`recovery-request:ip:${ip}`, 5, RECOVERY_RATE_WINDOW_MS);
      assertRateLimit(`recovery-request:user:${username}`, 3, RECOVERY_RATE_WINDOW_MS);

      const user = await findUserByUsername(username);
      if (!user || user.id !== input.accountId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Не удалось подтвердить аккаунт. Проверь username и ID.",
        });
      }

      const db = getDb();
      await db
        .update(recoveryCodes)
        .set({ usedAt: new Date() })
        .where(and(eq(recoveryCodes.userId, user.id), isNull(recoveryCodes.usedAt)));

      const key = generateRecoveryKey();
      const expiresAt = new Date(Date.now() + RECOVERY_KEY_TTL_MS);
      await db.insert(recoveryCodes).values({
        userId: user.id,
        codeHash: hashRecoveryKey(key),
        expiresAt,
      });

      return { key, expiresAt: expiresAt.toISOString() };
    }),

  /**
   * Consume the key atomically and create a normal server session.
   * A key can be used only once, even when two login requests arrive together.
   */
  loginWithRecoveryKey: publicQuery
    .input(z.object({
      username: usernameSchema,
      accountId: recoveryAccountIdSchema,
      key: z.string().trim().min(1).max(80),
      slotId: accountSlotIdSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const username = input.username.toLowerCase();
      const ip = requestIp(ctx.req);
      assertRateLimit(`recovery-login:ip:${ip}`, 10, 15 * 60 * 1000);
      assertRateLimit(`recovery-login:user:${username}`, 5, 15 * 60 * 1000);

      const user = await findUserByUsername(username);
      const normalizedKey = normalizeRecoveryKey(input.key);
      if (!user || user.id !== input.accountId || !RECOVERY_KEY_RE.test(normalizedKey)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Ключ недействителен или срок его действия истёк.",
        });
      }

      const now = new Date();
      const activeCodes = await getDb()
        .select()
        .from(recoveryCodes)
        .where(and(
          eq(recoveryCodes.userId, user.id),
          isNull(recoveryCodes.usedAt),
          gt(recoveryCodes.expiresAt, now),
        ))
        .orderBy(desc(recoveryCodes.id))
        .limit(1);
      const activeCode = activeCodes[0];

      if (!activeCode || !recoveryKeyMatches(normalizedKey, activeCode.codeHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Ключ недействителен или срок его действия истёк.",
        });
      }

      const consumed = await getDb()
        .update(recoveryCodes)
        .set({ usedAt: new Date() })
        .where(and(
          eq(recoveryCodes.id, activeCode.id),
          isNull(recoveryCodes.usedAt),
          gt(recoveryCodes.expiresAt, new Date()),
        ));
      if (affectedRows(consumed) !== 1) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Ключ недействителен или срок его действия истёк.",
        });
      }

      await touchLastSignIn(user.id);
      const token = await createSession(user.id, sessionMeta(ctx.req));
      appendSessionCookie(ctx, token, input.slotId);
      return { success: true };
    }),

  saveCurrentAccount: publicQuery
    .input(z.object({ slotId: accountSlotIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const currentToken = getSessionToken(ctx.req.headers);
      const currentUser = await getSessionUser(currentToken);
      if (!currentToken || !currentUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Сеанс истёк. Войдите в аккаунт снова." });
      }

      const storedToken = getAccountSessionToken(ctx.req.headers, input.slotId);
      const storedUser = await getSessionUser(storedToken);
      if (storedUser && storedUser.id !== currentUser.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Этот слот уже используется другим аккаунтом." });
      }

      // Keep a unique server session per slot so that removing one account
      // cannot accidentally invalidate another account's session.
      const token = storedUser && storedToken
        ? storedToken
        : await createSession(currentUser.id, sessionMeta(ctx.req));
      appendSessionCookie(ctx, token, input.slotId);
      return { success: true };
    }),

  switchAccount: publicQuery
    .input(z.object({ slotId: accountSlotIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const token = getAccountSessionToken(ctx.req.headers, input.slotId);
      const user = await getSessionUser(token);
      if (!token || !user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Сеанс аккаунта истёк. Войдите в него снова." });
      }
      activateAccountCookie(ctx, input.slotId);
      return { success: true, username: user.username };
    }),

  removeAccount: publicQuery
    .input(z.object({ slotId: accountSlotIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const token = getAccountSessionToken(ctx.req.headers, input.slotId);
      if (token) await destroySession(token);
      clearAccountCookie(ctx, input.slotId);

      const wasActive = getActiveAccountSlotId(ctx.req.headers) === input.slotId;
      if (wasActive) {
        clearActiveAccountCookie(ctx);
        clearSessionCookie(ctx);
      }
      return { success: true, wasActive };
    }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    const activeSlotId = getActiveAccountSlotId(ctx.req.headers);
    await destroySession(getSessionToken(ctx.req.headers));
    if (activeSlotId) clearAccountCookie(ctx, activeSlotId);
    clearActiveAccountCookie(ctx);
    clearSessionCookie(ctx);
    return { success: true };
  }),
});
