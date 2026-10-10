import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { createSession, destroySession, getSessionToken } from "./lib/session";
import { hashPassword, verifyPassword } from "./lib/passwords";
import { createUser, findUserByUsername, touchLastSignIn } from "./queries/users";

const usernameSchema = z.string().trim().regex(/^[a-zA-Z0-9_]{3,32}$/, "Имя пользователя: 3–32 символа, латиница, цифры и _");
const passwordSchema = z.string().min(8, "Пароль должен содержать минимум 8 символов").max(128, "Пароль слишком длинный");

function appendSessionCookie(ctx: { req: Request; resHeaders: Headers }, token: string) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append("set-cookie", cookie.serialize(Session.cookieName, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: opts.secure,
    maxAge: Session.maxAgeMs / 1000,
  }));
}

function clearSessionCookie(ctx: { req: Request; resHeaders: Headers }) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append("set-cookie", cookie.serialize(Session.cookieName, "", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: opts.secure,
    maxAge: 0,
    expires: new Date(0),
  }));
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
    .input(z.object({ username: usernameSchema, password: passwordSchema }))
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
      appendSessionCookie(ctx, token);
      return { success: true };
    }),

  login: publicQuery
    .input(z.object({ username: usernameSchema, password: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      const user = await findUserByUsername(input.username.toLowerCase());
      const ok = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;
      if (!user || !ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверное имя пользователя или пароль" });
      await destroySession(getSessionToken(ctx.req.headers));
      await touchLastSignIn(user.id);
      const token = await createSession(user.id, sessionMeta(ctx.req));
      appendSessionCookie(ctx, token);
      return { success: true };
    }),

  logout: publicQuery.mutation(async ({ ctx }) => {
    await destroySession(getSessionToken(ctx.req.headers));
    clearSessionCookie(ctx);
    return { success: true };
  }),
});
