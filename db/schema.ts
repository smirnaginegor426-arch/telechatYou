import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  // Legacy Kimi identity is nullable for accounts created locally.
  unionId: varchar("unionId", { length: 255 }).unique(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin", "official_tester"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Opaque database-backed sessions; only a hash of the browser token is stored. */
export const sessions = mysqlTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("userAgent", { length: 512 }),
  },
  (t) => ({ userIdx: index("sessions_user_idx").on(t.userId), expiresIdx: index("sessions_expires_idx").on(t.expiresAt) }),
);

// ===================== TeleChatYou schema =====================

const userId = () => bigint("userId", { mode: "number", unsigned: true }).notNull();

/** Messenger profile — extends the auth user 1:1 */
export const profiles = mysqlTable(
  "profiles",
  {
    id: serial("id").primaryKey(),
    userId: userId().unique(),
    username: varchar("username", { length: 32 }).notNull().unique(),
    displayName: varchar("displayName", { length: 64 }).notNull(),
    bio: varchar("bio", { length: 280 }).default("").notNull(),
    avatarKey: varchar("avatarKey", { length: 255 }),
    accent: varchar("accent", { length: 16 }).default("mint").notNull(),
    officialTester: boolean("officialTester").default(false).notNull(),
    verificationBadge: varchar("verificationBadge", { length: 32 }).default("none").notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({ usernameIdx: index("profiles_username_idx").on(t.username) }),
);

export type Profile = typeof profiles.$inferSelect;

/** Chats: direct (1:1) or group */
export const chats = mysqlTable("chats", {
  id: serial("id").primaryKey(),
  type: mysqlEnum("type", ["direct", "group"]).notNull(),
  title: varchar("title", { length: 96 }),
  avatarKey: varchar("avatarKey", { length: 255 }),
  /** deterministic key for direct chats: "min:max" of user ids */
  directKey: varchar("directKey", { length: 64 }).unique(),
  createdById: userId(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Chat = typeof chats.$inferSelect;

export const chatMembers = mysqlTable(
  "chat_members",
  {
    id: serial("id").primaryKey(),
    chatId: bigint("chatId", { mode: "number", unsigned: true }).notNull(),
    userId: userId(),
    role: mysqlEnum("role", ["owner", "admin", "member"]).default("member").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    muted: boolean("muted").default(false).notNull(),
    archived: boolean("archived").default(false).notNull(),
    cleared: boolean("cleared").default(false).notNull(), // hidden from own list
    lastReadMessageId: bigint("lastReadMessageId", { mode: "number", unsigned: true })
      .default(0)
      .notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (t) => ({
    chatIdx: index("cm_chat_idx").on(t.chatId),
    userIdx: index("cm_user_idx").on(t.userId),
    uniq: uniqueIndex("cm_chat_user_uniq").on(t.chatId, t.userId),
  }),
);

export type ChatMember = typeof chatMembers.$inferSelect;

export const messages = mysqlTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    chatId: bigint("chatId", { mode: "number", unsigned: true }).notNull(),
    senderId: userId(),
    kind: mysqlEnum("kind", ["text", "image", "file", "voice", "system"]).default("text").notNull(),
    body: text("body"),
    attachmentKey: varchar("attachmentKey", { length: 255 }),
    attachmentName: varchar("attachmentName", { length: 255 }),
    attachmentSize: bigint("attachmentSize", { mode: "number" }),
    attachmentMime: varchar("attachmentMime", { length: 128 }),
    /** voice: JSON string { duration: number, peaks: number[] } */
    voiceMeta: text("voiceMeta"),
    replyToId: bigint("replyToId", { mode: "number", unsigned: true }),
    forwardedFromName: varchar("forwardedFromName", { length: 64 }),
    editedAt: timestamp("editedAt"),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    chatIdx: index("msg_chat_idx").on(t.chatId),
    chatCreatedIdx: index("msg_chat_created_idx").on(t.chatId, t.createdAt),
  }),
);

export type Message = typeof messages.$inferSelect;

export const reactions = mysqlTable(
  "reactions",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull(),
    userId: userId(),
    emoji: varchar("emoji", { length: 16 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    msgIdx: index("reactions_msg_idx").on(t.messageId),
    uniq: uniqueIndex("reactions_uniq").on(t.messageId, t.userId, t.emoji),
  }),
);

/** Stored files registry (object-storage keys + ownership) */
export const files = mysqlTable("files", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  ownerId: userId(),
  name: varchar("name", { length: 255 }).notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  contentType: varchar("contentType", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Per-user app settings */
export const settings = mysqlTable("settings", {
  id: serial("id").primaryKey(),
  userId: userId().unique(),
  theme: mysqlEnum("theme", ["dark", "light"]).default("dark").notNull(),
  accent: varchar("accent", { length: 16 }).default("mint").notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  messagePreview: boolean("messagePreview").default(true).notNull(),
  soundEnabled: boolean("soundEnabled").default(true).notNull(),
  showOnline: boolean("showOnline").default(true).notNull(),
  showLastSeen: boolean("showLastSeen").default(true).notNull(),
  readReceipts: boolean("readReceipts").default(true).notNull(),
  enterToSend: boolean("enterToSend").default(false).notNull(),
  autoplayMedia: boolean("autoplayMedia").default(true).notNull(),
  language: varchar("language", { length: 8 }).default("ru").notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Settings = typeof settings.$inferSelect;
