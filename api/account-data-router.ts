import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { chatMembers, chats, userCustomData } from "@db/schema";

const stickerAssetSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(64),
  dataUrl: z.string().max(1_500_000).optional(),
  attachmentKey: z.string().max(255).optional(),
  contentType: z.string().max(128).optional(),
});
const stickerPackSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(48),
  stickers: z.array(stickerAssetSchema).max(40),
  createdAt: z.number().int().nonnegative(),
});
const favoriteStickerSchema = stickerAssetSchema.extend({
  packName: z.string().max(48),
});
const stickerLibrarySchema = z.object({
  packs: z.array(stickerPackSchema).max(40),
  favorites: z.array(favoriteStickerSchema).max(80),
}).superRefine((value, context) => {
  // Keep a single account row comfortably inside the API's request-size limit.
  if (JSON.stringify(value).length > 12_000_000) {
    context.addIssue({ code: "custom", message: "Библиотека стикеров слишком большая" });
  }
});

const folderSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(48),
  chatIds: z.array(z.number().int().positive()).max(200),
});
type ChatFolder = z.infer<typeof folderSchema>;

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function ensureRow(userId: number) {
  let row = await getDb().query.userCustomData.findFirst({
    where: eq(userCustomData.userId, userId),
  });
  if (row) return row;

  await getDb().insert(userCustomData).values({
    userId,
    stickerPacks: "[]",
    favoriteStickers: "[]",
    chatFolders: "[]",
    contactNames: "{}",
  }).onDuplicateKeyUpdate({ set: { userId } });

  row = await getDb().query.userCustomData.findFirst({
    where: eq(userCustomData.userId, userId),
  });
  if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось открыть данные аккаунта" });
  return row;
}

async function readFolders(userId: number): Promise<ChatFolder[]> {
  const row = await ensureRow(userId);
  const value = parseJson<unknown>(row.chatFolders, []);
  return Array.isArray(value)
    ? value.filter((folder): folder is ChatFolder => {
        if (!folder || typeof folder !== "object") return false;
        const candidate = folder as Partial<ChatFolder>;
        return typeof candidate.id === "string" &&
          typeof candidate.name === "string" &&
          Array.isArray(candidate.chatIds) &&
          candidate.chatIds.every((id) => typeof id === "number");
      })
    : [];
}

export const accountDataRouter = createRouter({
  stickerLibrary: createRouter({
    get: authedQuery.query(async ({ ctx }) => {
      const row = await ensureRow(ctx.user.id);
      const packs = parseJson<unknown>(row.stickerPacks, []);
      const favorites = parseJson<unknown>(row.favoriteStickers, []);
      return {
        packs: Array.isArray(packs) ? packs : [],
        favorites: Array.isArray(favorites) ? favorites : [],
      };
    }),

    save: authedQuery.input(stickerLibrarySchema).mutation(async ({ ctx, input }) => {
      const payload = JSON.stringify(input);
      if (payload.length > 12_000_000) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Библиотека стикеров слишком большая" });
      }
      await ensureRow(ctx.user.id);
      await getDb().update(userCustomData).set({
        stickerPacks: JSON.stringify(input.packs),
        favoriteStickers: JSON.stringify(input.favorites),
      }).where(eq(userCustomData.userId, ctx.user.id));
      return { ok: true, savedAt: new Date() };
    }),
  }),

  folders: createRouter({
    list: authedQuery.query(({ ctx }) => readFolders(ctx.user.id)),

    save: authedQuery.input(folderSchema).mutation(async ({ ctx, input }) => {
      const ids = [...new Set(input.chatIds)];
      let allowedIds: number[] = [];
      if (ids.length) {
        const rows = await getDb()
          .select({ chatId: chatMembers.chatId, directKey: chats.directKey })
          .from(chatMembers)
          .innerJoin(chats, eq(chats.id, chatMembers.chatId))
          .where(and(
            eq(chatMembers.userId, ctx.user.id),
            inArray(chatMembers.chatId, ids),
            eq(chats.type, "direct"),
          ));
        const selfKey = `${ctx.user.id}:${ctx.user.id}`;
        allowedIds = rows
          .filter((row) => row.directKey !== selfKey)
          .map((row) => row.chatId);
        if (allowedIds.length !== ids.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Папки могут содержать только личные чаты, в которых вы состоите",
          });
        }
      }

      const row = await ensureRow(ctx.user.id);
      const folders = parseJson<ChatFolder[]>(row.chatFolders, []);
      const clean: ChatFolder = {
        id: input.id,
        name: input.name.trim(),
        chatIds: allowedIds,
      };
      const index = folders.findIndex((folder) => folder.id === clean.id);
      if (index >= 0) folders[index] = clean;
      else folders.unshift(clean);
      const next = folders.slice(0, 100);
      await getDb().update(userCustomData).set({
        chatFolders: JSON.stringify(next),
      }).where(eq(userCustomData.userId, ctx.user.id));
      return next;
    }),

    delete: authedQuery.input(z.object({ id: z.string().min(1).max(100) })).mutation(async ({ ctx, input }) => {
      const row = await ensureRow(ctx.user.id);
      const folders = parseJson<ChatFolder[]>(row.chatFolders, []).filter((folder) => folder.id !== input.id);
      await getDb().update(userCustomData).set({
        chatFolders: JSON.stringify(folders),
      }).where(eq(userCustomData.userId, ctx.user.id));
      return { ok: true };
    }),
  }),

  contactNames: createRouter({
    get: authedQuery.query(async ({ ctx }) => {
      const row = await ensureRow(ctx.user.id);
      const raw = parseJson<Record<string, unknown>>(row.contactNames, {});
      const names: Record<string, string> = {};
      for (const [userId, value] of Object.entries(raw)) {
        if (/^\d+$/.test(userId) && typeof value === "string" && value.trim()) {
          names[userId] = value.trim().slice(0, 64);
        }
      }
      return { names };
    }),

    save: authedQuery
      .input(z.object({ names: z.record(z.string(), z.string().max(64)) }))
      .mutation(async ({ ctx, input }) => {
        const entries = Object.entries(input.names);
        if (entries.length > 500) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Слишком много переименованных контактов" });
        }
        const names: Record<string, string> = {};
        for (const [userId, rawName] of entries) {
          const parsedId = Number(userId);
          const name = rawName.trim().slice(0, 64);
          if (!/^\d+$/.test(userId) || !Number.isSafeInteger(parsedId) || parsedId <= 0 || parsedId === ctx.user.id || !name) continue;
          names[userId] = name;
        }
        await ensureRow(ctx.user.id);
        await getDb().update(userCustomData).set({
          contactNames: JSON.stringify(names),
        }).where(eq(userCustomData.userId, ctx.user.id));
        return { names };
      }),
  }),
});
