import { getDb } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { logDose } from '@/services/doses';
import { findByPortalToken } from '@/services/patients';

// POST /api/portal/<token>/doses  { "medicationId": "...", "at": "2026-11-24T07:00:00.000Z" }
// The private token in the URL identifies the patient. Patients don't need a password.
export async function POST(request, { params }) {
  const { token } = await params;
  const db = await getDb();
  const found = await findByPortalToken(db, token);
  if (!found) return Response.json({ error: 'This link is not valid any more. Ask your clinic for a new one.' }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Send JSON with medicationId and at' }, { status: 400 });
  }

  try {
    const result = await logDose(db, { ...found, medicationId: body?.medicationId, at: body?.at, source: 'patient' });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AppError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    console.error(error);
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
