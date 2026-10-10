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
  try {
    ctx.user = (await authenticateRequest(opts.req.headers)) ?? undefined;
  } catch {
    // Authentication is optional for public procedures; DB errors surface on protected procedures.
  }
  return ctx;
}
