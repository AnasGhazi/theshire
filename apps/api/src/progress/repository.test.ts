import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '../db/database';
import { SqliteProgressRepository } from './repository';

function repo() {
  let t = Date.parse('2026-01-01T00:00:00Z');
  const clock = () => new Date((t += 1000));
  return new SqliteProgressRepository(openDatabase(':memory:'), clock);
}

describe('SqliteProgressRepository', () => {
  it('starts empty for an unknown learner', async () => {
    expect(await repo().getProgress('nobody')).toEqual({ completedLessons: [], exercises: [] });
  });

  it('counts attempts and keeps the first pass time', async () => {
    const r = repo();
    await r.recordAttempt('a', 'ex1', false);
    await r.recordAttempt('a', 'ex1', true);
    await r.recordAttempt('a', 'ex1', true);
    await r.recordAttempt('a', 'ex1', false);

    expect((await r.getProgress('a')).exercises).toEqual([
      { exerciseId: 'ex1', attempts: 4, passedAt: '2026-01-01T00:00:02.000Z' },
    ]);
  });

  it('completes lessons idempotently and keeps learners separate', async () => {
    const r = repo();
    await r.completeLesson('a', 'l1');
    await r.completeLesson('a', 'l1');
    await r.recordAttempt('b', 'ex1', true);

    expect((await r.getProgress('a')).completedLessons).toEqual([
      { lessonId: 'l1', completedAt: '2026-01-01T00:00:01.000Z' },
    ]);
    expect(await r.getProgress('b')).toMatchObject({ completedLessons: [] });
  });
});

describe('migrations', () => {
  it('apply once and are skipped on re-run', () => {
    const db = openDatabase(':memory:');
    expect(migrate(db)).toEqual([]);
    const versions = db.prepare('SELECT version FROM schema_migrations').all();
    expect(versions).toEqual([{ version: 1 }]);
  });
});
