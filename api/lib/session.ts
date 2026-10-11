import { createHmac, randomBytes } from "node:crypto";
import * as cookie from "cookie";
import { and, eq, gt, ne } from "drizzle-orm";
import { Session } from "@contracts/constants";
import { sessions, users, type User } from "@db/schema";
import { env } from "./env";
import { getDb } from "../queries/connection";

export type PublicUser = Omit<User, "passwordHash">;

type SessionMeta = { ip?: string | null; userAgent?: string | null };

function tokenHash(token: string): string {
  return createHmac("sha256", env.sessionSecret).update(token).digest("hex");
}

export function getSessionToken(headers: Headers): string | undefined {
  const parsed = cookie.parse(headers.get("cookie") ?? "");
  return parsed[Session.cookieName] || undefined;
}

export async function createSession(userId: number, meta: SessionMeta = {}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + Session.maxAgeMs);
  await getDb().insert(sessions).values({
    userId,
    export async function destroyUserSessionsExcept(
  userId: number,
  currentToken: string | undefined,
): Promise<void> {
  if (!currentToken) {
    await destroyUserSessions(userId);
    return;
  }

  await getDb()
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.tokenHash, tokenHash(currentToken)),
      ),
    );
}
    tokenHash: tokenHash(token),
    expiresAt,
    ip: meta.ip?.slice(0, 64) ?? null,
    userAgent: meta.userAgent?.slice(0, 512) ?? null,
  });
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null;
  const [session] = await getDb()
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;
  const [user] = await getDb().select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return null;
  delete (user as Partial<User>).passwordHash;
  return user as PublicUser;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
}

export async function destroyUserSessions(userId: number): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export async function authenticateRequest(headers: Headers): Promise<PublicUser | null> {
  return getSessionUser(getSessionToken(headers));
}
