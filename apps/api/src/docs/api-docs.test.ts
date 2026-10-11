import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, generateApiDocs } from './api-docs';

const DOCS = join(import.meta.dirname, '../../../../docs/api.md');
const SRC = join(import.meta.dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe('docs/api.md', () => {
  it('matches the schemas registered on the routes (run `npm run docs:api` to update)', async () => {
    expect(readFileSync(DOCS, 'utf8')).toBe(await generateApiDocs());
  });

  it('documents every error code the API can return', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      for (const m of readFileSync(file, 'utf8').matchAll(
        /AppError\(\s*\d+,\s*'([A-Z_]+)'|errorBody\('([A-Z_]+)'/g,
      )) {
        used.add((m[1] ?? m[2])!);
      }
    }
    expect(used.size).toBeGreaterThan(5);
    expect([...used].filter((code) => !(code in ERROR_CODES))).toEqual([]);
  });
});
