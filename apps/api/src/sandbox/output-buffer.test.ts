import { describe, expect, it } from 'vitest';
import { OutputBuffer } from './output-buffer';

describe('OutputBuffer', () => {
  it('keeps everything under the cap', () => {
    const buf = new OutputBuffer(10);
    expect(buf.push(Buffer.from('hello'))).toBe(true);
    expect(buf.push(Buffer.from('world'))).toBe(true);
    expect(buf.toString()).toBe('helloworld');
    expect(buf.truncated).toBe(false);
  });

  it('keeps exactly the first limit bytes and flags truncation', () => {
    const buf = new OutputBuffer(8);
    buf.push(Buffer.from('hello'));
    expect(buf.push(Buffer.from('world'))).toBe(false);
    expect(buf.toString()).toBe('hellowor');
    expect(buf.truncated).toBe(true);
    expect(buf.push(Buffer.from('more'))).toBe(false);
    expect(buf.toString()).toBe('hellowor');
  });
});
