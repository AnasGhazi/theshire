import { describe, expect, it } from 'vitest';
import { parseLesson } from './parse-lesson';

const lesson = (body: string, front = 'id: demo-01\ntitle: Demo\norder: 1') =>
  `---\n${front}\n---\n${body}`;

const fence = (info: string, value: string) => `\`\`\`${info}\n${value}\n\`\`\``;

const EXERCISE = [
  'Intro text.',
  fence('python exercise', 'def f():\n    pass'),
  fence(
    'tests',
    '- call: print(f())\n  expect: 1\n- call: print(f() + 1)\n  expect: "2"\n  hidden: true\n  strict: true',
  ),
  fence('hint', 'Return **1**.'),
  fence('python solution', 'def f():\n    return 1'),
  'Outro.',
].join('\n\n');

describe('parseLesson', () => {
  it('splits Markdown, runnable, and exercise blocks in order', () => {
    const parsed = parseLesson(
      lesson(
        [
          '# Title',
          fence('python runnable', 'print(1)'),
          'Static code stays in Markdown:',
          fence('python', 'print("static")'),
          EXERCISE,
        ].join('\n\n'),
      ),
      'demo.md',
    );

    expect(parsed).toMatchObject({ id: 'demo-01', title: 'Demo', order: 1 });
    expect(parsed.blocks.map((b) => b.type)).toEqual([
      'markdown',
      'runnable',
      'markdown',
      'exercise',
      'markdown',
    ]);
    expect(parsed.blocks[0]).toEqual({ type: 'markdown', markdown: '# Title' });
    expect(parsed.blocks[1]).toEqual({
      type: 'runnable',
      id: 'demo-01.run1',
      language: 'python',
      code: 'print(1)',
    });
    expect(parsed.blocks[2]).toEqual({
      type: 'markdown',
      markdown: 'Static code stays in Markdown:\n\n```python\nprint("static")\n```\n\nIntro text.',
    });
    expect(parsed.blocks[4]).toEqual({ type: 'markdown', markdown: 'Outro.' });
  });

  it('attaches tests, hint, and solution to the exercise', () => {
    const [exercise] = parseLesson(lesson(EXERCISE), 'demo.md').exercises;
    expect(exercise).toEqual({
      id: 'demo-01.ex1',
      lessonId: 'demo-01',
      language: 'python',
      starterCode: 'def f():\n    pass',
      hint: 'Return **1**.',
      solution: 'def f():\n    return 1',
      tests: [
        { id: 't1', call: 'print(f())', expect: '1', hidden: false, strict: false },
        { id: 't2', call: 'print(f() + 1)', expect: '2', hidden: true, strict: true },
      ],
    });
  });

  it('uses explicit exercise ids and language aliases', () => {
    const parsed = parseLesson(
      lesson([fence('js exercise id=sum-up', 'x'), fence('tests', '- expect: ok')].join('\n\n')),
      'demo.md',
    );
    expect(parsed.exercises[0]).toMatchObject({ id: 'demo-01.sum-up', language: 'javascript' });
    expect(parsed.exercises[0]?.tests[0]).toEqual({
      id: 't1',
      call: '',
      expect: 'ok',
      hidden: false,
      strict: false,
    });
  });

  it('reports file and line for problems in the body', () => {
    const source = lesson(['line one', '', fence('python runable', 'x')].join('\n'));
    expect(() => parseLesson(source, 'demo.md')).toThrow(
      'demo.md:8: unknown code block flag "runable"',
    );
  });

  describe('rejects malformed input', () => {
    it.each([
      ['no frontmatter', '# Just markdown', /missing YAML frontmatter/],
      ['unterminated frontmatter', '---\nid: x\n# body', /missing YAML frontmatter/],
      ['bad YAML frontmatter', lesson('hi', 'id: [unclosed'), /invalid YAML/],
      ['missing title', lesson('hi', 'id: demo\norder: 1'), /title/],
      ['non-kebab id', lesson('hi', 'id: Demo_One\ntitle: x\norder: 1'), /kebab-case/],
      ['unknown frontmatter key', lesson('hi', 'id: d\ntitle: x\norder: 1\nauthor: me'), /author/],
      ['zero order', lesson('hi', 'id: d\ntitle: x\norder: 0'), /order/],
      ['empty body', lesson(''), /no content/],
      [
        'unsupported language',
        lesson(fence('ruby runnable', 'puts 1')),
        /unsupported language "ruby"/,
      ],
      ['conflicting flags', lesson(fence('python runnable exercise', 'x')), /conflicting flags/],
      ['id on runnable', lesson(fence('python runnable id=x', 'x')), /only allowed on exercise/],
      ['exercise without tests', lesson(fence('python exercise', 'x')), /missing a ```tests block/],
      [
        'exercise followed by text then tests',
        lesson([fence('python exercise', 'x'), 'oops', fence('tests', '- expect: 1')].join('\n\n')),
        /must come directly after/,
      ],
      ['orphan tests', lesson(fence('tests', '- expect: 1')), /must come directly after/],
      [
        'duplicate tests',
        lesson(
          [
            fence('python exercise', 'x'),
            fence('tests', '- expect: 1'),
            fence('tests', '- expect: 2'),
          ].join('\n\n'),
        ),
        /already has a ```tests/,
      ],
      [
        'tests not a list',
        lesson([fence('python exercise', 'x'), fence('tests', 'expect: 1')].join('\n\n')),
        /invalid tests/,
      ],
      [
        'empty tests',
        lesson([fence('python exercise', 'x'), fence('tests', '[]')].join('\n\n')),
        /at least one test/,
      ],
      [
        'typo in test key',
        lesson(
          [fence('python exercise', 'x'), fence('tests', '- call: f()\n  expected: 1')].join(
            '\n\n',
          ),
        ),
        /expected/,
      ],
      [
        'invalid YAML in tests',
        lesson([fence('python exercise', 'x'), fence('tests', '- call: [oops')].join('\n\n')),
        /invalid YAML/,
      ],
      [
        'solution in another language',
        lesson(
          [
            fence('python exercise', 'x'),
            fence('tests', '- expect: 1'),
            fence('js solution', 'y'),
          ].join('\n\n'),
        ),
        /solution language must be python/,
      ],
      [
        'duplicate exercise ids',
        lesson(
          [
            fence('python exercise id=a', 'x'),
            fence('tests', '- expect: 1'),
            fence('python exercise id=a', 'y'),
            fence('tests', '- expect: 1'),
          ].join('\n\n'),
        ),
        /duplicate exercise id "demo-01.a"/,
      ],
      [
        'flagged fence nested in a list',
        lesson(`- item\n\n  ${fence('python runnable', 'x').replaceAll('\n', '\n  ')}`),
        /top level/,
      ],
    ])('%s', (_label, source, error) => {
      expect(() => parseLesson(source, 'demo.md')).toThrow(error);
    });
  });
});
