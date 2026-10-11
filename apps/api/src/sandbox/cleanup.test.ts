import { describe, expect, it, vi } from 'vitest';
import { removeExpiredContainers } from './cleanup';

describe('removeExpiredContainers', () => {
  it('removes only containers whose expiry has passed or is missing', async () => {
    const docker = vi.fn(async (args: string[]) =>
      args[0] === 'ps' ? 'aaa 1000\nbbb 3000\nccc \nddd garbage\n' : '',
    );

    const removed = await removeExpiredContainers(2000, docker);

    expect(removed).toEqual(['aaa', 'ccc', 'ddd']);
    expect(docker).toHaveBeenLastCalledWith(['rm', '--force', 'aaa', 'ccc', 'ddd']);
  });

  it('does nothing when there are no expired containers', async () => {
    const docker = vi.fn(async () => 'bbb 3000\n');
    expect(await removeExpiredContainers(2000, docker)).toEqual([]);
    expect(docker).toHaveBeenCalledTimes(1);
  });
});
