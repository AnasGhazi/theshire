import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateApiDocs } from '../src/docs/api-docs';

const target = join(import.meta.dirname, '../../../docs/api.md');
await writeFile(target, await generateApiDocs());
console.log(`wrote ${target}`);
