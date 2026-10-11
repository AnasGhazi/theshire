/** A problem in authored course content, pointing at the file and line to fix. */
export class ContentError extends Error {
  constructor(file: string, line: number | undefined, message: string) {
    super(`${file}${line ? `:${line}` : ''}: ${message}`);
    this.name = 'ContentError';
  }
}
