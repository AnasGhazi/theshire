import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { loadContent } from './load-content';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true })));
});

/** Writes a courses folder from { "slug/file": contents }. */
async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'theshire-content-'));
  dirs.push(root);
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  return root;
}

const courseJson = (language = 'python') =>
  JSON.stringify({ title: 'Course', description: 'About', language });
const lessonMd = (id: string, order: number) =>
  `---\nid: ${id}\ntitle: ${id}\norder: ${order}\n---\nHi`;

describe('loadContent', () => {
  it('loads the real course content without errors', async () => {
    const content = await loadContent(loadConfig({}).coursesDir);
    expect(content.courses.map((c) => c.slug)).toEqual(['python-basics', 'javascript-basics']);
    for (const course of content.courses) {
      expect(course.lessons.length).toBeGreaterThanOrEqual(4);
      for (const lesson of course.lessons) {
        for (const exercise of lesson.exercises) {
          expect(exercise.solution, `${exercise.id} needs a reference solution`).not.toBeNull();
          expect(exercise.hint, `${exercise.id} needs a hint`).not.toBeNull();
        }
      }
    }
    const exercises = content.courses.flatMap((c) => c.lessons.flatMap((l) => l.exercises));
    expect(exercises.length).toBeGreaterThanOrEqual(3);
  });

  it('orders lessons by frontmatter order, not filename', async () => {
    const root = await fixture({
      'c/course.json': courseJson(),
      'c/a.md': lessonMd('second', 2),
      'c/b.md': lessonMd('first', 1),
    });
    const content = await loadContent(root);
    expect(content.getCourse('c')?.lessons.map((l) => l.id)).toEqual(['first', 'second']);
    expect(content.getLesson('second')?.index).toBe(1);
  });

  it('reports every problem across files at once', async () => {
    const root = await fixture({
      'a/course.json': '{ not json',
      'b/course.json': JSON.stringify({ title: 'B', description: 'B', language: 'cobol' }),
      'c/course.json': courseJson(),
      'c/1.md': lessonMd('same-id', 1),
      'c/2.md': lessonMd('same-id', 2),
      'c/3.md': lessonMd('other', 1),
      'c/4.md': '# no frontmatter',
      'd/course.json': courseJson('javascript'),
      'd/1.md': `---\nid: py-in-js\ntitle: x\norder: 1\n---\n\`\`\`python exercise\nx\n\`\`\`\n\n\`\`\`tests\n- expect: 1\n\`\`\``,
      'e/course.json': courseJson(),
    });

    const error = await loadContent(root).then(
      () => null,
      (err: Error) => err.message,
    );
    expect(error).toMatch(/^Invalid course content \(7\):/);
    expect(error).toMatch(/a[/\\]course\.json: .*JSON/);
    expect(error).toMatch(/b[/\\]course\.json: ✖ Invalid option.*\n\s*→ at language/);
    expect(error).toMatch(/c[/\\]2\.md:1: lesson id "same-id" also used in .*1\.md/);
    expect(error).toMatch(/c[/\\]3\.md:1: order 1 also used by "same-id"/);
    expect(error).toMatch(/c[/\\]4\.md:1: missing YAML frontmatter/);
    expect(error).toMatch(/exercise py-in-js\.ex1 must be javascript/);
    expect(error).toMatch(/e: course has no lessons/);
  });
});
