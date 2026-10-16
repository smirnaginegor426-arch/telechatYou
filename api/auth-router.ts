import * as cookie from "cookie";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
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
  destroyUserSessions,
} from "./lib/session";
import { hashPassword, verifyPassword } from "./lib/passwords";
import { and, desc, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { channels, emailVerificationCodes, profiles, recoveryCodes, recoverySecrets, users } from "@db/schema";
import { getDb } from "./queries/connection";
import { assertRateLimit, affectedRows } from "./lib/rate-limit";
import {
  generateRecoveryKey,
  hashRecoveryKey,
  normalizeRecoveryKey,
  recoveryKeyMatches,
  RECOVERY_KEY_RE,
} from "./lib/recovery-key";
import {
  generateRecoverySecret,
  hashRecoverySecret,
  recoverySecretMatches,
} from "./lib/recovery-secret";
import { createUser, findUserByUsername, touchLastSignIn } from "./queries/users";
import { env } from "./lib/env";
import { isEmailDeliveryConfigured, sendEmailCode } from "./lib/email-service";

const usernameSchema = z.string().trim().regex(/^[a-zA-Z0-9_]{3,32}$/, "Имя пользователя: 3–32 символа, латиница, цифры и _");
const passwordSchema = z.string().min(8, "Пароль должен содержать минимум 8 символов").max(128, "Пароль слишком длинный");
const accountSlotIdSchema = z.string().regex(/^[a-f0-9]{32}$/, "Некорректный идентификатор аккаунта");
const recoveryAccountIdSchema = z.number().int().min(1).max(2_147_483_647);
const RECOVERY_KEY_TTL_MS = 15 * 60 * 1000;
const RECOVERY_RATE_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const emailSchema = z.string().trim().email("Введи корректный адрес электронной почты.").max(320).transform((email) => email.toLowerCase());
const emailCodeSchema = z.string().regex(/^\d{6}$/, "Код должен состоять из 6 цифр.");

function createEmailCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashEmailCode(userId: number, email: string, purpose: "link" | "password_reset", code: string): string {
  return createHmac("sha256", env.sessionSecret)
    .update(`${userId}:${email}:${purpose}:${code}`)
    .digest("hex");
}

function emailCodeMatches(userId: number, email: string, purpose: "link" | "password_reset", code: string, storedHash: string): boolean {
  const expected = Buffer.from(hashEmailCode(userId, email, purpose, code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return expected.length === stored.length && timingSafeEqual(expected, stored);
}

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

  /** Email is considered linked only after its owner enters a fresh one-time code. */
  emailStatus: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb()
      .select({ email: users.email, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);
    const current = rows[0];
    return {
      email: current?.email ?? null,
      verifiedAt: current?.emailVerifiedAt ?? null,
      verified: Boolean(current?.email && current?.emailVerifiedAt),
      deliveryConfigured: isEmailDeliveryConfigured(),
    };
  }),

  requestEmailVerification: authedQuery
    .input(z.object({
      email: emailSchema,
      currentPassword: z.string().max(128).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email;
      const ip = requestIp(ctx.req);
      assertRateLimit(`email-link:ip:${ip}`, 10, RECOVERY_RATE_WINDOW_MS);
      assertRateLimit(`email-link:user:${ctx.user.id}`, 4, RECOVERY_RATE_WINDOW_MS);
      assertRateLimit(`email-link:address:${email}`, 4, RECOVERY_RATE_WINDOW_MS);

      const db = getDb();
      const rows = await db
        .select({ email: users.email, emailVerifiedAt: users.emailVerifiedAt, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      const current = rows[0];
      if (!current) throw new TRPCError({ code: "UNAUTHORIZED", message: "Войди в аккаунт снова." });

      if (current.email && current.email.toLowerCase() === email && current.emailVerifiedAt) {
        return { success: true, alreadyVerified: true };
      }

      if (current.emailVerifiedAt && current.email?.toLowerCase() !== email) {
        const passwordIsValid = Boolean(
          input.currentPassword &&
          current.passwordHash &&
          await verifyPassword(input.currentPassword, current.passwordHash),
        );
        if (!passwordIsValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Для смены уже подтверждённой почты введи текущий пароль.",
          });
        }
      }

      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (taken[0] && taken[0].id !== ctx.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Этот адрес уже привязан к другому аккаунту." });
      }
      if (!isEmailDeliveryConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Отправка писем ещё не настроена на сервере. Нужно подключить почтовый сервис.",
        });
      }

      await db.update(emailVerificationCodes)
        .set({ usedAt: new Date() })
        .where(and(
          eq(emailVerificationCodes.userId, ctx.user.id),
          eq(emailVerificationCodes.purpose, "link"),
          isNull(emailVerificationCodes.usedAt),
        ));

      const code = createEmailCode();
      const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
      await db.insert(emailVerificationCodes).values({
        userId: ctx.user.id,
        email,
        purpose: "link",
        codeHash: hashEmailCode(ctx.user.id, email, "link", code),
        expiresAt,
      });

      try {
        await sendEmailCode(email, code, "link");
      } catch {
        await db.update(emailVerificationCodes)
          .set({ usedAt: new Date() })
          .where(and(
            eq(emailVerificationCodes.userId, ctx.user.id),
            eq(emailVerificationCodes.email, email),
            eq(emailVerificationCodes.purpose, "link"),
            isNull(emailVerificationCodes.usedAt),
          ));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось отправить письмо. Попробуй ещё раз позже." });
      }

      return { success: true, alreadyVerified: false, expiresAt: expiresAt.toISOString() };
    }),

  verifyLinkedEmail: authedQuery
    .input(z.object({ code: emailCodeSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const now = new Date();
      const records = await db.select()
        .from(emailVerificationCodes)
        .where(and(
          eq(emailVerificationCodes.userId, ctx.user.id),
          eq(emailVerificationCodes.purpose, "link"),
          isNull(emailVerificationCodes.usedAt),
          gt(emailVerificationCodes.expiresAt, now),
          lt(emailVerificationCodes.attempts, EMAIL_CODE_MAX_ATTEMPTS),
        ))
        .orderBy(desc(emailVerificationCodes.id))
        .limit(1);
      const record = records[0];
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Код не найден или срок его действия истёк. Запроси новый." });
      }

      if (!emailCodeMatches(ctx.user.id, record.email, "link", input.code, record.codeHash)) {
        await db.update(emailVerificationCodes)
          .set({ attempts: sql`${emailVerificationCodes.attempts} + 1` })
          .where(and(
            eq(emailVerificationCodes.id, record.id),
            isNull(emailVerificationCodes.usedAt),
            lt(emailVerificationCodes.attempts, EMAIL_CODE_MAX_ATTEMPTS),
          ));
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Код неверный. Проверь письмо и попробуй ещё раз." });
      }

      const taken = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, record.email))
        .limit(1);
      if (taken[0] && taken[0].id !== ctx.user.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Этот адрес уже привязан к другому аккаунту." });
      }

      const consumed = await db.update(emailVerificationCodes)
        .set({ usedAt: new Date() })
        .where(and(
          eq(emailVerificationCodes.id, record.id),
          isNull(emailVerificationCodes.usedAt),
          gt(emailVerificationCodes.expiresAt, new Date()),
          lt(emailVerificationCodes.attempts, EMAIL_CODE_MAX_ATTEMPTS),
        ));
      if (affectedRows(consumed) !== 1) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Код уже использован или срок его действия истёк." });
      }

      const verifiedAt = new Date();
      await db.update(users)
        .set({ email: record.email, emailVerifiedAt: verifiedAt })
        .where(eq(users.id, ctx.user.id));
      return { success: true, email: record.email, verifiedAt: verifiedAt.toISOString() };
    }),

  /** Always return the same public response so the endpoint does not reveal whether an email is registered. */
  requestPasswordResetByEmail: publicQuery
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email;
      const ip = requestIp(ctx.req);
      assertRateLimit(`email-reset:ip:${ip}`, 8, RECOVERY_RATE_WINDOW_MS);
      assertRateLimit(`email-reset:address:${email}`, 5, RECOVERY_RATE_WINDOW_MS);

      const db = getDb();
      const rows = await db.select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.email, email), isNotNull(users.emailVerifiedAt)))
        .limit(1);
      const account = rows[0];
      if (!account || !isEmailDeliveryConfigured()) return { success: true };

      await db.update(emailVerificationCodes)
        .set({ usedAt: new Date() })
        .where(and(
          eq(emailVerificationCodes.userId, account.id),
          eq(emailVerificationCodes.purpose, "password_reset"),
          isNull(emailVerificationCodes.usedAt),
        ));

      const code = createEmailCode();
      await db.insert(emailVerificationCodes).values({
        userId: account.id,
        email,
        purpose: "password_reset",
        codeHash: hashEmailCode(account.id, email, "password_reset", code),
        expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS),
      });

      try {
        await sendEmailCode(email, code, "password_reset");
      } catch {
        await db.update(emailVerificationCodes)
          .set({ usedAt: new Date() })
          .where(and(
            eq(emailVerificationCodes.userId, account.id),
            eq(emailVerificationCodes.email, email),
            eq(emailVerificationCodes.purpose, "password_reset"),
            isNull(emailVerificationCodes.usedAt),
          ));
        // Deliberately keep the same response as for an unknown email.
      }
      return { success: true };
    }),

  resetPasswordWithEmailCode: publicQuery
    .input(z.object({
      email: emailSchema,
      code: emailCodeSchema,
      newPassword: passwordSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email;
      const ip = requestIp(ctx.req);
      assertRateLimit(`email-reset-verify:ip:${ip}`, 12, 15 * 60 * 1000);
      assertRateLimit(`email-reset-verify:address:${email}`, 8, 15 * 60 * 1000);

      const db = getDb();
      const accounts = await db.select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.email, email), isNotNull(users.emailVerifiedAt)))
        .limit(1);
      const account = accounts[0];
      if (!account) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Код неверный или срок его действия истёк." });
      }

      const records = await db.select()
        .from(emailVerificationCodes)
        .where(and(
          eq(emailVerificationCodes.userId, account.id),
          eq(emailVerificationCodes.email, email),
          eq(emailVerificationCodes.purpose, "password_reset"),
          isNull(emailVerificationCodes.usedAt),
          gt(emailVerificationCodes.expiresAt, new Date()),
          lt(emailVerificationCodes.attempts, EMAIL_CODE_MAX_ATTEMPTS),
        ))
        .orderBy(desc(emailVerificationCodes.id))
        .limit(1);
      const record = records[0];
      if (!record || !emailCodeMatches(account.id, email, "password_reset", input.code, record.codeHash)) {
        if (record) {
          await db.update(emailVerificationCodes)
            .set({ attempts: sql`${emailVerificationCodes.attempts} + 1` })
            .where(and(
              eq(emailVerificationCodes.id, record.id),
              isNull(emailVerificationCodes.usedAt),
              lt(emailVerificationCodes.attempts, EMAIL_CODE_MAX_ATTEMPTS),
            ));
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Код неверный или срок его действия истёк." });
      }

      const consumed = await db.update(emailVerificationCodes)
        .set({ usedAt: new Date() })
        .where(and(
          eq(emailVerificationCodes.id, record.id),
          isNull(emailVerificationCodes.usedAt),
          gt(emailVerificationCodes.expiresAt, new Date()),
          lt(emailVerificationCodes.attempts, EMAIL_CODE_MAX_ATTEMPTS),
        ));
      if (affectedRows(consumed) !== 1) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Код уже использован или срок его действия истёк." });
      }

      await db.update(users)
        .set({ passwordHash: await hashPassword(input.newPassword) })
        .where(eq(users.id, account.id));
      await destroyUserSessions(account.id);
      return { success: true };
    }),

  /** Public availability check for the account/profile username chosen during registration. */
  checkUsername: publicQuery
    .input(z.object({ username: usernameSchema }))
    .query(async ({ input }) => {
      const username = input.username.toLowerCase();
      const [account, profile, channel] = await Promise.all([
        findUserByUsername(username),
        getDb().query.profiles.findFirst({ where: eq(profiles.username, username) }),
        getDb().query.channels.findFirst({ where: eq(channels.username, username) }),
      ]);
      return { available: !account && !profile && !channel };
    }),

  register: publicQuery
    .input(z.object({ username: usernameSchema, password: passwordSchema, slotId: accountSlotIdSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const username = input.username.toLowerCase();
      const existing = await findUserByUsername(username);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Это имя пользователя уже занято" });
      const [existingProfile, existingChannel] = await Promise.all([
        getDb().query.profiles.findFirst({ where: eq(profiles.username, username) }),
        getDb().query.channels.findFirst({ where: eq(channels.username, username) }),
      ]);
      if (existingProfile || existingChannel) {
        throw new TRPCError({ code: "CONFLICT", message: "Этот юзернейм уже занят профилем или каналом" });
      }
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

  /** Status visible only to the signed-in owner. The secret itself can never be read back. */
  recoverySecretStatus: authedQuery.query(async ({ ctx }) => {
    const records = await getDb()
      .select({ id: recoverySecrets.id, updatedAt: recoverySecrets.updatedAt })
      .from(recoverySecrets)
      .where(eq(recoverySecrets.userId, ctx.user.id))
      .limit(1);
    return {
      configured: records.length > 0,
      updatedAt: records[0]?.updatedAt ?? null,
    };
  }),

  /** Create a random, high-entropy private recovery secret, shown to the user exactly once. */
  createRecoverySecret: authedQuery.mutation(async ({ ctx }) => {
    const existing = await getDb()
      .select({ id: recoverySecrets.id })
      .from(recoverySecrets)
      .where(eq(recoverySecrets.userId, ctx.user.id))
      .limit(1);
    if (existing.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Резервный секрет уже создан. Для замены подтверди текущий пароль.",
      });
    }

    const secret = generateRecoverySecret();
    await getDb().insert(recoverySecrets).values({
      userId: ctx.user.id,
      secretHash: hashRecoverySecret(secret),
    });
    return { secret };
  }),

  /** Rotate the private recovery secret only after confirming the current password. */
  rotateRecoverySecret: authedQuery
    .input(z.object({ currentPassword: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = await findUserByUsername(ctx.user.username);
      if (!currentUser?.passwordHash || !(await verifyPassword(input.currentPassword, currentUser.passwordHash))) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Текущий пароль неверен. Резервный секрет не изменён.",
        });
      }

      const existing = await getDb()
        .select({ id: recoverySecrets.id })
        .from(recoverySecrets)
        .where(eq(recoverySecrets.userId, ctx.user.id))
        .limit(1);
      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Сначала создай резервный секрет.",
        });
      }

      const secret = generateRecoverySecret();
      await getDb()
        .update(recoverySecrets)
        .set({ secretHash: hashRecoverySecret(secret), updatedAt: new Date() })
        .where(eq(recoverySecrets.userId, ctx.user.id));
      return { secret };
    }),

  /**
   * Issue a one-time sign-in key after checking the username and numeric account ID.
   * Only a hash is stored; the key expires after 15 minutes and older keys are invalidated.
   */
  requestRecoveryKey: publicQuery
    .input(z.object({
      username: usernameSchema,
      accountId: recoveryAccountIdSchema,
      recoverySecret: z.string().trim().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const username = input.username.toLowerCase();
      const ip = requestIp(ctx.req);
      assertRateLimit(`recovery-request:ip:${ip}`, 5, RECOVERY_RATE_WINDOW_MS);
      assertRateLimit(`recovery-request:user:${username}`, 3, RECOVERY_RATE_WINDOW_MS);

      const user = await findUserByUsername(username);
      const storedSecret = user
        ? await getDb().select().from(recoverySecrets)
            .where(eq(recoverySecrets.userId, user.id))
            .limit(1)
        : [];
      const isValidRecovery = !!user
        && user.id === input.accountId
        && recoverySecretMatches(input.recoverySecret, storedSecret[0]?.secretHash);
      if (!isValidRecovery) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Не удалось подтвердить аккаунт. Проверь username, ID и резервный секрет.",
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
