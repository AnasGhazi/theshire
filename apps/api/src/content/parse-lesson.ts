import type { Code, Nodes } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import YAML from 'yaml';
import { z } from 'zod';
import type { Language } from '@theshire/shared';
import { ContentError } from './content-error';
import type { Exercise, InternalBlock, ParsedLesson } from './types';

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase-kebab-case');

const Frontmatter = z.strictObject({
  id: Slug,
  title: z.string().min(1),
  order: z.number().int().positive(),
});

const TestCases = z
  .array(
    z.strictObject({
      call: z.string().default(''),
      // YAML reads `expect: 6` as a number; outputs are always compared as text.
      expect: z.union([z.string(), z.number(), z.boolean()]).transform(String),
      hidden: z.boolean().default(false),
    }),
  )
  .min(1, 'needs at least one test')
  .max(10, 'allows at most 10 tests');

const LANGUAGE_ALIASES: Record<string, Language> = {
  python: 'python',
  py: 'python',
  javascript: 'javascript',
  js: 'javascript',
};

const ATTACHMENTS = ['tests', 'hint', 'solution'] as const;
type Attachment = (typeof ATTACHMENTS)[number];

type Fence =
  | { kind: 'runnable' | 'exercise'; language: Language; localId: string | null }
  | { kind: 'attachment'; attachment: Attachment; language: Language | null }
  | { kind: 'plain' };

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Parses a lesson file: YAML frontmatter, then Markdown in which fenced code blocks can be
 * flagged `runnable` or `exercise`. An exercise is followed directly by a `tests` fence and
 * optionally `hint` and `solution` fences. Unflagged fences stay in the Markdown as static code.
 *
 * Throws ContentError on anything malformed, so broken content fails at load time.
 */
export function parseLesson(source: string, file: string): ParsedLesson {
  const fm = FRONTMATTER.exec(source);
  if (!fm) throw new ContentError(file, 1, 'missing YAML frontmatter (--- ... ---)');
  const meta = parseYaml(fm[1] ?? '', file, 2);
  const front = Frontmatter.safeParse(meta);
  if (!front.success) {
    throw new ContentError(file, 1, `invalid frontmatter: ${z.prettifyError(front.error)}`);
  }
  const { id, title, order } = front.data;

  const body = source.slice(fm[0].length);
  const lineOffset = fm[0].split('\n').length - 1;
  const lineOf = (node: Nodes) => (node.position?.start.line ?? 0) + lineOffset;

  const blocks: InternalBlock[] = [];
  const exercises: Exercise[] = [];
  let current: { exercise: Exercise; line: number; seen: Set<Attachment> } | null = null;
  let cursor = 0;
  let runnableCount = 0;

  const finishExercise = () => {
    if (current && current.exercise.tests.length === 0) {
      throw new ContentError(file, current.line, 'exercise is missing a ```tests block after it');
    }
    current = null;
  };

  const tree = fromMarkdown(body);
  rejectNestedFlags(tree, file, lineOf);

  for (const node of tree.children) {
    if (node.type !== 'code') continue;
    const fence = classify(node, file, lineOf(node));
    if (fence.kind === 'plain') continue;

    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? start;
    const between = body.slice(cursor, start).trim();
    cursor = end;

    if (fence.kind === 'attachment') {
      if (!current || between) {
        throw new ContentError(
          file,
          lineOf(node),
          `\`\`\`${fence.attachment} must come directly after an \`\`\`exercise block`,
        );
      }
      attach(current, fence, node, file, lineOf(node));
      continue;
    }

    finishExercise();
    if (between) blocks.push({ type: 'markdown', markdown: between });

    if (fence.kind === 'runnable') {
      runnableCount++;
      blocks.push({
        type: 'runnable',
        id: `${id}.run${runnableCount}`,
        language: fence.language,
        code: node.value,
      });
    } else {
      const exerciseId = `${id}.${fence.localId ?? `ex${exercises.length + 1}`}`;
      if (exercises.some((e) => e.id === exerciseId)) {
        throw new ContentError(file, lineOf(node), `duplicate exercise id "${exerciseId}"`);
      }
      const exercise: Exercise = {
        id: exerciseId,
        lessonId: id,
        language: fence.language,
        starterCode: node.value,
        hint: null,
        solution: null,
        tests: [],
      };
      exercises.push(exercise);
      blocks.push({ type: 'exercise', exercise });
      current = { exercise, line: lineOf(node), seen: new Set() };
    }
  }
  finishExercise();

  const tail = body.slice(cursor).trim();
  if (tail) blocks.push({ type: 'markdown', markdown: tail });
  if (blocks.length === 0) throw new ContentError(file, undefined, 'lesson has no content');

  return { id, title, order, blocks, exercises };
}

function classify(node: Code, file: string, line: number): Fence {
  const lang = node.lang ?? '';
  const flags = (node.meta ?? '').split(/\s+/).filter(Boolean);

  if ((ATTACHMENTS as readonly string[]).includes(lang)) {
    if (flags.length > 0) throw new ContentError(file, line, `\`\`\`${lang} takes no flags`);
    return { kind: 'attachment', attachment: lang as Attachment, language: null };
  }
  if (flags.length === 0) return { kind: 'plain' };

  const language = LANGUAGE_ALIASES[lang];
  if (!language) {
    throw new ContentError(file, line, `unsupported language "${lang}" for a flagged code block`);
  }

  let kind: 'runnable' | 'exercise' | 'solution' | null = null;
  let localId: string | null = null;
  for (const flag of flags) {
    if (flag === 'runnable' || flag === 'exercise' || flag === 'solution') {
      if (kind) throw new ContentError(file, line, `conflicting flags "${kind}" and "${flag}"`);
      kind = flag;
    } else if (flag.startsWith('id=')) {
      const parsed = Slug.safeParse(flag.slice(3));
      if (!parsed.success)
        throw new ContentError(file, line, `invalid ${flag}: must be kebab-case`);
      localId = parsed.data;
    } else {
      throw new ContentError(file, line, `unknown code block flag "${flag}"`);
    }
  }
  if (!kind) throw new ContentError(file, line, 'flags need one of runnable, exercise, solution');
  if (localId && kind !== 'exercise') {
    throw new ContentError(file, line, 'id= is only allowed on exercise blocks');
  }
  if (kind === 'solution') return { kind: 'attachment', attachment: 'solution', language };
  return { kind, language, localId };
}

function attach(
  current: { exercise: Exercise; seen: Set<Attachment> },
  fence: Extract<Fence, { kind: 'attachment' }>,
  node: Code,
  file: string,
  line: number,
) {
  const { exercise, seen } = current;
  if (seen.has(fence.attachment)) {
    throw new ContentError(file, line, `exercise already has a \`\`\`${fence.attachment} block`);
  }
  seen.add(fence.attachment);

  switch (fence.attachment) {
    case 'tests': {
      const parsed = TestCases.safeParse(parseYaml(node.value, file, line + 1));
      if (!parsed.success) {
        throw new ContentError(file, line, `invalid tests: ${z.prettifyError(parsed.error)}`);
      }
      exercise.tests = parsed.data.map((t, i) => ({ id: `t${i + 1}`, ...t }));
      break;
    }
    case 'hint':
      exercise.hint = node.value.trim();
      break;
    case 'solution':
      if (fence.language && fence.language !== exercise.language) {
        throw new ContentError(file, line, `solution language must be ${exercise.language}`);
      }
      exercise.solution = node.value;
      break;
  }
}

function parseYaml(text: string, file: string, line: number): unknown {
  try {
    return YAML.parse(text);
  } catch (err) {
    throw new ContentError(file, line, `invalid YAML: ${(err as Error).message}`);
  }
}

/** Flags only work on top-level fences; one nested in a list or quote is almost surely a mistake. */
function rejectNestedFlags(tree: Nodes, file: string, lineOf: (node: Nodes) => number) {
  const visit = (node: Nodes, depth: number) => {
    if (node.type === 'code' && depth > 1) {
      const flagged =
        (ATTACHMENTS as readonly string[]).includes(node.lang ?? '') || Boolean(node.meta?.trim());
      if (flagged) {
        throw new ContentError(file, lineOf(node), 'flagged code blocks must be at the top level');
      }
    }
    if ('children' in node) for (const child of node.children) visit(child, depth + 1);
  };
  visit(tree, 0);
}
