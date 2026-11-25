import { addDays, localDate, zonedToUtc } from './time.js';

// A dose can be marked as taken from 1 hour before to 3 hours after its time.
// After that window it counts as missed.
export const WINDOW_BEFORE_MS = 60 * 60 * 1000;
export const WINDOW_AFTER_MS = 3 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 400;

export function doseKey(medicationId, at) {
  return `${String(medicationId)}|${new Date(at).toISOString()}`;
}

// Every scheduled dose of one medication with from <= at < to.
export function occurrences(medication, from, to, timeZone) {
  if (to - from > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    throw new Error(`Range too long (max ${MAX_RANGE_DAYS} days)`);
  }
  const times = [...medication.times].sort();
  const lastDay = localDate(to, timeZone);
  const result = [];

  for (let day = localDate(from, timeZone); day <= lastDay; day = addDays(day, 1)) {
    if (day < medication.startDate) continue;
    if (medication.endDate && day > medication.endDate) break;
    for (const time of times) {
      const at = zonedToUtc(day, time, timeZone);
      if (at >= from && at < to) {
        result.push({ medicationId: medication._id, patientId: medication.patientId, at, day, time });
      }
    }
  }
  return result;
}

export function isScheduledAt(medication, at, timeZone) {
  const instant = new Date(at);
  return occurrences(medication, instant, new Date(instant.getTime() + 1), timeZone).length === 1;
}

export function doseStatus(at, log, now) {
  if (log?.status === 'taken') return 'taken';
  const t = new Date(at).getTime();
  if (now.getTime() < t - WINDOW_BEFORE_MS) return 'upcoming';
  if (now.getTime() <= t + WINDOW_AFTER_MS) return 'due';
  return 'missed';
}

export function isInPatientWindow(at, now) {
  return doseStatus(at, null, now) === 'due';
}
