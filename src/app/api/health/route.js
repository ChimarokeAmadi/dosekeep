import { getDb } from '@/lib/db';

// Used by the uptime check and the deploy smoke test.
export async function GET() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return Response.json({ status: 'ok', database: 'up', time: new Date().toISOString() });
  } catch (error) {
    console.error('health check failed', error);
    return Response.json({ status: 'error', database: 'down' }, { status: 503 });
  }
}
