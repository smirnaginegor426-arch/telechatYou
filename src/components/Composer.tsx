import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { storage } from "./lib/storage";
import { getDb } from "./queries/connection";
import { files } from "@db/schema";
import { MAX_VOICE_BYTES, validateVoiceUpload } from "./lib/voice-validation";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const storageRouter = createRouter({
  upload: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(200),
        contentBase64: z.string(),
        contentType: z.string().max(128).optional(),
        folder: z.enum(["uploads", "avatars", "voices"]).default("uploads"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      if (input.folder === "voices") {
        const result = validateVoiceUpload({
          size: bytes.length,
          type: input.contentType,
        });
        if (!result.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.message });
        }
        if (bytes.length > MAX_VOICE_BYTES) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Слишком большой файл голоса" });
        }
      }
      if (bytes.length > MAX_UPLOAD_BYTES)
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Файл больше 20 МБ" });
      const saved = await storage.uploadFile({
        fileContent: bytes,
        fileName: `${input.folder}/${ctx.user.id}/${input.name}`,
        contentType: input.contentType,
      });
      await getDb().insert(files).values({
        key: saved.key,
        ownerId: ctx.user.id,
        name: input.name,
        size: saved.size,
        contentType: saved.contentType ?? input.contentType,
      });
      return { key: saved.key, size: saved.size, contentType: saved.contentType };
    }),

  urls: authedQuery
    .input(z.object({ keys: z.array(z.string()).max(50) }))
    .query(async ({ input }) => {
      if (!input.keys.length) return { urls: {} as Record<string, string> };
      const { urls } = await storage.getPresignedUrls({ keys: input.keys });
      const map: Record<string, string> = {};
      for (const u of urls) map[u.key] = u.url;
      return { urls: map };
    }),

  remove: authedQuery
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await getDb().query.files.findFirst({ where: eq(files.key, input.key) });
      if (!row || row.ownerId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });
      await getDb().delete(files).where(eq(files.key, input.key));
      return { ok: await storage.deleteFile({ fileKey: input.key }) };
    }),

  mine: authedQuery.query(async ({ ctx }) => {
    return getDb().select().from(files).where(eq(files.ownerId, ctx.user.id));
  }),

  removeMany: authedQuery
    .input(z.object({ keys: z.array(z.string()).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .select()
        .from(files)
        .where(inArray(files.key, input.keys));
      const own = rows.filter((r) => r.ownerId === ctx.user.id).map((r) => r.key);
      if (own.length) {
        await getDb().delete(files).where(inArray(files.key, own));
        await storage.deleteFiles({ fileKeys: own });
      }
      return { removed: own.length };
    }),
});
