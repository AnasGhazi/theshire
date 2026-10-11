import { SqliteAccountRepository } from './accounts/repository';
import { buildApp } from './app';
import { GoogleAuth } from './auth/google';
import { loadConfig } from './config';
import { loadContent } from './content/load-content';
import { openDatabase } from './db/database';
import { probeDocker } from './docker';
import { startCleanupJob } from './sandbox/cleanup';
import { SqliteProgressRepository } from './progress/repository';
import { DockerRunner } from './sandbox/docker-runner';
import { ConcurrencyLimiter, limitRunner } from './sandbox/limiter';

const config = loadConfig();
// Throws on any malformed lesson, so broken content stops startup rather than a request.
const content = await loadContent(config.coursesDir);
const db = openDatabase(config.databasePath);
const dockerRunner = new DockerRunner(config.sandbox);
const limiter = new ConcurrencyLimiter(config.sandbox.maxConcurrent, config.sandbox.maxQueue);

const app = await buildApp({
  logger: { level: config.logLevel },
  settings: config.app,
  deps: {
    probeDocker,
    runner: limitRunner(dockerRunner, limiter),
    content,
    progress: new SqliteProgressRepository(db),
    accounts: new SqliteAccountRepository(db),
    google: config.google && new GoogleAuth(config.google),
  },
});
app.log.info({ courses: content.courses.length, dir: config.coursesDir }, 'loaded course content');
app.log.info(
  config.google
    ? { redirectUri: config.google.redirectUri }
    : { hint: 'set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it' },
  config.google ? 'google sign-in enabled' : 'google sign-in disabled',
);

const stopCleanup = startCleanupJob({
  intervalMs: config.sandbox.cleanupIntervalMs,
  onRemoved: (ids) => app.log.warn({ count: ids.length }, 'removed orphaned sandbox containers'),
  onError: (err) => app.log.error({ err }, 'sandbox cleanup failed'),
});

app.addHook('onClose', async () => {
  stopCleanup();
  await dockerRunner.killAll();
  db.close();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.host, port: config.port });
