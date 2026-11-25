// Time-zone helpers built on Intl, so there is no date library to ship.
// Doses are prescribed in the clinic's local time ("08:00 in Lagos") but stored in UTC.

const MINUTE = 60 * 1000;
export const DAY = 24 * 60 * MINUTE;

const formatters = new Map();

function partsIn(date, timeZone) {
  let dtf = formatters.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, dtf);
  }
  return Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Minutes the zone is ahead of UTC at this instant (Lagos: +60).
export function offsetMinutes(date, timeZone) {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const whole = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / MINUTE);
}

// "2026-11-24" + "08:00" in Africa/Lagos -> the UTC instant.
export function zonedToUtc(dateStr, timeStr, timeZone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = offsetMinutes(new Date(guess), timeZone);
  let utc = guess - first * MINUTE;
  // Near a daylight-saving change the offset can differ at the real instant.
  const second = offsetMinutes(new Date(utc), timeZone);
  if (second !== first) utc = guess - second * MINUTE;
  return new Date(utc);
}

export function localDate(date, timeZone) {
  const p = partsIn(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function localTime(date, timeZone) {
  const p = partsIn(date, timeZone);
  return `${p.hour}:${p.minute}`;
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Start of the local day, as a UTC instant.
export function startOfLocalDay(date, timeZone) {
  return zonedToUtc(localDate(date, timeZone), '00:00', timeZone);
}
