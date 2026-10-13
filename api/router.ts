import { authRouter } from "./auth-router";
import { adminRouter } from "./admin-router";
import { chatsRouter } from "./chats-router";
import { channelsRouter } from "./channels-router";
import { messagesRouter } from "./messages-router";
import { profileRouter } from "./profile-router";
import { settingsRouter } from "./settings-router";
import { storageRouter } from "./storage-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({
    ok: true,
    ts: Date.now(),
  })),
  auth: authRouter,
  profile: profileRouter,
  chats: chatsRouter,
  channels: channelsRouter,
  messages: messagesRouter,
  storage: storageRouter,
  settings: settingsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
