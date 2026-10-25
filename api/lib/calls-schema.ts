import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

/** WebRTC call signaling is stored separately from chat history. */
export async function ensureCallsSchema(): Promise<void> {
  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS call_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chatId BIGINT UNSIGNED NOT NULL,
    callerId BIGINT UNSIGNED NOT NULL,
    calleeId BIGINT UNSIGNED NOT NULL,
    callType ENUM('audio', 'video') NOT NULL,
    status ENUM('ringing', 'accepted', 'rejected', 'ended', 'missed') NOT NULL DEFAULT 'ringing',
    offerSdp LONGTEXT NOT NULL,
    answerSdp LONGTEXT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    endedAt TIMESTAMP NULL DEFAULT NULL,
    KEY call_sessions_chat_status_idx (chatId, status),
    KEY call_sessions_caller_status_idx (callerId, status),
    KEY call_sessions_callee_status_idx (calleeId, status)
  ) ENGINE=InnoDB`));

  await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS call_signals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    callId BIGINT UNSIGNED NOT NULL,
    senderId BIGINT UNSIGNED NOT NULL,
    payload TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY call_signals_call_id_idx (callId, id),
    KEY call_signals_sender_idx (callId, senderId)
  ) ENGINE=InnoDB`));
}
