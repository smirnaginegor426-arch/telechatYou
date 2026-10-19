import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { PublicUser } from "./lib/session";
import { authenticateRequest } from "./lib/session";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: PublicUser;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  // Invalid/expired sessions are returned as null by authenticateRequest. Do not
  // swallow database/driver failures here: that turns infrastructure errors into
  // misleading UNAUTHORIZED responses and hides the real failure from tRPC logs.
  ctx.user = (await authenticateRequest(opts.req.headers)) ?? undefined;
  return ctx;
}
