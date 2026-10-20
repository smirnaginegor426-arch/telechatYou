import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  longtext,
  timestamp,
  bigint,
  boolean,
  int,
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
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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

/** One-time keys used to recover access when a password is forgotten. */
export const recoveryCodes = mysqlTable(
  "recovery_codes",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    /** SHA-256 hash only; the plain key is returned once to the account owner. */
    codeHash: varchar("codeHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("recovery_codes_user_idx").on(t.userId),
    expiresIdx: index("recovery_codes_expires_idx").on(t.expiresAt),
  }),
);

/** Private second factor that authorizes issuing a password-recovery sign-in key. */
export const recoverySecrets = mysqlTable(
  "recovery_secrets",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().unique(),
    /** Hash of a cryptographically random 256-bit secret. Never store the secret itself. */
    secretHash: varchar("secretHash", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    secretUserIdx: index("recovery_secrets_user_idx").on(t.userId),
  }),
);

/** Account lock/password created from the security settings screen. Only a hash is stored. */
export const accountSecurityPasswords = mysqlTable(
  "account_security_passwords",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull().unique(),
    passwordType: mysqlEnum("passwordType", ["digital", "graphical"]).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({ accountSecurityPasswordUserIdx: index("account_security_passwords_user_idx").on(t.userId) }),
);

/** One-time email verification and password recovery codes. Codes are HMAC-hashed, short-lived and single-use. */
export const emailVerificationCodes = mysqlTable(
  "email_verification_codes",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    purpose: mysqlEnum("purpose", ["link", "password_reset"]).notNull(),
    codeHash: varchar("codeHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    attempts: int("attempts").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("email_verification_codes_user_idx").on(t.userId, t.purpose),
    emailIdx: index("email_verification_codes_email_idx").on(t.email, t.purpose),
    expiryIdx: index("email_verification_codes_expiry_idx").on(t.expiresAt),
  }),
);

/** Server-side one-time access keys for TeleChat You Alpha APK downloads. */
export const alphaAccessKeys = mysqlTable(
  "alpha_access_keys",
  {
    id: serial("id").primaryKey(),
    /** SHA-256 hash only; plaintext access keys are never stored in the database. */
    keyHash: varchar("keyHash", { length: 64 }).notNull().unique(),
    keyType: mysqlEnum("keyType", ["tester", "subscriber"]).default("tester").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    alphaAccessKeyUsedIdx: index("alpha_access_keys_used_idx").on(t.usedAt),
  }),
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

/** Metadata for a broadcast channel. The conversation itself reuses chats/chat_members. */
export const channels = mysqlTable(
  "channels",
  {
    id: serial("id").primaryKey(),
    chatId: bigint("chatId", { mode: "number", unsigned: true }).notNull().unique(),
    ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull(),
    kind: mysqlEnum("kind", ["channel", "group"]).default("channel").notNull(),
    username: varchar("username", { length: 32 }).unique(),
    description: varchar("description", { length: 280 }).default("").notNull(),
    isPublic: boolean("isPublic").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    publicIdx: index("channels_public_idx").on(t.isPublic, t.username),
    ownerIdx: index("channels_owner_idx").on(t.ownerId),
  }),
);

export type Channel = typeof channels.$inferSelect;

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

/** The currently pinned message that is visible to everyone in a chat. */
export const pinnedMessages = mysqlTable(
  "pinned_messages",
  {
    id: serial("id").primaryKey(),
    chatId: bigint("chatId", { mode: "number", unsigned: true }).notNull().unique(),
    messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull(),
    // userId is retained for compatibility with older server bundles; pinnedBy is the current alias.
    userId: bigint("userId", { mode: "number", unsigned: true }),
    pinnedBy: bigint("pinnedBy", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    pinnedMessageIdx: index("pinned_messages_message_idx").on(t.messageId),
    pinnedByIdx: index("pinned_messages_user_idx").on(t.pinnedBy),
  }),
);

/** Personal pin, visible only to its owner across their devices. */
export const personalPinnedMessages = mysqlTable(
  "personal_pinned_messages",
  {
    id: serial("id").primaryKey(),
    chatId: bigint("chatId", { mode: "number", unsigned: true }).notNull(),
    userId: userId(),
    messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    personalPinUniq: uniqueIndex("personal_pinned_chat_user_uniq").on(t.chatId, t.userId),
    personalPinMessageIdx: index("personal_pinned_message_idx").on(t.messageId),
    personalPinUserIdx: index("personal_pinned_user_idx").on(t.userId),
  }),
);

/** Poll attached to an ordinary message so existing message history remains compatible. */
export const polls = mysqlTable(
  "polls",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull().unique(),
    chatId: bigint("chatId", { mode: "number", unsigned: true }).notNull(),
    creatorId: bigint("creatorId", { mode: "number", unsigned: true }).notNull(),
    question: varchar("question", { length: 500 }).notNull(),
    allowMultiple: boolean("allowMultiple").default(false).notNull(),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    chatIdx: index("polls_chat_idx").on(t.chatId),
    creatorIdx: index("polls_creator_idx").on(t.creatorId),
  }),
);

export type Poll = typeof polls.$inferSelect;

export const pollOptions = mysqlTable(
  "poll_options",
  {
    id: serial("id").primaryKey(),
    pollId: bigint("pollId", { mode: "number", unsigned: true }).notNull(),
    text: varchar("text", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({ pollIdx: index("poll_options_poll_idx").on(t.pollId) }),
);

export const pollVotes = mysqlTable(
  "poll_votes",
  {
    id: serial("id").primaryKey(),
    pollId: bigint("pollId", { mode: "number", unsigned: true }).notNull(),
    optionId: bigint("optionId", { mode: "number", unsigned: true }).notNull(),
    userId: userId(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    pollIdx: index("poll_votes_poll_idx").on(t.pollId),
    optionIdx: index("poll_votes_option_idx").on(t.optionId),
    userIdx: index("poll_votes_user_idx").on(t.userId),
    uniqVote: uniqueIndex("poll_votes_unique").on(t.pollId, t.optionId, t.userId),
  }),
);

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

/** One record per account per channel post, used for unique view counts. */
export const channelMessageViews = mysqlTable(
  "channel_message_views",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("messageId", { mode: "number", unsigned: true }).notNull(),
    userId: userId(),
    viewedAt: timestamp("viewedAt").defaultNow().notNull(),
  },
  (t) => ({
    messageUserUnique: uniqueIndex("channel_message_views_unique").on(t.messageId, t.userId),
    messageIdx: index("channel_message_views_message_idx").on(t.messageId),
    userIdx: index("channel_message_views_user_idx").on(t.userId),
  }),
);

/** Text comments attached to a channel post, separate from the channel's publication feed. */
export const channelPostComments = mysqlTable(
  "channel_post_comments",
  {
    id: serial("id").primaryKey(),
    postId: bigint("postId", { mode: "number", unsigned: true }).notNull(),
    chatId: bigint("chatId", { mode: "number", unsigned: true }).notNull(),
    senderId: bigint("senderId", { mode: "number", unsigned: true }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    postIdx: index("channel_post_comments_post_idx").on(t.postId, t.id),
    chatIdx: index("channel_post_comments_chat_idx").on(t.chatId),
    senderIdx: index("channel_post_comments_sender_idx").on(t.senderId),
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

/** Account-owned collections that must survive browser cache clears and device changes. */
export const userCustomData = mysqlTable("user_custom_data", {
  id: serial("id").primaryKey(),
  userId: userId().unique(),
  stickerPacks: longtext("stickerPacks").notNull(),
  favoriteStickers: longtext("favoriteStickers").notNull(),
  chatFolders: longtext("chatFolders").notNull(),
  contactNames: longtext("contactNames").notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type UserCustomData = typeof userCustomData.$inferSelect;


/** One-way account blocks for direct conversations. */
export const userBlocks = mysqlTable(
  "user_blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: bigint("blockerId", { mode: "number", unsigned: true }).notNull(),
    blockedId: bigint("blockedId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    pairUnique: uniqueIndex("user_blocks_pair_uniq").on(t.blockerId, t.blockedId),
    blockerIdx: index("user_blocks_blocker_idx").on(t.blockerId),
    blockedIdx: index("user_blocks_blocked_idx").on(t.blockedId),
  }),
);

export type UserBlock = typeof userBlocks.$inferSelect;
