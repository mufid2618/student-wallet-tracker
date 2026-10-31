/**
 * main.js  —  Dashboard page logic (index.html)
 * ──────────────────────────────────────────────────────────────
 * Refactored to use the PHP REST API via js/api.js.
 * All data is fetched asynchronously; localStorage is no longer used.
 *
 * Responsibilities:
 *  1. Guard page — redirect to login.html if not authenticated.
 *  2. Fetch aggregated stats from api/dashboard.php.
 *  3. Render metric cards, wallet breakdown, budget progress bar.
 *  4. Render Donut and Line charts via chart.js module.
 *  5. Handle "Save Budget" from sidebar → api/auth.php update_budget.
 *  6. Show authenticated username in sidebar.
 * ──────────────────────────────────────────────────────────────
 */

import { guardAuth, fetchDashboard, updateBudget, logout } from './js/api.js';
import { getBudgetSummary, formatRupiah }                  from './budget.js';
import { renderDonutChart, renderLineChart }                from './chart.js';

/* ─── Constants ───────────────────────────────────────────────── */

const WALLET_LABELS = {
  cash   : '💵 Cash',
  bank   : '🏦 Rekening Bank',
  ewallet: '📱 E-Wallet',
};

const WALLET_COLOURS = {
  cash   : { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  bank   : { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
  ewallet: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-400' },
};

/* ─── Helpers ─────────────────────────────────────────────────── */

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove('bg-slate-800', 'bg-red-600', 'bg-emerald-600');
  toast.classList.add(type === 'error' ? 'bg-red-600' : 'bg-emerald-600');
  toast.classList.remove('hide');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
  }, 2500);
}

/** Show/hide a full-page loading overlay */
function setLoading(loading) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.toggle('hidden', !loading);
}

/* ─── Render Functions ────────────────────────────────────────── */

function renderMetricCards(income, expense) {
  document.getElementById('total-income').textContent  = formatRupiah(income);
  document.getElementById('total-expense').textContent = formatRupiah(expense);

  const net   = income - expense;
  const netEl = document.getElementById('net-balance');
  netEl.textContent = formatRupiah(net);
  // Reset then re-apply colour
  netEl.classList.remove('text-emerald-600', 'text-red-600', 'text-slate-800');
  if (net > 0)      netEl.classList.add('text-emerald-600');
  else if (net < 0) netEl.classList.add('text-red-600');
  else              netEl.classList.add('text-slate-800');
}

function renderWalletBreakdown(balances) {
  const container = document.getElementById('wallet-breakdown');
  if (!container) return;
  container.innerHTML = '';

  ['cash', 'bank', 'ewallet'].forEach(w => {
    const balance = balances[w] || 0;
    const col     = WALLET_COLOURS[w];
    const div = document.createElement('div');
    div.className = `wallet-badge flex items-center justify-between rounded-xl px-4 py-3 ${col.bg}`;
    div.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="w-2.5 h-2.5 rounded-full ${col.dot} flex-shrink-0"></span>
        <span class="text-sm font-medium ${col.text}">${WALLET_LABELS[w]}</span>
      </div>
      <span class="text-sm font-bold ${col.text}">${formatRupiah(balance)}</span>
    `;
    container.appendChild(div);
  });
}

/**
 * Render the budget progress bar.
 * @param {number} spent
 * @param {number} monthly  budget limit from the server
 */
function renderBudget(spent, monthly) {
  const summary = getBudgetSummary(spent, monthly);

  const bar = document.getElementById('budget-bar');
  if (bar) {
    bar.style.width = `${summary.percentage}%`;
    bar.className   = `progress-fill ${summary.colour}`;
  }

  const el = (id) => document.getElementById(id);
  if (el('budget-pct-text'))   el('budget-pct-text').textContent   = `${Math.round(summary.percentage)}%`;
  if (el('budget-spent-text')) el('budget-spent-text').textContent = formatRupiah(spent);
  if (el('budget-limit-text')) el('budget-limit-text').textContent = monthly
    ? `dari ${formatRupiah(monthly)}`
    : 'Belum diatur';

  const remainEl = el('budget-remaining');
  if (remainEl) {
    if (monthly > 0) {
      remainEl.textContent = formatRupiah(summary.remaining);
      remainEl.className   = summary.isOverBudget
        ? 'font-bold text-red-600'
        : 'font-bold text-emerald-600';
    } else {
      remainEl.textContent = '—';
      remainEl.className   = 'font-bold text-slate-400';
    }
  }

  const badge = el('budget-status-badge');
  if (badge) {
    badge.textContent = summary.label;
    const cls = { green: 'bg-emerald-50 text-emerald-700', yellow: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' };
    badge.className = `text-xs px-2.5 py-1 rounded-full font-medium ${cls[summary.colour]}`;
  }

  // Pre-fill sidebar budget input
  const input = el('budget-input');
  if (input) input.value = monthly || '';
  const display = el('budget-display');
  if (display && monthly > 0) display.textContent = `Aktif: ${formatRupiah(monthly)}/bulan`;
}

/**
 * Render the Donut chart from the expense_by_category map.
 * @param {Object.<string,number>} catMap
 */
function renderDonut(catMap) {
  renderDonutChart('donut-chart', catMap);
}

/**
 * Render the Line chart from the daily_cashflow array.
 * @param {Array<{day:number, income:number, expense:number}>} dailyData
 */
function renderLine(dailyData) {
  const days        = dailyData.map(d => d.day);
  const incomeData  = dailyData.map(d => d.income);
  const expenseData = dailyData.map(d => d.expense);
  renderLineChart('line-chart', days, incomeData, expenseData);
}

/* ─── Load dashboard for a given year/month ──────────────────── */

async function loadDashboard(year, month) {
  setLoading(true);
  try {
    const data = await fetchDashboard(year, month);
    setLoading(false);

    renderMetricCards(data.total_income, data.total_expense);
    renderWalletBreakdown(data.wallet_balances);
    renderBudget(data.total_expense, data.monthly_budget);
    renderDonut(data.expense_by_category);
    renderLine(data.daily_cashflow);

    // Update subtitle with selected month name
    const label = new Date(year, month - 1, 1)
      .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const monthEl = document.getElementById('current-month');
    if (monthEl) monthEl.textContent = label;

  } catch (err) {
    setLoading(false);
    showToast('Gagal memuat data dashboard: ' + err.message, 'error');
  }
}

/* ─── Budget sidebar save handler ────────────────────────────── */

window.saveBudgetFromSidebar = async function () {
  const input = document.getElementById('budget-input');
  const value = parseInt(input.value, 10);

  if (!value || value <= 0) {
    showToast('Masukkan nominal anggaran yang valid.', 'error');
    return;
  }

  try {
    await updateBudget(value);
    showToast(`Anggaran ${formatRupiah(value)}/bulan berhasil disimpan!`);

    // Re-fetch using currently selected month
    const picker = document.getElementById('month-picker');
    const [y, m] = picker?.value
      ? picker.value.split('-').map(Number)
      : [new Date().getFullYear(), new Date().getMonth() + 1];
    const data = await fetchDashboard(y, m);
    renderBudget(data.total_expense, value);
  } catch (err) {
    showToast(err.message || 'Gagal menyimpan anggaran.', 'error');
  }
};

/* ─── Logout handler ─────────────────────────────────────────── */

window.handleLogout = async function () {
  await logout();
};

/* ─── Page initialisation ─────────────────────────────────────── */

(async function init() {
  setLoading(true);

  // 1. Auth guard
  const user = await guardAuth();

  // 2. Show username in sidebar
  const userEl = document.getElementById('sidebar-username');
  if (userEl) userEl.textContent = user.username;

  // 3. Set month picker to current month and bind change event
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const picker = document.getElementById('month-picker');
  if (picker) {
    picker.value = `${year}-${String(month).padStart(2, '0')}`;
    picker.addEventListener('change', () => {
      if (!picker.value) return;
      const [y, m] = picker.value.split('-').map(Number);
      loadDashboard(y, m);
    });
  }

  // 4. Load initial data
  await loadDashboard(year, month);
})();
