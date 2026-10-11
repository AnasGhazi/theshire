import type { Progress } from '@theshire/shared';
import type { Db } from '../db/database';

/**
 * Learner progress storage. Async so a networked database (e.g. Postgres) can replace SQLite
 * without changing callers.
 */
export interface ProgressRepository {
  recordAttempt(learnerId: string, exerciseId: string, passed: boolean): Promise<void>;
  /** Idempotent: completing an already-completed lesson keeps the original timestamp. */
  completeLesson(learnerId: string, lessonId: string): Promise<void>;
  getProgress(learnerId: string): Promise<Progress>;
}

export class SqliteProgressRepository implements ProgressRepository {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recordAttempt(learnerId: string, exerciseId: string, passed: boolean): Promise<void> {
    const at = this.now().toISOString();
    this.db.transaction(() => {
      this.ensureLearner(learnerId, at);
      this.db
        .prepare(
          `INSERT INTO exercise_progress (learner_id, exercise_id, attempts, passed_at)
           VALUES (?, ?, 1, ?)
           ON CONFLICT (learner_id, exercise_id) DO UPDATE SET
             attempts = attempts + 1,
             passed_at = COALESCE(passed_at, excluded.passed_at)`,
        )
        .run(learnerId, exerciseId, passed ? at : null);
    })();
  }

  async completeLesson(learnerId: string, lessonId: string): Promise<void> {
    const at = this.now().toISOString();
    this.db.transaction(() => {
      this.ensureLearner(learnerId, at);
      this.db
        .prepare(
          `INSERT INTO lesson_progress (learner_id, lesson_id, completed_at) VALUES (?, ?, ?)
           ON CONFLICT DO NOTHING`,
        )
        .run(learnerId, lessonId, at);
    })();
  }

  async getProgress(learnerId: string): Promise<Progress> {
    const completedLessons = this.db
      .prepare<[string], { lessonId: string; completedAt: string }>(
        `SELECT lesson_id AS lessonId, completed_at AS completedAt FROM lesson_progress
         WHERE learner_id = ? ORDER BY completed_at, lesson_id`,
      )
      .all(learnerId);
    const exercises = this.db
      .prepare<[string], { exerciseId: string; attempts: number; passedAt: string | null }>(
        `SELECT exercise_id AS exerciseId, attempts, passed_at AS passedAt FROM exercise_progress
         WHERE learner_id = ? ORDER BY exercise_id`,
      )
      .all(learnerId);
    return { completedLessons, exercises };
  }

  private ensureLearner(learnerId: string, at: string) {
    this.db
      .prepare('INSERT INTO learners (id, created_at) VALUES (?, ?) ON CONFLICT DO NOTHING')
      .run(learnerId, at);
  }
}
