import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "bot.db"));

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (guild_id, key)
  );

  CREATE TABLE IF NOT EXISTS invite_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    inviter_id TEXT,
    joined_at INTEGER NOT NULL,
    left_at INTEGER,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS invite_resets (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reset_count INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    closed_at INTEGER,
    status TEXT DEFAULT 'open'
  );

  CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_invite_guild_user ON invite_tracking(guild_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_invite_guild_inviter ON invite_tracking(guild_id, inviter_id);
`);

export function getSetting(guildId: string, key: string): string | null {
  const stmt = db.prepare(
    "SELECT value FROM guild_settings WHERE guild_id = ? AND key = ?"
  );
  const row = stmt.get(guildId, key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(guildId: string, key: string, value: string): void {
  db.prepare(
    "INSERT OR REPLACE INTO guild_settings (guild_id, key, value) VALUES (?, ?, ?)"
  ).run(guildId, key, value);
}

export function recordJoin(
  guildId: string,
  userId: string,
  inviterId: string | null
): void {
  db.prepare(
    "INSERT INTO invite_tracking (guild_id, user_id, inviter_id, joined_at) VALUES (?, ?, ?, ?)"
  ).run(guildId, userId, inviterId, Date.now());
}

export function recordLeave(guildId: string, userId: string): void {
  db.prepare(
    "UPDATE invite_tracking SET left_at = ?, is_active = 0 WHERE guild_id = ? AND user_id = ? AND is_active = 1"
  ).run(Date.now(), guildId, userId);
}

export function getInviterOf(guildId: string, userId: string): string | null {
  const row = db
    .prepare(
      "SELECT inviter_id FROM invite_tracking WHERE guild_id = ? AND user_id = ? ORDER BY joined_at DESC LIMIT 1"
    )
    .get(guildId, userId) as { inviter_id: string | null } | undefined;
  return row?.inviter_id ?? null;
}

export interface InviteStats {
  total: number;
  active: number;
  left: number;
}

export function getInviteStats(guildId: string, userId: string): InviteStats {
  const resetRow = db
    .prepare(
      "SELECT reset_count FROM invite_resets WHERE guild_id = ? AND user_id = ?"
    )
    .get(guildId, userId) as { reset_count: number } | undefined;
  const resetCount = resetRow?.reset_count ?? 0;

  const total = (
    db
      .prepare(
        "SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ?"
      )
      .get(guildId, userId) as { cnt: number }
  ).cnt;

  const active = (
    db
      .prepare(
        "SELECT COUNT(*) as cnt FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? AND is_active = 1"
      )
      .get(guildId, userId) as { cnt: number }
  ).cnt;

  const left = total - active;
  const netActive = Math.max(0, active - resetCount);

  return { total, active: netActive, left };
}

export interface InvitedUser {
  user_id: string;
  joined_at: number;
  is_active: number;
}

export function getInvitedUsers(guildId: string, userId: string): InvitedUser[] {
  const rows = db
    .prepare(
      "SELECT user_id, joined_at, is_active FROM invite_tracking WHERE guild_id = ? AND inviter_id = ? ORDER BY joined_at DESC"
    )
    .all(guildId, userId) as unknown as InvitedUser[];
  return rows;
}

export function resetInvites(guildId: string, userId: string): void {
  const stats = getInviteStats(guildId, userId);
  db.prepare(
    "INSERT OR REPLACE INTO invite_resets (guild_id, user_id, reset_count) VALUES (?, ?, ?)"
  ).run(guildId, userId, stats.active);
}

export function resetAllInvites(guildId: string): number {
  const inviters = db
    .prepare(
      "SELECT DISTINCT inviter_id FROM invite_tracking WHERE guild_id = ? AND inviter_id IS NOT NULL"
    )
    .all(guildId) as { inviter_id: string }[];

  for (const { inviter_id } of inviters) {
    const stats = getInviteStats(guildId, inviter_id);
    db.prepare(
      "INSERT OR REPLACE INTO invite_resets (guild_id, user_id, reset_count) VALUES (?, ?, ?)"
    ).run(guildId, inviter_id, stats.active);
  }

  return inviters.length;
}

export function saveBackup(guildId: string, name: string, data: object): void {
  db.prepare(
    "INSERT INTO backups (guild_id, name, data, created_at) VALUES (?, ?, ?, ?)"
  ).run(guildId, name, JSON.stringify(data), Date.now());
}

export function loadBackup(guildId: string): object | null {
  const row = db
    .prepare(
      "SELECT data FROM backups WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(guildId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export default db;
