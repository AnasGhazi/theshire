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
];
