import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";

export type RouterOutput = inferRouterOutputs<AppRouter>;
export type RouterInput = inferRouterInputs<AppRouter>;

export type ChatListItem = RouterOutput["chats"]["list"][number];
export type MessageItem = RouterOutput["messages"]["list"]["items"][number];
export type ProfileData = NonNullable<RouterOutput["profile"]["me"]["profile"]>;
