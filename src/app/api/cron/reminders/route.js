import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';
import { safeEqual } from '@/lib/tokens';
import { createSmsSender } from '@/lib/sms';
import { runReminders } from '@/services/reminders';

export const maxDuration = 60;

// Called every 15 minutes by the GitHub Actions schedule (.github/workflows/reminders.yml)
// and once a day by Vercel Cron as a backup. Both send "Authorization: Bearer <CRON_SECRET>".
async function handle(request) {
  const { cronSecret, sms } = getConfig();
  const header = request.headers.get('authorization') ?? '';
  if (!cronSecret || !safeEqual(header, `Bearer ${cronSecret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  const counts = await runReminders(await getDb(), createSmsSender(sms));
  return Response.json({ ok: true, ...counts, ms: Date.now() - started });
}

export const GET = handle;
export const POST = handle;
