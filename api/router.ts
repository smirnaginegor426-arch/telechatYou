import { authRouter } from "./auth-router";
import { adminRouter } from "./admin-router";
import { chatsRouter } from "./chats-router";
import { channelsRouter } from "./channels-router";
import { messagesRouter } from "./messages-router";
import { e2eeRouter } from "./e2ee-router";
import { profileRouter } from "./profile-router";
import { settingsRouter } from "./settings-router";
import { accountDataRouter } from "./account-data-router";
import { storageRouter } from "./storage-router";
import { linksRouter } from "./links-router";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { isPrivateExperimentalTester } from "./lib/experimental-access";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({
    ok: true,
    ts: Date.now(),
  })),

  /** Permission for the private experimental UI preview, derived from the active session. */
  experimentalAccess: authedQuery.query(({ ctx }) => ({
    enabled: isPrivateExperimentalTester(ctx.user),
  })),
  auth: authRouter,
  profile: profileRouter,
  chats: chatsRouter,
  channels: channelsRouter,
  messages: messagesRouter,
  e2ee: e2eeRouter,
  storage: storageRouter,
  links: linksRouter,
  settings: settingsRouter,
  accountData: accountDataRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
