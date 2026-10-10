import { and, desc, eq, gt, inArray, isNull, ne, or, like, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  chats,
  chatMembers,
  messages,
  profiles,
  reactions,
  settings,
  users,
} from "@db/schema";

const db = () => getDb();

// ---------- profiles ----------

export async function getProfileByUserId(userId: number) {
  return db().query.profiles.findFirst({ where: eq(profiles.userId, userId) });
}

export async function getProfilesByIds(ids: number[]) {
  if (!ids.length) return [];
  return db().select().from(profiles).where(inArray(profiles.userId, ids));
}

export async function ensureSettings(userId: number) {
  const existing = await db().query.settings.findFirst({
    where: eq(settings.userId, userId),
  });
  if (existing) return existing;
  await db().insert(settings).values({ userId });
  return (await db().query.settings.findFirst({
    where: eq(settings.userId, userId),
  }))!;
}

// ---------- chats ----------

export async function getMembership(chatId: number, userId: number) {
  return db().query.chatMembers.findFirst({
    where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)),
  });
}

export async function getChatMembers(chatId: number) {
  const rows = await db()
    .select()
    .from(chatMembers)
    .where(eq(chatMembers.chatId, chatId));
  const profs = await getProfilesByIds(rows.map((r) => r.userId));
  const byUser = new Map(profs.map((p) => [p.userId, p]));
  return rows.map((r) => ({ ...r, profile: byUser.get(r.userId) ?? null }));
}

export async function getLastMessage(chatId: number) {
  return db().query.messages.findFirst({
    where: and(eq(messages.chatId, chatId), isNull(messages.deletedAt)),
    orderBy: [desc(messages.id)],
  });
}

export async function getUnreadCount(
  chatId: number,
  userId: number,
  lastReadMessageId: number,
) {
  const [row] = await db()
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.chatId, chatId),
        gt(messages.id, lastReadMessageId),
        ne(messages.senderId, userId),
        isNull(messages.deletedAt),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function touchChat(chatId: number) {
  await db()
    .update(chats)
    .set({ lastMessageAt: new Date() })
    .where(eq(chats.id, chatId));
}

// ---------- search ----------

export async function searchProfiles(query: string, excludeUserId: number) {
  const q = `%${query}%`;
  return db()
    .select()
    .from(profiles)
    .where(
      and(
        ne(profiles.userId, excludeUserId),
        or(like(profiles.username, q), like(profiles.displayName, q)),
      ),
    )
    .limit(20);
}

export async function searchMessages(userId: number, query: string) {
  const memberships = await db()
    .select()
    .from(chatMembers)
    .where(eq(chatMembers.userId, userId));
  const chatIds = memberships.map((m) => m.chatId);
  if (!chatIds.length) return [];
  return db()
    .select()
    .from(messages)
    .where(
      and(
        inArray(messages.chatId, chatIds),
        isNull(messages.deletedAt),
        like(messages.body, `%${query}%`),
      ),
    )
    .orderBy(desc(messages.id))
    .limit(30);
}

export { users, chats, chatMembers, messages, profiles, reactions, settings };
