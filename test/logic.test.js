import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, localDate, localTime, zonedToUtc } from '../src/lib/time.js';
import { doseStatus, isInPatientWindow, isScheduledAt, occurrences } from '../src/lib/schedule.js';
import { byDay, formatRate, indexLogs, isAtRisk, summarize, withStatus } from '../src/lib/adherence.js';

const LAGOS = 'Africa/Lagos';
const med = { _id: 'm1', patientId: 'p1', times: ['20:00', '08:00'], startDate: '2026-11-20', endDate: '2026-11-22' };

test('local clinic time is converted to UTC, including daylight saving', () => {
  assert.equal(zonedToUtc('2026-11-24', '08:00', LAGOS).toISOString(), '2026-11-24T07:00:00.000Z');
  assert.equal(zonedToUtc('2026-01-15', '09:00', 'Europe/London').toISOString(), '2026-01-15T09:00:00.000Z');
  assert.equal(zonedToUtc('2026-07-15', '09:00', 'Europe/London').toISOString(), '2026-07-15T08:00:00.000Z');
  assert.equal(localDate(new Date('2026-11-24T23:30:00Z'), LAGOS), '2026-11-25');
  assert.equal(localTime(new Date('2026-11-24T23:30:00Z'), LAGOS), '00:30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('occurrences lists every dose between the start and end dates, in order', () => {
  const doses = occurrences(med, new Date('2026-11-18T00:00:00Z'), new Date('2026-11-30T00:00:00Z'), LAGOS);
  assert.deepEqual(
    doses.map((d) => `${d.day} ${d.time}`),
    ['2026-11-20 08:00', '2026-11-20 20:00', '2026-11-21 08:00', '2026-11-21 20:00', '2026-11-22 08:00', '2026-11-22 20:00'],
  );
  assert.equal(doses[0].at.toISOString(), '2026-11-20T07:00:00.000Z');
});

test('occurrences respects the exact range and a medication with no end date', () => {
  const open = { ...med, endDate: undefined };
  const doses = occurrences(open, new Date('2026-11-21T07:00:00Z'), new Date('2026-11-21T19:00:00Z'), LAGOS);
  assert.deepEqual(doses.map((d) => d.time), ['08:00']); // 'to' is exclusive, 20:00 Lagos = 19:00Z
  assert.throws(() => occurrences(open, new Date('2020-01-01'), new Date('2026-01-01'), LAGOS), /Range too long/);
});

test('isScheduledAt only accepts real dose times', () => {
  assert.equal(isScheduledAt(med, '2026-11-21T07:00:00.000Z', LAGOS), true);
  assert.equal(isScheduledAt(med, '2026-11-21T07:05:00.000Z', LAGOS), false);
  assert.equal(isScheduledAt(med, '2026-11-25T07:00:00.000Z', LAGOS), false); // after the end date
});

test('a dose is upcoming, then due for 1 hour before to 3 hours after, then missed', () => {
  const dose = new Date('2026-11-21T07:00:00Z');
  assert.equal(doseStatus(dose, null, new Date('2026-11-21T05:59:00Z')), 'upcoming');
  assert.equal(doseStatus(dose, null, new Date('2026-11-21T06:00:00Z')), 'due');
  assert.equal(doseStatus(dose, null, new Date('2026-11-21T10:00:00Z')), 'due');
  assert.equal(doseStatus(dose, null, new Date('2026-11-21T10:01:00Z')), 'missed');
  assert.equal(doseStatus(dose, { status: 'taken' }, new Date('2026-11-23T00:00:00Z')), 'taken');
  assert.equal(isInPatientWindow(dose, new Date('2026-11-21T10:30:00Z')), false);
});

test('adherence counts taken against taken + missed, and ignores open doses', () => {
  const doses = occurrences(med, new Date('2026-11-20T00:00:00Z'), new Date('2026-11-23T00:00:00Z'), LAGOS);
  const logs = indexLogs([
    { medicationId: 'm1', scheduledFor: new Date('2026-11-20T07:00:00Z') },
    { medicationId: 'm1', scheduledFor: new Date('2026-11-20T19:00:00Z') },
    { medicationId: 'm1', scheduledFor: new Date('2026-11-21T07:00:00Z') },
  ].map((l) => ({ ...l, status: 'taken' })));
  const now = new Date('2026-11-22T08:00:00Z'); // 09:00 in Lagos on the 22nd
  const withStatuses = withStatus(doses, logs, now);
  assert.deepEqual(summarize(withStatuses), { taken: 3, missed: 1, open: 2, rate: 0.75 });
  assert.deepEqual(
    byDay(withStatuses, ['2026-11-20', '2026-11-21', '2026-11-22']).map((d) => d.rate),
    [1, 0.5, null],
  );
  assert.equal(isAtRisk(summarize(withStatuses)), true);
  assert.equal(isAtRisk({ rate: null }), false);
  assert.equal(formatRate(0.756), '76%');
  assert.equal(formatRate(null), '–');
});
