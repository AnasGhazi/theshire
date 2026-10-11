/** Append-only: never edit a migration that has shipped, add a new one instead. */
export const migrations: ReadonlyArray<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: 'learners and progress',
    sql: `
      CREATE TABLE learners (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      );
      CREATE TABLE exercise_progress (
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        passed_at TEXT,
        PRIMARY KEY (learner_id, exercise_id)
      );
      CREATE TABLE lesson_progress (
        learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        PRIMARY KEY (learner_id, lesson_id)
      );
    `,
  },
  {
    version: 2,
    name: 'google accounts and sessions',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        email TEXT,
        name TEXT,
        avatar_url TEXT,
        learner_id TEXT NOT NULL UNIQUE REFERENCES learners(id),
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user ON sessions(user_id);
    `,
  },
];
