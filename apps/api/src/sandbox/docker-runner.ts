import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { RunRequest, RunResult } from '@theshire/shared';
import { AppError } from '../errors';
import { docker, dockerEnv } from './docker-cli';
import { buildDockerCreateArgs } from './docker-args';
import { OutputBuffer } from './output-buffer';
import type { Runner, SandboxOptions } from './types';

/** How long past the wall-clock limit a container may live before cleanup treats it as orphaned. */
const EXPIRY_GRACE_MS = 30_000;
/** How long to wait for the docker client to exit after the container is killed. */
const CLIENT_EXIT_GRACE_MS = 3000;

type KillReason = 'timeout' | 'output';

interface ContainerState {
  ExitCode: number;
  OOMKilled: boolean;
}

const unavailable = (cause: unknown) =>
  new AppError(503, 'SANDBOX_UNAVAILABLE', 'Code execution is unavailable.', { cause });

/**
 * Runs each request in a fresh, locked-down Docker container that is removed afterwards.
 *
 * Creating and starting are separate steps so that anything the docker client itself prints
 * (warnings, errors) comes from `create`, and the attached `start` stream carries only the
 * program's own stdout and stderr.
 */
export class DockerRunner implements Runner {
  private readonly active = new Set<string>();

  constructor(private readonly options: SandboxOptions) {}

  async run({ language, code }: RunRequest): Promise<RunResult> {
    const { limits, images } = this.options;
    const name = `theshire-run-${randomUUID()}`;

    this.active.add(name);
    try {
      await docker(
        buildDockerCreateArgs({
          name,
          image: images[language],
          limits,
          expiresAt: Date.now() + limits.timeoutMs + EXPIRY_GRACE_MS,
        }),
      ).catch((err: unknown) => {
        throw unavailable(err);
      });

      return await this.attach(name, code);
    } finally {
      await docker(['rm', '--force', name]).catch(() => {});
      this.active.delete(name);
    }
  }

  /** Force-removes every container this runner currently has in flight. */
  async killAll(): Promise<void> {
    await Promise.all(
      [...this.active].map((name) => docker(['rm', '--force', name]).catch(() => {})),
    );
  }

  /** Starts the created container, streams in the code, and enforces time and output limits. */
  private async attach(name: string, code: string): Promise<RunResult> {
    const { limits } = this.options;
    const stdout = new OutputBuffer(limits.outputLimitBytes);
    const stderr = new OutputBuffer(limits.outputLimitBytes);
    let killReason: KillReason | null = null;
    let wallClock: NodeJS.Timeout | undefined;
    let clientGrace: NodeJS.Timeout | undefined;

    const env = await dockerEnv();
    const started = performance.now();
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('docker', ['start', '--attach', '--interactive', name], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env,
        });

        const kill = (reason: KillReason) => {
          if (killReason) return;
          killReason = reason;
          // If this fails the container is already gone; `rm --force` in run() covers the rest.
          void docker(['kill', name]).catch(() => {});
          clientGrace = setTimeout(() => child.kill('SIGKILL'), CLIENT_EXIT_GRACE_MS);
        };

        wallClock = setTimeout(() => kill('timeout'), limits.timeoutMs);
        child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk) || kill('output'));
        child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk) || kill('output'));
        child.once('error', reject);
        child.once('close', () => resolve());

        // The program may exit without reading stdin; a broken pipe here is expected.
        child.stdin.on('error', () => {});
        child.stdin.end(code);
      });
    } catch (err) {
      throw unavailable(err);
    } finally {
      clearTimeout(wallClock);
      clearTimeout(clientGrace);
    }
    const durationMs = Math.round(performance.now() - started);

    const state = await this.inspect(name);
    if (!state) throw unavailable(new Error(`container ${name} vanished before inspection`));

    const reason = killReason as KillReason | null;
    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      exitCode: reason ? null : state.ExitCode,
      timedOut: reason === 'timeout',
      // A SIGKILL we didn't send can only come from the kernel's OOM killer: PID 1 in the
      // container ignores signals sent from inside its own namespace.
      oomKilled: !reason && (state.OOMKilled || state.ExitCode === 137),
      truncated: stdout.truncated || stderr.truncated,
      durationMs,
    };
  }

  private async inspect(name: string): Promise<ContainerState | null> {
    try {
      const state = await docker(['inspect', '--format', '{{json .State}}', name]);
      return JSON.parse(state) as ContainerState;
    } catch {
      return null;
    }
  }
}
