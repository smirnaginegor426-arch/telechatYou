import { z } from "zod";
import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { Session } from "@contracts/constants";
import { users, profiles } from "@db/schema";
import { getSessionCookieOptions } from "./lib/cookies";
import { env } from "./lib/env";
import { hashPassword, verifyPassword } from "./lib/password";
import {
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_RE,
  recoveryCodeMatches,
} from "./lib/recovery-code";
import { assertRateLimit } from "./lib/rate-limit";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { signSessionToken } from "./kimi/session";
import { getDb } from "./queries/connection";
import { getProfileByUserId } from "./queries/telechat";
import {
  bumpRecoveryAttempts,
  consumeRecoveryCode,
  createRecoveryCode,
  getActiveRecoveryCode,
  getCredentialByUserId,
  invalidateRecoveryCodes,
  upsertPasswordHash,
} from "./queries/credentials";

const MIN_PASSWORD = 8;
const MAX_CODE_ATTEMPTS = 5;
const CODE_TTL_MS = 15 * 60 * 1000;
const MINUTE = 60 * 1000;

const passwordSchema = z.string().min(MIN_PASSWORD, "Минимум 8 символов").max(128);
const usernameSchema = z.string().trim().toLowerCase().min(1).max(32);

/** Same message for "no such user" and "wrong password" — no account enumeration. */
const BAD_LOGIN = "Неверный username или пароль";
const BAD_CODE = "Код недействителен или истёк";

async function findProfileByUsername(username: string) {
  return getDb().query.profiles.findFirst({ where: eq(profiles.username, username) });
}

function setSessionCookie(
  ctx: { req: Request; resHeaders: Headers },
  token: string,
) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),

  /** Does this account have a password set? */
  passwordStatus: authedQuery.query(async ({ ctx }) => {
    const cred = await getCredentialByUserId(ctx.user.id);
    return { hasPassword: !!cred };
  }),

  /** Set or change the password. Changing requires the current password. */
  setPassword: authedQuery
    .input(
      z.object({
        newPassword: passwordSchema,
        currentPassword: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await getProfileByUserId(ctx.user.id);
      if (!profile)
        throw new TRPCError({ code: "FORBIDDEN", message: "Сначала создайте профиль" });

      const existing = await getCredentialByUserId(ctx.user.id);
      if (existing) {
        if (!input.currentPassword)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Введите текущий пароль" });
        const ok = await verifyPassword(input.currentPassword, existing.passwordHash);
        if (!ok)
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный текущий пароль" });
      }

      await upsertPasswordHash(ctx.user.id, await hashPassword(input.newPassword));
      // any open recovery code is no longer needed
      await invalidateRecoveryCodes(ctx.user.id);
      return { ok: true };
    }),

  /** Username + password sign-in. Sets the same session cookie as Kimi sign-in. */
  login: publicQuery
    .input(
      z.object({
        username: usernameSchema,
        password: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertRateLimit(`login:${input.username}`, 10, 15 * MINUTE);

      const profile = await findProfileByUsername(input.username);
      if (!profile) throw new TRPCError({ code: "UNAUTHORIZED", message: BAD_LOGIN });

      const cred = await getCredentialByUserId(profile.userId);
      if (!cred) throw new TRPCError({ code: "UNAUTHORIZED", message: BAD_LOGIN });

      const ok = await verifyPassword(input.password, cred.passwordHash);
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: BAD_LOGIN });

      const user = await getDb().query.users.findFirst({
        where: eq(users.id, profile.userId),
      });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: BAD_LOGIN });

      const token = await signSessionToken({ unionId: user.unionId, clientId: env.appId });
      setSessionCookie(ctx, token);
      return { ok: true };
    }),

  /**
   * Step 1 of password recovery: the user enters their username and receives
   * a one-time code. The code is returned once and is never shown again.
   */
  requestRecoveryCode: authedQuery
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ ctx, input }) => {
      assertRateLimit(`recover:${ctx.user.id}`, 5, 60 * MINUTE);

      const profile = await findProfileByUsername(input.username);
      if (!profile || profile.userId !== ctx.user.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Восстановление доступно только для вашего аккаунта. Войдите в свой аккаунт и попробуйте снова.",
        });

      await invalidateRecoveryCodes(profile.userId);
      const code = generateRecoveryCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MS);
      await createRecoveryCode(profile.userId, hashRecoveryCode(code), expiresAt);
      return { code, expiresAt: expiresAt.toISOString() };
    }),

  /**
   * Step 2: check the one-time code and set a new password.
   * The code is consumed atomically, so it cannot be used twice.
   */
  resetPassword: authedQuery
    .input(
      z.object({
        username: usernameSchema,
        code: z.string().max(40),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertRateLimit(`reset:${ctx.user.id}`, 20, 15 * MINUTE);

      const code = normalizeRecoveryCode(input.code);
      if (!RECOVERY_CODE_RE.test(code))
        throw new TRPCError({ code: "BAD_REQUEST", message: "Формат кода: AAA1-BBB1-CCCC1" });

      const profile = await findProfileByUsername(input.username);
      if (!profile || profile.userId !== ctx.user.id)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Можно восстановить только свой аккаунт.",
        });

      const active = await getActiveRecoveryCode(profile.userId);
      if (!active) throw new TRPCError({ code: "BAD_REQUEST", message: BAD_CODE });

      if (!recoveryCodeMatches(code, active.codeHash)) {
        await bumpRecoveryAttempts(active.id, active.attempts, MAX_CODE_ATTEMPTS);
        throw new TRPCError({ code: "BAD_REQUEST", message: "Неверный код" });
      }

      const consumed = await consumeRecoveryCode(active.id);
      if (!consumed) throw new TRPCError({ code: "BAD_REQUEST", message: BAD_CODE });

      await upsertPasswordHash(profile.userId, await hashPassword(input.newPassword));
      await invalidateRecoveryCodes(profile.userId);
      return { ok: true };
    }),
});
