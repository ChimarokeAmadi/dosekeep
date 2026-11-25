import { doseKey, doseStatus } from './schedule.js';

// Below 80% adherence is the threshold most studies use for "non-adherent".
export const AT_RISK_THRESHOLD = 0.8;

export function indexLogs(logs) {
  return new Map(logs.map((log) => [doseKey(log.medicationId, log.scheduledFor), log]));
}

export function withStatus(occurrences, logsByKey, now) {
  return occurrences.map((occ) => ({
    ...occ,
    status: doseStatus(occ.at, logsByKey.get(doseKey(occ.medicationId, occ.at)), now),
  }));
}

// Only taken and missed doses count. "due" and "upcoming" doses are still open.
export function summarize(doses) {
  let taken = 0;
  let missed = 0;
  let open = 0;
  for (const dose of doses) {
    if (dose.status === 'taken') taken += 1;
    else if (dose.status === 'missed') missed += 1;
    else open += 1;
  }
  const counted = taken + missed;
  return { taken, missed, open, rate: counted === 0 ? null : taken / counted };
}

export function byDay(doses, days) {
  const groups = new Map(days.map((day) => [day, []]));
  for (const dose of doses) groups.get(dose.day)?.push(dose);
  return days.map((day) => ({ day, ...summarize(groups.get(day)) }));
}

export function isAtRisk(summary) {
  return summary.rate !== null && summary.rate < AT_RISK_THRESHOLD;
}

export function formatRate(rate) {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`;
}
