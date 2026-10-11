import { HealthResponse } from '@theshire/shared';

export const dynamic = 'force-dynamic';

async function getHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${process.env.API_URL ?? 'http://localhost:4000'}/api/health`, {
      cache: 'no-store',
    });
    return HealthResponse.parse(await res.json());
  } catch {
    return null;
  }
}

// Placeholder until M4 builds the real course UI.
export default async function Home() {
  const health = await getHealth();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-24">
      <h1 className="font-pixel text-4xl">The Shire</h1>
      <p className="text-shire-muted">Interactive coding lessons. Course catalog coming soon.</p>
      <div className="rounded-lg bg-shire-panel p-4 font-mono text-sm">
        <p>API: {health ? 'online' : 'unreachable'}</p>
        <p>Sandbox (Docker): {health?.docker.available ? 'available' : 'unavailable'}</p>
      </div>
    </main>
  );
}
