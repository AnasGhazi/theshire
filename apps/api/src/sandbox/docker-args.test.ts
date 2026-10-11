import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { buildDockerCreateArgs, SANDBOX_USER } from './docker-args';

const { limits } = loadConfig({}).sandbox;
const args = buildDockerCreateArgs({ name: 'run-1', image: 'img:latest', limits, expiresAt: 42 });

/** Returns the value following a flag, e.g. `--memory 128m`. */
const flag = (name: string) => args[args.indexOf(name) + 1];

// These pin the security posture from PLAN.md section 6. If one fails, the sandbox got weaker:
// fix the code, don't loosen the test.
describe('buildDockerCreateArgs', () => {
  it('uses the documented default limits', () => {
    expect(limits).toEqual({
      timeoutMs: 5000,
      memoryMb: 128,
      cpus: 0.5,
      pidsLimit: 64,
      tmpfsMb: 16,
      outputLimitBytes: 64 * 1024,
    });
  });

  it('disables networking', () => {
    expect(flag('--network')).toBe('none');
  });

  it('caps memory with no extra swap', () => {
    expect(flag('--memory')).toBe('128m');
    expect(flag('--memory-swap')).toBe('128m');
  });

  it('caps CPU and process count', () => {
    expect(flag('--cpus')).toBe('0.5');
    expect(flag('--pids-limit')).toBe('64');
  });

  it('uses a read-only root with a small, non-executable /tmp', () => {
    expect(args).toContain('--read-only');
    expect(flag('--tmpfs')).toBe('/tmp:rw,nosuid,nodev,noexec,size=16m');
  });

  it('drops all capabilities and privilege escalation, and runs as non-root', () => {
    expect(flag('--cap-drop')).toBe('ALL');
    expect(flag('--security-opt')).toBe('no-new-privileges');
    expect(flag('--user')).toBe(SANDBOX_USER);
    expect(SANDBOX_USER).not.toMatch(/^0[:]?/);
  });

  it('never pulls images at run time', () => {
    expect(flag('--pull')).toBe('never');
  });

  it('labels the container for orphan cleanup and puts the image last', () => {
    expect(args).toContain('theshire.sandbox=1');
    expect(args).toContain('theshire.expires=42');
    expect(args.at(-1)).toBe('img:latest');
  });

  it('never mounts host paths or passes host environment', () => {
    for (const forbidden of [
      '-v',
      '--volume',
      '--mount',
      '-e',
      '--env',
      '--env-file',
      '--privileged',
    ]) {
      expect(args).not.toContain(forbidden);
    }
  });
});
