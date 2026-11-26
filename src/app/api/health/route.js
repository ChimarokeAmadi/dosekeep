import { getDb } from '@/lib/db';

// Used by the uptime check and the deploy smoke test.
export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    // commit: the Git commit this deployment was built from (set by Vercel), so the
    // smoke test can wait until the new version is actually live.
    return Response.json({
      status: 'ok',
      database: 'up',
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('health check failed', error);
    return Response.json({ status: 'error', database: 'down' }, { status: 503 });
  }
}
