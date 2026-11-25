import { isDuplicateKey } from '../lib/db.js';

// Every SMS goes through here. The unique `key` makes sending idempotent: if two
// reminder runs overlap, only the first one to insert the key sends the message.
// `storedBody` lets us keep a version without secrets (the portal link) in the database.
export async function sendMessage(db, sender, { key, clinicId, patientId, kind, to, body, storedBody = body, now = new Date() }) {
  const reminders = db.collection('reminders');
  let id;
  try {
    ({ insertedId: id } = await reminders.insertOne({
      key, clinicId, patientId, kind, to, body: storedBody, status: 'pending', provider: sender.provider, createdAt: now,
    }));
  } catch (error) {
    if (isDuplicateKey(error)) return 'duplicate';
    throw error;
  }

  try {
    const { id: providerId } = await sender.send({ to, body });
    await reminders.updateOne({ _id: id }, { $set: { status: 'sent', providerId, sentAt: new Date() } });
    return 'sent';
  } catch (error) {
    await reminders.updateOne({ _id: id }, { $set: { status: 'failed', error: String(error.message).slice(0, 300) } });
    return 'failed';
  }
}

export async function listMessages(db, clinicId, { limit = 100 } = {}) {
  return db
    .collection('reminders')
    .aggregate([
      { $match: { clinicId } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'patient', pipeline: [{ $project: { name: 1 } }] } },
      { $set: { patientName: { $first: '$patient.name' } } },
      { $project: { patient: 0 } },
    ])
    .toArray();
}
