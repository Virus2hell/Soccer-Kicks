// Tiny JSON-file database: good enough for a hobby game, no setup needed.
// Everything is saved in server/data/db.json.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createDefaultProfile } from '../src/game/pucks';
import type { Profile } from '../src/game/types';

type UserRecord = {
  username: string;
  salt: string;
  hash: string;
  tokens: string[];
  profile: Profile;
};

type Data = { users: Record<string, UserRecord> };

const hashPassword = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

export class Db {
  private data: Data = { users: {} };
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private file: string) {
    if (fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    // Accounts made with an older version have no puck color yet
    for (const user of Object.values(this.data.users)) user.profile.color ??= 'blue';
  }

  /** Writes to disk shortly after the last change */
  save() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    }, 200);
  }

  getUser(username: string): UserRecord | undefined {
    return this.data.users[username.toLowerCase()];
  }

  createUser(username: string, password: string): UserRecord {
    if (this.getUser(username)) throw new Error('That username is taken');
    const salt = crypto.randomBytes(16).toString('hex');
    const user: UserRecord = {
      username,
      salt,
      hash: hashPassword(password, salt),
      tokens: [],
      profile: createDefaultProfile(username),
    };
    this.data.users[username.toLowerCase()] = user;
    this.save();
    return user;
  }

  checkPassword(user: UserRecord, password: string) {
    const a = Buffer.from(hashPassword(password, user.salt), 'hex');
    const b = Buffer.from(user.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  newToken(user: UserRecord) {
    const token = crypto.randomBytes(24).toString('hex');
    user.tokens = [...user.tokens.slice(-4), token]; // keep the last 5 devices logged in
    this.save();
    return token;
  }

  findByToken(token: string): UserRecord | undefined {
    return Object.values(this.data.users).find((u) => u.tokens.includes(token));
  }

  removeToken(token: string) {
    const user = this.findByToken(token);
    if (user) {
      user.tokens = user.tokens.filter((t) => t !== token);
      this.save();
    }
  }
}
