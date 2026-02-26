/**
 * Utilidad para interpretar opening_config del gym.
 * closed_weekdays: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado (getDay() de JavaScript).
 * closed_dates: ["01-01", "12-25"] = festivos anuales (MM-DD); se aplican todos los años.
 */

const MM_DD_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

function getClosedWeekdaysSet(config: unknown): Set<number> {
  if (!config || typeof config !== 'object') return new Set();
  const raw = (config as Record<string, unknown>).closed_weekdays;
  if (!Array.isArray(raw)) return new Set();
  const set = new Set<number>();
  for (const v of raw) {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (!Number.isNaN(n) && n >= 0 && n <= 6) set.add(n);
  }
  return set;
}

function getClosedDatesSet(config: unknown): Set<string> {
  if (!config || typeof config !== 'object') return new Set();
  const raw = (config as Record<string, unknown>).closed_dates;
  if (!Array.isArray(raw)) return new Set();
  const set = new Set<string>();
  for (const v of raw) {
    const s = String(v).trim();
    if (MM_DD_REGEX.test(s)) set.add(s);
  }
  return set;
}

/** Devuelve true si el gym está cerrado ese día (0=Dom..6=Sab). */
export function isGymClosedOnWeekday(openingConfig: unknown, weekday: number): boolean {
  const closed = getClosedWeekdaysSet(openingConfig);
  if (closed.size === 0) return false;
  return closed.has(weekday);
}

/** Devuelve true si la fecha (Date) es un festivo cerrado (MM-DD). */
function isClosedDate(date: Date, closedDates: Set<string>): boolean {
  if (closedDates.size === 0) return false;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return closedDates.has(mmdd);
}

/**
 * Devuelve true si TODOS los días entre lastCheckinDate (exclusive) y today (exclusive)
 * fueron días cerrados (closed_weekdays o closed_dates). Si no hubo ningún día intermedio, devuelve false.
 */
export function wereAllGapDaysClosed(
  lastCheckinDate: Date,
  today: Date,
  openingConfig: unknown
): boolean {
  const closedWeekdays = getClosedWeekdaysSet(openingConfig);
  const closedDates = getClosedDatesSet(openingConfig);
  if (closedWeekdays.size === 0 && closedDates.size === 0) return false;

  const last = new Date(lastCheckinDate);
  last.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  let current = new Date(last.getTime() + msPerDay);

  if (current.getTime() >= end.getTime()) return false;

  while (current.getTime() < end.getTime()) {
    const weekday = current.getDay();
    const isClosed =
      closedWeekdays.has(weekday) || isClosedDate(current, closedDates);
    if (!isClosed) return false;
    current.setTime(current.getTime() + msPerDay);
  }
  return true;
}
