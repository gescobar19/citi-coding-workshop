export const STATUS_LABELS = {
  all: "All",
  not_started: "Not started",
  in_progress: "In progress",
  late: "Late",
  finished: "Finished",
  cancelled: "Cancelled",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function fmtMoney(value) {
  return currency.format(Number(value) || 0);
}

export function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtHours(value) {
  return `${Number(value) || 0}h`;
}

// Backend is source of truth: prefer display_status from DB views when present.
export function displayStatus(row = {}) {
  return row.display_status || row.status || "not_started";
}

// Standard labour costing rule, mirrored from the backend (app/costing.py):
// an assigned employee works a 40-hour week charged at $100/hour.
export const LABOR_RATE = 100;
export const STANDARD_WEEKLY_HOURS = 40;
export const FULL_TIME_WEEKLY_COST = LABOR_RATE * STANDARD_WEEKLY_HOURS;

export function weeksBetween(start, end) {
  if (!start || !end) return 0;
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  return Math.max(1, Math.round((to - from) / (7 * 24 * 60 * 60 * 1000)));
}

export function laborCost(hours, weeks = 1) {
  return (Number(hours) || 0) * LABOR_RATE * weeks;
}

export function pct(part, whole) {
  const w = Number(whole) || 0;
  if (w === 0) return 0;
  return Math.round((Number(part) / w) * 100);
}
