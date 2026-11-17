// Storage for accounts, login sessions and profiles.
//
// - With DATABASE_URL set (Neon / any Postgres): data lives in Postgres.
// - Without it (playing on your own PC): data lives in server/data/db.json.
//
// Players who are logged in are kept in memory, so the game never waits for
// the database; profile changes are written back shortly after they happen.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

import { createDefaultProfile } from '../src/game/pucks';
import type { Profile } from '../src/game/types';

export type UserRecord = {
  username: string;
  salt: string;
  hash: string;
  profile: Profile;
};

type FileData = { users: Record<string, UserRecord & { tokens: string[] }> };

const MAX_SESSIONS_PER_USER = 5;
const SAVE_DELAY_MS = 300;

const hashPassword = (password: string, salt: string) => crypto.scryptSync(password, salt, 64).toString('hex');

// Accounts made with an older version may miss newer profile fields
function upgradeProfile(profile: Profile) {
  profile.color ??= 'blue';
  return profile;
}

export class Db {
  private users = new Map<string, UserRecord>(); // key: lowercase username
  private tokens = new Map<string, string>(); // token -> lowercase username
  private dirty = new Set<string>();
  private saveTimer: NodeJS.Timeout | null = null;

  private constructor(
    private pool: Pool | null,
    private file: string
  ) {}

  /** Connects to Postgres (DATABASE_URL) or opens the local JSON file */
  static async open(file: string): Promise<Db> {
    const url = process.env.DATABASE_URL;
    if (!url) {
      const db = new Db(null, file);
      db.loadFile();
      console.log(`Storage: local file ${file}`);
      return db;
    }

    const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
    // Neon pauses an idle database and closes its connections: just log it,
    // the pool opens a fresh connection on the next query
    pool.on('error', (e) => console.warn('Database connection closed:', e.message));
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        username_lower TEXT PRIMARY KEY,
        username       TEXT NOT NULL,
        salt           TEXT NOT NULL,
        hash           TEXT NOT NULL,
        profile        JSONB NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token          TEXT PRIMARY KEY,
        username_lower TEXT NOT NULL REFERENCES users(username_lower) ON DELETE CASCADE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(username_lower);
    `);
    console.log('Storage: Postgres');
    return new Db(pool, file);
  }

  // ---- Accounts ----

  /** Loads a user (from memory, or from storage the first time) */
  async getUser(username: string): Promise<UserRecord | undefined> {
    const key = username.trim().toLowerCase();
    const cached = this.users.get(key);
    if (cached || !this.pool) return cached;

    const { rows } = await this.pool.query('SELECT username, salt, hash, profile FROM users WHERE username_lower = $1', [key]);
    if (!rows[0]) return undefined;
    const user: UserRecord = { ...rows[0], profile: upgradeProfile(rows[0].profile) };
    this.users.set(key, user);
    return user;
  }

  /** A user who is already logged in (always in memory) */
  cachedUser(username: string): UserRecord | undefined {
    return this.users.get(username.toLowerCase());
  }

  async createUser(username: string, password: string): Promise<UserRecord> {
    if (await this.getUser(username)) throw new Error('That username is taken');
    const salt = crypto.randomBytes(16).toString('hex');
    const user: UserRecord = { username, salt, hash: hashPassword(password, salt), profile: createDefaultProfile(username) };
    const key = username.toLowerCase();

    if (this.pool) {
      const res = await this.pool.query(
        'INSERT INTO users (username_lower, username, salt, hash, profile) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [key, user.username, user.salt, user.hash, JSON.stringify(user.profile)]
      );
      if (res.rowCount === 0) throw new Error('That username is taken');
    }
    this.users.set(key, user);
    if (!this.pool) this.save(user);
    return user;
  }

  checkPassword(user: UserRecord, password: string) {
    const a = Buffer.from(hashPassword(password, user.salt), 'hex');
    const b = Buffer.from(user.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // ---- Login sessions (tokens) ----

  async newToken(user: UserRecord): Promise<string> {
    const token = crypto.randomBytes(24).toString('hex');
    const key = user.username.toLowerCase();
    this.tokens.set(token, key);

    if (this.pool) {
      await this.pool.query('INSERT INTO sessions (token, username_lower) VALUES ($1, $2)', [token, key]);
      // keep only the newest few devices logged in
      await this.pool.query(
        `DELETE FROM sessions WHERE username_lower = $1 AND token NOT IN (
           SELECT token FROM sessions WHERE username_lower = $1 ORDER BY created_at DESC LIMIT $2)`,
        [key, MAX_SESSIONS_PER_USER]
      );
    } else {
      const mine = [...this.tokens].filter(([, u]) => u === key).map(([t]) => t);
      for (const old of mine.slice(0, -MAX_SESSIONS_PER_USER)) this.tokens.delete(old);
      this.save(user);
    }
    return token;
  }

  async findByToken(token: string): Promise<UserRecord | undefined> {
    if (!token) return undefined;
    let key = this.tokens.get(token);
    if (!key && this.pool) {
      const { rows } = await this.pool.query('SELECT username_lower FROM sessions WHERE token = $1', [token]);
      key = rows[0]?.username_lower;
      if (key) this.tokens.set(token, key);
    }
    return key ? this.getUser(key) : undefined;
  }

  async removeToken(token: string) {
    const key = this.tokens.get(token);
    this.tokens.delete(token);
    if (this.pool) await this.pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    else if (key) this.save(this.users.get(key)!);
  }

  // ---- Saving profile changes ----

  /** Marks a user's profile as changed; it is written shortly after */
  save(user: UserRecord) {
    this.dirty.add(user.username.toLowerCase());
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush().catch((e) => console.error('Saving failed:', e));
    }, SAVE_DELAY_MS);
  }

  async flush() {
    const keys = [...this.dirty];
    this.dirty.clear();
    if (keys.length === 0) return;

    if (!this.pool) {
      this.writeFile();
      return;
    }
    for (const key of keys) {
      const user = this.users.get(key);
      if (!user) continue;
      await this.pool.query('UPDATE users SET profile = $2, updated_at = now() WHERE username_lower = $1', [
        key,
        JSON.stringify(user.profile),
      ]);
    }
  }

  async close() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    await this.flush();
    await this.pool?.end();
  }

  // ---- Local file mode ----

  private loadFile() {
    if (!fs.existsSync(this.file)) return;
    const data: FileData = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    for (const [key, { tokens, ...user }] of Object.entries(data.users)) {
      upgradeProfile(user.profile);
      this.users.set(key, user);
      for (const t of tokens ?? []) this.tokens.set(t, key);
    }
  }

  private writeFile() {
    const data: FileData = { users: {} };
    for (const [key, user] of this.users) {
      data.users[key] = { ...user, tokens: [...this.tokens].filter(([, u]) => u === key).map(([t]) => t) };
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(data, null, 2));
  }
}
