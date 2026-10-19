import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { channels, chatMembers, chats, files, messages, profiles } from "@db/schema";

/**
 * Shared server-side authorization for uploaded objects.
 *
 * A file is readable by its owner, the members of a chat containing a live
 * message with that attachment, a member receiving a shared sticker-pack
 * manifest, a group member for the group's avatar, or a signed-in user for a
 * profile/public-channel avatar. Possessing a file key alone is not enough.
 */
export async function canReadFileKey(key: string, userId: number): Promise<boolean> {
  if (!key || key.length > 255 || key.startsWith("/") || key.includes("\\")) return false;

  const db = getDb();

  const owned = await db.query.files.findFirst({
    where: and(eq(files.key, key), eq(files.ownerId, userId)),
  });
  if (owned) return true;

  // Profile avatars are shown to signed-in users throughout the directory and chats.
  const profileAvatar = await db.query.profiles.findFirst({
    where: eq(profiles.avatarKey, key),
    columns: { id: true },
  });
  if (profileAvatar) return true;

  // Private message attachments require current chat membership.
  const messageAttachment = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(chatMembers, eq(chatMembers.chatId, messages.chatId))
    .where(and(
      eq(messages.attachmentKey, key),
      eq(chatMembers.userId, userId),
      isNull(messages.deletedAt),
    ))
    .limit(1);
  if (messageAttachment.length) return true;

  // Sticker packs may carry attachment keys in the manifest embedded in a message.
  // LOCATE treats the key literally (unlike LIKE, where user-controlled '_' and '%'
  // have wildcard meaning) and the membership check keeps unrelated packs private.
  const sharedSticker = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(chatMembers, eq(chatMembers.chatId, messages.chatId))
    .where(and(
      eq(chatMembers.userId, userId),
      isNull(messages.deletedAt),
      sql`LOCATE(${key}, ${messages.body}) > 0`,
    ))
    .limit(1);
  if (sharedSticker.length) return true;

  // Private group avatars are visible to members; public channel/group avatars are public to signed-in users.
  const groupAvatar = await db
    .select({ id: chats.id })
    .from(chats)
    .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
    .where(and(eq(chats.avatarKey, key), eq(chatMembers.userId, userId)))
    .limit(1);
  if (groupAvatar.length) return true;

  const publicAvatar = await db
    .select({ id: channels.id })
    .from(channels)
    .innerJoin(chats, eq(channels.chatId, chats.id))
    .where(and(eq(chats.avatarKey, key), eq(channels.isPublic, true)))
    .limit(1);
  return publicAvatar.length > 0;
}
