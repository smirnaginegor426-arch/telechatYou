import { createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

const INVITE_MAC_PREFIX = "tcy-invite:";

function inviteTag(chatId: number): string {
  return createHmac("sha256", env.sessionSecret)
    .update(INVITE_MAC_PREFIX + chatId)
    .digest("base64url")
    .slice(0, 12);
}

/**
 * Deterministic invite token for a chat: `${chatId}_${tag}`.
 * The tag is an HMAC of the chat id with the session secret, so links
 * cannot be forged without knowing the secret and no database column
 * is required.
 */
export function makeInviteToken(chatId: number): string {
  return `${chatId}_${inviteTag(chatId)}`;
}

/** Returns the chat id when the token is valid, otherwise null. */
export function readInviteToken(token: string): number | null {
  const separator = token.lastIndexOf("_");
  if (separator < 1 || separator === token.length - 1) return null;

  const chatId = Number(token.slice(0, separator));
  const tag = token.slice(separator + 1);
  if (!Number.isSafeInteger(chatId) || chatId <= 0 || tag.length === 0) return null;

  const expected = Buffer.from(inviteTag(chatId));
  const given = Buffer.from(tag);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return chatId;
}
