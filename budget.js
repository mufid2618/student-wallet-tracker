/**
 * budget.js
 * ──────────────────────────────────────────────────────────────
 * Pure calculation helpers for the budgeting / progress-bar feature.
 * All functions are stateless — pass values in, get computed results out.
 * DOM manipulation lives in the page-specific JS files.
 * ──────────────────────────────────────────────────────────────
 */

/* ─── Thresholds ──────────────────────────────────────────────── */

/** Spending ratio (0–1) below which the bar is shown in green. */
export const THRESHOLD_GREEN  = 0.70;

/** Spending ratio (0–1) below which the bar is shown in yellow. */
export const THRESHOLD_YELLOW = 0.90;

/* ─── Core calculations ───────────────────────────────────────── */

/**
 * Calculate what percentage of the budget has been spent.
 * Returns a value between 0 and 100 (capped at 100 in the UI helper below).
 *
 * @param {number} spent   - total expenses for the period
 * @param {number} budget  - budget limit for the period (must be > 0)
 * @returns {number}       - percentage 0–∞  (caller clamps as needed)
 */
export function calcBudgetPercentage(spent, budget) {
  if (!budget || budget <= 0) return 0;
  return (spent / budget) * 100;
}

/**
 * Return the CSS class name for the progress bar fill colour,
 * based on the spending ratio.
 *
 * @param {number} spent
 * @param {number} budget
 * @returns {'green'|'yellow'|'red'}
 */
export function getBudgetColour(spent, budget) {
  if (!budget || budget <= 0) return 'green';
  const ratio = spent / budget;
  if (ratio < THRESHOLD_GREEN)  return 'green';
  if (ratio < THRESHOLD_YELLOW) return 'yellow';
  return 'red';
}

/**
 * Return a human-readable status label for the budget state.
 *
 * @param {number} spent
 * @param {number} budget
 * @returns {string}
 */
export function getBudgetLabel(spent, budget) {
  if (!budget || budget <= 0) return 'Belum diatur';
  const ratio = spent / budget;
  if (ratio >= 1)               return 'Limit terlampaui!';
  if (ratio >= THRESHOLD_YELLOW) return 'Mendekati limit';
  if (ratio >= THRESHOLD_GREEN)  return 'Perlu perhatian';
  return 'Aman';
}

/**
 * Return the remaining budget (can be negative when over-budget).
 *
 * @param {number} spent
 * @param {number} budget
 * @returns {number}
 */
export function getRemainingBudget(spent, budget) {
  return budget - spent;
}

/* ─── UI-ready helper ─────────────────────────────────────────── */

/**
 * Compute a complete summary object ready for rendering in the UI.
 *
 * @param {number} spent   - total expenses this month
 * @param {number} budget  - configured budget limit
 * @returns {{
 *   percentage  : number,   // 0–100 (clamped)
 *   colour      : string,   // CSS class name
 *   label       : string,   // human-readable status
 *   remaining   : number,   // budget - spent
 *   isOverBudget: boolean
 * }}
 */
export function getBudgetSummary(spent, budget) {
  const raw         = calcBudgetPercentage(spent, budget);
  const percentage  = Math.min(raw, 100);           // clamp for progress bar width
  const colour      = getBudgetColour(spent, budget);
  const label       = getBudgetLabel(spent, budget);
  const remaining   = getRemainingBudget(spent, budget);
  const isOverBudget = spent > budget && budget > 0;

  return { percentage, colour, label, remaining, isOverBudget };
}

/* ─── Format helper (shared across pages) ────────────────────── */

/**
 * Format a number as Indonesian Rupiah string (e.g. "Rp 1.250.000").
 * Uses Intl.NumberFormat for proper locale-aware formatting.
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style   : 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date string (YYYY-MM-DD) to a localised Indonesian date.
 * e.g. "2025-04-15" → "15 Apr 2025"
 *
 * @param {string} dateStr  - ISO date string YYYY-MM-DD
 * @returns {string}
 */
export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    day  : '2-digit',
    month: 'short',
    year : 'numeric',
  });
}
