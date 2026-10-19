import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import type { PublicUser } from "./lib/session";
import { isPrivateExperimentalTester } from "./lib/experimental-access";
import { getSessionCookieDiagnostics } from "./lib/session";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  const user = ctx.user;
  if (!user) {
    const url = new URL(ctx.req.url);
    console.warn(JSON.stringify({
      event: "auth.unauthorized",
      method: ctx.req.method,
      path: url.pathname,
      host: ctx.req.headers.get("host"),
      origin: ctx.req.headers.get("origin"),
      userAgent: ctx.req.headers.get("user-agent"),
      ...getSessionCookieDiagnostics(ctx.req.headers),
    }));
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Сессия не найдена или истекла. Войди в аккаунт снова.",
    });
  }

  // Supplying an explicitly narrowed local variable lets tRPC infer a
  // guaranteed authenticated user in every downstream procedure.
  return next({ ctx: { ...ctx, user: user as PublicUser } });
});

function requireRole(role: string) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    const user = ctx.user;
    if (!user || user.role !== role) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: user as PublicUser } });
  });
}

const requirePrivateTester = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const user = ctx.user;
  if (!user || !isPrivateExperimentalTester(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Эта экспериментальная функция доступна только в закрытом тестовом режиме.",
    });
  }
  return next({ ctx: { ...ctx, user: user as PublicUser } });
});

export const authedQuery = t.procedure.use(requireAuth);
/** Use this for backend procedures reserved for private experimental features. */
export const testerProcedure = authedQuery.use(requirePrivateTester);
export const adminQuery = authedQuery.use(requireRole("admin"));
