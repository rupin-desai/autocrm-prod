// Shared day / date-range / month / year filtering used by the dashboard and
// by the list endpoints, so "today" means the same thing everywhere.

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

export interface ResolvedRange {
  from: Date;
  to: Date;
  label: string;
  period: PeriodKey;
}

export interface PeriodInput {
  period?: string;
  date?: string;
  month?: number | string;
  year?: number | string;
  fromDate?: string;
  toDate?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDay(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Resolves the query parameters into a concrete [from, to] window.
 *
 * Precedence, highest first:
 *   1. explicit fromDate/toDate  -> custom range
 *   2. month + year              -> that whole month
 *   3. year alone                -> that whole year
 *   4. date                      -> that single day
 *   5. period keyword            -> today / yesterday / week / month / year
 *   6. nothing                   -> today
 */
export function resolveDateRange(input: PeriodInput = {}): ResolvedRange {
  const now = new Date();

  const from = parseDate(input.fromDate);
  const to = parseDate(input.toDate);
  if (from || to) {
    const start = startOfDay(from || to || now);
    const end = endOfDay(to || from || now);
    // Tolerate the two being supplied the wrong way round.
    const [a, b] = start <= end ? [start, end] : [startOfDay(end), endOfDay(start)];
    return {
      from: a,
      to: b,
      period: 'custom',
      label: a.getTime() === startOfDay(b).getTime()
        ? formatDay(a)
        : `${formatDay(a)} - ${formatDay(b)}`,
    };
  }

  const month = input.month !== undefined && input.month !== '' ? Number(input.month) : undefined;
  const year = input.year !== undefined && input.year !== '' ? Number(input.year) : undefined;

  if (month && year) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { from: start, to: end, period: 'month', label: `${MONTH_NAMES[month - 1]} ${year}` };
  }

  if (month && !year) {
    const y = now.getFullYear();
    const start = new Date(y, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, month, 0, 23, 59, 59, 999);
    return { from: start, to: end, period: 'month', label: `${MONTH_NAMES[month - 1]} ${y}` };
  }

  if (year) {
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { from: start, to: end, period: 'year', label: String(year) };
  }

  const single = parseDate(input.date);
  if (single) {
    return { from: startOfDay(single), to: endOfDay(single), period: 'custom', label: formatDay(single) };
  }

  switch (input.period) {
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y), period: 'yesterday', label: 'Yesterday' };
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { from: startOfDay(start), to: endOfDay(now), period: 'week', label: 'Last 7 days' };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from: start, to: end, period: 'month', label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { from: start, to: end, period: 'year', label: String(now.getFullYear()) };
    }
    case 'today':
    default:
      return { from: startOfDay(now), to: endOfDay(now), period: 'today', label: 'Today' };
  }
}

/** Mongo match fragment for a resolved range on the given field. */
export function rangeMatch(range: ResolvedRange, field = 'createdAt') {
  return { [field]: { $gte: range.from, $lte: range.to } };
}

/** The equivalent window one period earlier, for period-over-period deltas. */
export function previousRange(range: ResolvedRange): ResolvedRange {
  const span = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - span);
  return { from, to, period: range.period, label: 'Previous period' };
}
