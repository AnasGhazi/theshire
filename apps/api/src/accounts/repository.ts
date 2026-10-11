import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Db } from '../db/database';

export interface GoogleProfile {
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface User {
  id: string;
  learnerId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

interface UserRow {
  id: string;
  learner_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  learnerId: r.learner_id,
  email: r.email,
  name: r.name,
  avatarUrl: r.avatar_url,
});

/** Session tokens are stored only as hashes, so a leaked database can't be replayed as logins. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Accounts and sessions. Async, like ProgressRepository, so it can move to Postgres later. */
export interface AccountRepository {
  /**
   * Signs a Google user in from a browser whose anonymous learner is `anonLearnerId`. New users
   * adopt that learner's progress; returning users get it merged into their account.
   */
  signInWithGoogle(profile: GoogleProfile, anonLearnerId: string): Promise<User>;
  createSession(userId: string): Promise<string>;
  /** The signed-in user for a session token, or null if unknown or expired. */
  findSession(token: string): Promise<User | null>;
  deleteSession(token: string): Promise<void>;
}

export class SqliteAccountRepository implements AccountRepository {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async signInWithGoogle(profile: GoogleProfile, anonLearnerId: string): Promise<User> {
    const at = this.now().toISOString();
    return this.db.transaction(() => {
      const existing = this.db
        .prepare<[string], UserRow>('SELECT * FROM users WHERE google_sub = ?')
        .get(profile.sub);
      // An anonymous learner can only be claimed if no account owns it already.
      const anonIsFree = !this.db
        .prepare<[string], { id: string }>('SELECT id FROM users WHERE learner_id = ?')
        .get(anonLearnerId);

      if (existing) {
        this.db
          .prepare(
            'UPDATE users SET email = ?, name = ?, avatar_url = ?, last_login_at = ? WHERE id = ?',
          )
          .run(profile.email, profile.name, profile.picture, at, existing.id);
        if (anonIsFree && anonLearnerId !== existing.learner_id) {
          this.mergeLearner(anonLearnerId, existing.learner_id);
        }
        return toUser({
          ...existing,
          email: profile.email,
          name: profile.name,
          avatar_url: profile.picture,
        });
      }

      const learnerId = anonIsFree ? anonLearnerId : randomUUID();
      this.db
        .prepare('INSERT INTO learners (id, created_at) VALUES (?, ?) ON CONFLICT DO NOTHING')
        .run(learnerId, at);
      const row: UserRow = {
        id: randomUUID(),
        learner_id: learnerId,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.picture,
      };
      this.db
        .prepare(
          `INSERT INTO users (id, google_sub, email, name, avatar_url, learner_id, created_at, last_login_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(row.id, profile.sub, row.email, row.name, row.avatar_url, row.learner_id, at, at);
      return toUser(row);
    })();
  }

  async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = this.now();
    this.db
      .prepare(
        'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .run(
        hashToken(token),
        userId,
        now.toISOString(),
        new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      );
    return token;
  }

  async findSession(token: string): Promise<User | null> {
    const row = this.db
      .prepare<[string, string], UserRow>(
        `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
      )
      .get(hashToken(token), this.now().toISOString());
    return row ? toUser(row) : null;
  }

  async deleteSession(token: string): Promise<void> {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  /** Folds one learner's progress into another's: attempts add up, earliest timestamps win. */
  private mergeLearner(from: string, into: string) {
    this.db
      .prepare(
        `INSERT INTO exercise_progress (learner_id, exercise_id, attempts, passed_at)
         SELECT ?, exercise_id, attempts, passed_at FROM exercise_progress WHERE learner_id = ?
         ON CONFLICT (learner_id, exercise_id) DO UPDATE SET
           attempts = attempts + excluded.attempts,
           passed_at = CASE
             WHEN passed_at IS NULL THEN excluded.passed_at
             WHEN excluded.passed_at IS NULL THEN passed_at
             ELSE MIN(passed_at, excluded.passed_at)
           END`,
      )
      .run(into, from);
    this.db
      .prepare(
        `INSERT INTO lesson_progress (learner_id, lesson_id, completed_at)
         SELECT ?, lesson_id, completed_at FROM lesson_progress WHERE learner_id = ?
         ON CONFLICT (learner_id, lesson_id) DO UPDATE SET
           completed_at = MIN(completed_at, excluded.completed_at)`,
      )
      .run(into, from);
    this.db.prepare('DELETE FROM learners WHERE id = ?').run(from); // cascades its progress rows
  }
}
