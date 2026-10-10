import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { settings } from "@db/schema";
import { ensureSettings } from "./queries/telechat";

const patchSchema = z.object({
  theme: z.enum(["dark", "light"]).optional(),
  accent: z.string().max(16).optional(),
  notificationsEnabled: z.boolean().optional(),
  messagePreview: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  showOnline: z.boolean().optional(),
  showLastSeen: z.boolean().optional(),
  readReceipts: z.boolean().optional(),
  enterToSend: z.boolean().optional(),
  autoplayMedia: z.boolean().optional(),
  language: z.string().max(8).optional(),
});

export const settingsRouter = createRouter({
  get: authedQuery.query(({ ctx }) => ensureSettings(ctx.user.id)),

  update: authedQuery.input(patchSchema).mutation(async ({ ctx, input }) => {
    await ensureSettings(ctx.user.id);
    await getDb().update(settings).set(input).where(eq(settings.userId, ctx.user.id));
    return ensureSettings(ctx.user.id);
  }),
});
