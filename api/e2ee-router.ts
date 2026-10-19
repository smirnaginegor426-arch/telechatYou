import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { chatMembers, e2eeDevices, e2eeOneTimeKeys, e2eeToDeviceEvents } from "@db/schema";
import { assertRateLimit, affectedRows } from "./lib/rate-limit";

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const KEY_ID_RE = /^[A-Za-z0-9._-]{1,64}:[A-Za-z0-9_+\/=.-]{1,160}$/;
const deviceIdSchema = z.string().regex(DEVICE_ID_RE, "Некорректный идентификатор устройства");

const publicJsonObject = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 100_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "JSON-объект слишком большой" });
    }
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректный JSON-объект" });
  }
});

const keyMapSchema = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  const entries = Object.entries(value);
  if (entries.length > 200) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Слишком много ключей в одном запросе" });
  }
  for (const [name, key] of entries) {
    if (!KEY_ID_RE.test(name) || !key || typeof key !== "object" || Array.isArray(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректный формат публичного ключа" });
      return;
    }
  }
});

const transactionIdSchema = z.string().min(1).max(128);
const eventTypeSchema = z.string().regex(/^m\.[a-zA-Z0-9_.-]{1,124}$/, "Некорректный тип события");

function transportEnabled(): boolean {
  return process.env.TCY_E2EE_TRANSPORT_ENABLED === "true";
}

function requireTransport(): void {
  if (!transportEnabled()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Транспорт E2EE пока выключен до завершения проверки клиентского шифрования.",
    });
  }
}

/** Stable internal Matrix-style ID. Never use a display name as cryptographic identity. */
export function matrixUserIdFor(userId: number): string {
  return `@u${userId}:telechatyou.local`;
}

function safeJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized.length > 100_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Данные слишком большие." });
  }
  return serialized;
}

function parseStoredJson(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Corrupt rows are skipped by callers, not sent to clients.
  }
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function canResolveKeys(requesterId: number, targetId: number): Promise<boolean> {
  if (requesterId === targetId) return true;

  const db = getDb();
  const memberships = await db
    .select({ chatId: chatMembers.chatId })
    .from(chatMembers)
    .where(eq(chatMembers.userId, requesterId));
  if (!memberships.length) return false;

  const chatIds = [...new Set(memberships.map((row) => row.chatId))];
  const shared = await db
    .select({ chatId: chatMembers.chatId })
    .from(chatMembers)
    .where(and(inArray(chatMembers.chatId, chatIds), eq(chatMembers.userId, targetId)))
    .limit(1);
  return shared.length > 0;
}

async function requireOwnedActiveDevice(userId: number, deviceId: string) {
  const device = await getDb().query.e2eeDevices.findFirst({
    where: and(
      eq(e2eeDevices.userId, userId),
      eq(e2eeDevices.deviceId, deviceId),
      isNull(e2eeDevices.revokedAt),
    ),
  });
  if (!device) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Криптографическое устройство не зарегистрировано или отозвано.",
    });
  }
  return device;
}

export const e2eeRouter = createRouter({
  /** Status intentionally distinguishes transport groundwork from actual encrypted chats. */
  status: authedQuery.query(() => ({
    protocol: "matrix-olm-megolm",
    transportEnabled: transportEnabled(),
    messageEncryptionEnabled: false,
    phase: "transport-foundation",
  })),

  /**
   * Publish only public device keys. Private identity/session keys must remain
   * in the local encrypted WASM store and must never be sent to this endpoint.
   * This route stays disabled unless the host explicitly opts into transport testing.
   */
  uploadKeys: authedQuery
    .input(z.object({
      deviceId: deviceIdSchema,
      displayName: z.string().trim().min(1).max(96).optional(),
      deviceKeys: publicJsonObject.optional(),
      oneTimeKeys: keyMapSchema.optional(),
      fallbackKeys: keyMapSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireTransport();
      assertRateLimit(`e2ee-upload:${ctx.user.id}`, 30, 60 * 1000);

      const db = getDb();
      const matrixUserId = matrixUserIdFor(ctx.user.id);
      const existing = await db.query.e2eeDevices.findFirst({
        where: and(
          eq(e2eeDevices.userId, ctx.user.id),
          eq(e2eeDevices.deviceId, input.deviceId),
        ),
      });

      if (existing?.revokedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Устройство отозвано; зарегистрируй новое устройство." });
      }

      if (input.deviceKeys) {
        const keys = input.deviceKeys;
        if (
          keys.user_id !== matrixUserId ||
          keys.device_id !== input.deviceId ||
          !isRecord(keys.keys) ||
          !isRecord(keys.signatures)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Публичные ключи устройства имеют неверный формат или принадлежат другому аккаунту.",
          });
        }

        await db.insert(e2eeDevices).values({
          userId: ctx.user.id,
          deviceId: input.deviceId,
          deviceKeys: safeJson(keys),
          displayName: input.displayName ?? null,
        }).onDuplicateKeyUpdate({
          set: {
            deviceKeys: safeJson(keys),
            displayName: input.displayName ?? null,
            updatedAt: new Date(),
          },
        });
      } else if (!existing) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Сначала зарегистрируй публичные ключи устройства.",
        });
      }

      // One-time and fallback keys are public, signed key material. Duplicate IDs
      // are ignored and never overwrite a previously claimed one-time key.
      const groups = [
        { values: input.oneTimeKeys, isFallback: false },
        { values: input.fallbackKeys, isFallback: true },
      ];
      let added = 0;
      for (const group of groups) {
        for (const [keyId, keyData] of Object.entries(group.values ?? {})) {
          const algorithm = keyId.split(":", 1)[0];
          const prior = await db.query.e2eeOneTimeKeys.findFirst({
            where: and(
              eq(e2eeOneTimeKeys.userId, ctx.user.id),
              eq(e2eeOneTimeKeys.deviceId, input.deviceId),
              eq(e2eeOneTimeKeys.keyId, keyId),
            ),
          });
          if (prior) continue;

          await db.insert(e2eeOneTimeKeys).values({
            userId: ctx.user.id,
            deviceId: input.deviceId,
            algorithm,
            keyId,
            keyData: safeJson(keyData),
            isFallback: group.isFallback,
          });
          added += 1;
        }
      }

      return { ok: true, deviceId: input.deviceId, addedPublicKeys: added };
    }),

  /** Query signed public device keys for this account or users sharing a chat. */
  queryKeys: authedQuery
    .input(z.object({ userIds: z.array(z.number().int().positive()).max(50) }))
    .query(async ({ ctx, input }) => {
      requireTransport();
      const ids = [...new Set(input.userIds)];
      const permitted = await Promise.all(ids.map(async (userId) => ({
        userId,
        allowed: await canResolveKeys(ctx.user.id, userId),
      })));
      const allowedIds = permitted.filter((entry) => entry.allowed).map((entry) => entry.userId);
      if (!allowedIds.length) return { devices: [] };

      const rows = await getDb()
        .select()
        .from(e2eeDevices)
        .where(and(inArray(e2eeDevices.userId, allowedIds), isNull(e2eeDevices.revokedAt)));

      return {
        devices: rows.flatMap((row) => {
          const deviceKeys = parseStoredJson(row.deviceKeys);
          if (!Object.keys(deviceKeys).length) return [];
          return [{
            userId: row.userId,
            matrixUserId: matrixUserIdFor(row.userId),
            deviceId: row.deviceId,
            deviceKeys,
            displayName: row.displayName,
            createdAt: row.createdAt,
          }];
        }),
      };
    }),

  /** Atomically claim one signed one-time key per requested active device. */
  claimKeys: authedQuery
    .input(z.object({
      targets: z.array(z.object({
        userId: z.number().int().positive(),
        deviceId: deviceIdSchema,
        algorithm: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
      })).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      requireTransport();
      assertRateLimit(`e2ee-claim:${ctx.user.id}`, 60, 60 * 1000);
      const db = getDb();
      const result: {
        userId: number;
        matrixUserId: string;
        deviceId: string;
        keyId: string;
        algorithm: string;
        keyData: Record<string, unknown>;
        fallback: boolean;
      }[] = [];

      for (const target of input.targets) {
        if (!(await canResolveKeys(ctx.user.id, target.userId))) continue;
        const device = await db.query.e2eeDevices.findFirst({
          where: and(
            eq(e2eeDevices.userId, target.userId),
            eq(e2eeDevices.deviceId, target.deviceId),
            isNull(e2eeDevices.revokedAt),
          ),
        });
        if (!device) continue;

        const candidate = await db.query.e2eeOneTimeKeys.findFirst({
          where: and(
            eq(e2eeOneTimeKeys.userId, target.userId),
            eq(e2eeOneTimeKeys.deviceId, target.deviceId),
            eq(e2eeOneTimeKeys.algorithm, target.algorithm),
            eq(e2eeOneTimeKeys.isFallback, false),
            isNull(e2eeOneTimeKeys.claimedAt),
          ),
          orderBy: [asc(e2eeOneTimeKeys.id)],
        });

        if (candidate) {
          const claimedAt = new Date();
          const updateResult = await db.update(e2eeOneTimeKeys)
            .set({ claimedAt })
            .where(and(eq(e2eeOneTimeKeys.id, candidate.id), isNull(e2eeOneTimeKeys.claimedAt)));
          if (affectedRows(updateResult) !== 1) continue;

          result.push({
            userId: target.userId,
            matrixUserId: matrixUserIdFor(target.userId),
            deviceId: target.deviceId,
            keyId: candidate.keyId,
            algorithm: candidate.algorithm,
            keyData: parseStoredJson(candidate.keyData),
            fallback: false,
          });
          continue;
        }

        // Matrix fallback keys are reusable only after all one-time keys run out.
        // We never mutate them into claimed one-time keys.
        const fallback = await db.query.e2eeOneTimeKeys.findFirst({
          where: and(
            eq(e2eeOneTimeKeys.userId, target.userId),
            eq(e2eeOneTimeKeys.deviceId, target.deviceId),
            eq(e2eeOneTimeKeys.algorithm, target.algorithm),
            eq(e2eeOneTimeKeys.isFallback, true),
          ),
          orderBy: [asc(e2eeOneTimeKeys.id)],
        });
        if (fallback) {
          result.push({
            userId: target.userId,
            matrixUserId: matrixUserIdFor(target.userId),
            deviceId: target.deviceId,
            keyId: fallback.keyId,
            algorithm: fallback.algorithm,
            keyData: parseStoredJson(fallback.keyData),
            fallback: true,
          });
        }
      }

      return { keys: result };
    }),

  /** Queue opaque, encrypted to-device signalling; sender and recipient must share a chat. */
  sendToDevice: authedQuery
    .input(z.object({
      transactionId: transactionIdSchema,
      eventType: eventTypeSchema,
      messages: z.array(z.object({
        userId: z.number().int().positive(),
        deviceId: z.union([deviceIdSchema, z.literal("*")]),
        content: publicJsonObject,
      })).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      requireTransport();
      assertRateLimit(`e2ee-send-to-device:${ctx.user.id}`, 120, 60 * 1000);

      const db = getDb();
      const senderChatIds = await db.select({ chatId: chatMembers.chatId })
        .from(chatMembers)
        .where(eq(chatMembers.userId, ctx.user.id));
      const sharedChatIds = [...new Set(senderChatIds.map((row) => row.chatId))];
      let queued = 0;

      for (const message of input.messages) {
        if (message.userId !== ctx.user.id) {
          if (!sharedChatIds.length) continue;
          const shared = await db.select({ chatId: chatMembers.chatId })
            .from(chatMembers)
            .where(and(
              inArray(chatMembers.chatId, sharedChatIds),
              eq(chatMembers.userId, message.userId),
            ))
            .limit(1);
          if (!shared.length) continue;
        }

        const recipients = message.deviceId === "*"
          ? await db.select({ deviceId: e2eeDevices.deviceId })
              .from(e2eeDevices)
              .where(and(
                eq(e2eeDevices.userId, message.userId),
                isNull(e2eeDevices.revokedAt),
              ))
          : await db.select({ deviceId: e2eeDevices.deviceId })
              .from(e2eeDevices)
              .where(and(
                eq(e2eeDevices.userId, message.userId),
                eq(e2eeDevices.deviceId, message.deviceId),
                isNull(e2eeDevices.revokedAt),
              ));

        for (const recipient of recipients) {
          const existing = await db.query.e2eeToDeviceEvents.findFirst({
            where: and(
              eq(e2eeToDeviceEvents.senderUserId, ctx.user.id),
              eq(e2eeToDeviceEvents.transactionId, input.transactionId),
              eq(e2eeToDeviceEvents.recipientUserId, message.userId),
              eq(e2eeToDeviceEvents.recipientDeviceId, recipient.deviceId),
            ),
          });
          if (existing) continue;

          await db.insert(e2eeToDeviceEvents).values({
            senderUserId: ctx.user.id,
            recipientUserId: message.userId,
            recipientDeviceId: recipient.deviceId,
            eventType: input.eventType,
            content: safeJson(message.content),
            transactionId: input.transactionId,
          });
          queued += 1;
          if (queued > 300) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Слишком много устройств в одном запросе." });
          }
        }
      }

      return { ok: true, queued };
    }),

  /** Read pending events for one of the signed-in user's active devices. */
  syncToDevice: authedQuery
    .input(z.object({
      deviceId: deviceIdSchema,
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      requireTransport();
      await requireOwnedActiveDevice(ctx.user.id, input.deviceId);

      const rows = await getDb().select()
        .from(e2eeToDeviceEvents)
        .where(and(
          eq(e2eeToDeviceEvents.recipientUserId, ctx.user.id),
          eq(e2eeToDeviceEvents.recipientDeviceId, input.deviceId),
          isNull(e2eeToDeviceEvents.acknowledgedAt),
        ))
        .orderBy(asc(e2eeToDeviceEvents.id))
        .limit(input.limit);

      return {
        events: rows.map((row) => ({
          id: row.id,
          sender: matrixUserIdFor(row.senderUserId),
          type: row.eventType,
          content: parseStoredJson(row.content),
          transactionId: row.transactionId,
          createdAt: row.createdAt,
        })),
      };
    }),

  /** Acknowledge only events assigned to the current account and selected device. */
  ackToDevice: authedQuery
    .input(z.object({
      deviceId: deviceIdSchema,
      eventIds: z.array(z.number().int().positive()).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      requireTransport();
      await requireOwnedActiveDevice(ctx.user.id, input.deviceId);
      const ids = [...new Set(input.eventIds)];
      const result = await getDb().update(e2eeToDeviceEvents)
        .set({ acknowledgedAt: new Date() })
        .where(and(
          inArray(e2eeToDeviceEvents.id, ids),
          eq(e2eeToDeviceEvents.recipientUserId, ctx.user.id),
          eq(e2eeToDeviceEvents.recipientDeviceId, input.deviceId),
          isNull(e2eeToDeviceEvents.acknowledgedAt),
        ));
      return { acknowledged: affectedRows(result) };
    }),

  /** Revoke a device owned by the current user and clear its unclaimed keys. */
  revokeDevice: authedQuery
    .input(z.object({ deviceId: deviceIdSchema }))
    .mutation(async ({ ctx, input }) => {
      requireTransport();
      const db = getDb();
      const device = await db.query.e2eeDevices.findFirst({
        where: and(
          eq(e2eeDevices.userId, ctx.user.id),
          eq(e2eeDevices.deviceId, input.deviceId),
          isNull(e2eeDevices.revokedAt),
        ),
      });
      if (!device) throw new TRPCError({ code: "NOT_FOUND", message: "Активное устройство не найдено." });

      const now = new Date();
      await db.update(e2eeDevices)
        .set({ revokedAt: now, updatedAt: now })
        .where(eq(e2eeDevices.id, device.id));
      await db.update(e2eeOneTimeKeys)
        .set({ claimedAt: now })
        .where(and(
          eq(e2eeOneTimeKeys.userId, ctx.user.id),
          eq(e2eeOneTimeKeys.deviceId, input.deviceId),
          isNull(e2eeOneTimeKeys.claimedAt),
          eq(e2eeOneTimeKeys.isFallback, false),
        ));
      await db.update(e2eeToDeviceEvents)
        .set({ acknowledgedAt: now })
        .where(and(
          eq(e2eeToDeviceEvents.recipientUserId, ctx.user.id),
          eq(e2eeToDeviceEvents.recipientDeviceId, input.deviceId),
          isNull(e2eeToDeviceEvents.acknowledgedAt),
        ));

      return { ok: true };
    }),
});
