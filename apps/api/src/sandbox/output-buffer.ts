/** Collects a stream's bytes up to a fixed cap, remembering whether anything was dropped. */
export class OutputBuffer {
  private readonly chunks: Buffer[] = [];
  private size = 0;
  truncated = false;

  constructor(private readonly limitBytes: number) {}

  /** Returns false once the cap has been exceeded. */
  push(chunk: Buffer): boolean {
    const room = this.limitBytes - this.size;
    if (chunk.length > room) {
      if (room > 0) this.chunks.push(chunk.subarray(0, room));
      this.size = this.limitBytes;
      this.truncated = true;
      return false;
    }
    this.chunks.push(chunk);
    this.size += chunk.length;
    return true;
  }

  toString(): string {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}
