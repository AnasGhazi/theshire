import { buildApp } from './app';
import { loadConfig } from './config';
import { probeDocker } from './docker';

const config = loadConfig();
const app = await buildApp({ logger: { level: config.LOG_LEVEL }, probeDocker });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.HOST, port: config.PORT });
