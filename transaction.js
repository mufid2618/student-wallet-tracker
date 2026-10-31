/**
 * transaction.js  —  Add Transaction page logic (transaction.html)
 * ──────────────────────────────────────────────────────────────
 * Refactored: data is submitted to api/transactions.php via fetch().
 * localStorage is no longer used.
 *
 * Responsibilities:
 *  1. Guard page — redirect if not authenticated.
 *  2. Show budget limit and username from session.
 *  3. Populate Category <select> based on transaction type.
 *  4. Validate form, call createTransaction(), show toast.
 * ──────────────────────────────────────────────────────────────
 */

import { guardAuth, createTransaction, logout } from './js/api.js';
import { formatRupiah }                          from './budget.js';

/* ─── Category definitions ─────────────────────────────────────── */

const INCOME_CATEGORIES  = ['Gaji', 'Beasiswa', 'Freelance', 'Investasi', 'Hadiah', 'Penjualan', 'Lainnya'];
const EXPENSE_CATEGORIES = ['Makanan', 'Transportasi', 'Pendidikan', 'Hiburan', 'Kesehatan', 'Belanja', 'Tagihan', 'Sosial', 'Lainnya'];

/* ─── Toast ─────────────────────────────────────────────────────── */

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove('bg-slate-800', 'bg-red-600', 'bg-emerald-600');
  toast.classList.add(type === 'error' ? 'bg-red-600' : 'bg-emerald-600');
  toast.classList.remove('hide');
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); toast.classList.add('hide'); }, 2800);
}

/* ─── Field error helpers ─────────────────────────────────────── */

function showFieldError(fieldId, errorId, message) {
  const field = document.getElementById(fieldId);
  const err   = document.getElementById(errorId);
  if (field) field.classList.add('error');
  if (err)  { err.textContent = message; err.classList.remove('hidden'); }
}

function clearFieldError(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const err   = document.getElementById(errorId);
  if (field) field.classList.remove('error');
  if (err)  { err.textContent = ''; err.classList.add('hidden'); }
}

function clearAllErrors() {
  [
    ['tx-date',     'err-date'],
    ['tx-type',     'err-type'],
    ['tx-wallet',   'err-wallet'],
    ['tx-category', 'err-category'],
    ['tx-amount',   'err-amount'],
  ].forEach(([f, e]) => clearFieldError(f, e));
}

/* ─── Category population ─────────────────────────────────────── */

function populateCategories(type) {
  const select = document.getElementById('tx-category');
  if (!select) return;
  select.innerHTML = '<option value="">— Pilih —</option>';
  const list = type === 'income' ? INCOME_CATEGORIES : type === 'expense' ? EXPENSE_CATEGORIES : [];
  list.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    select.appendChild(opt);
  });
}

/* ─── Validation ─────────────────────────────────────────────── */

function validateForm() {
  clearAllErrors();
  let valid = true;

  const date     = document.getElementById('tx-date').value.trim();
  const type     = document.getElementById('tx-type').value;
  const wallet   = document.getElementById('tx-wallet').value;
  const category = document.getElementById('tx-category').value;
  const amount   = document.getElementById('tx-amount').value;

  if (!date)                                              { showFieldError('tx-date',     'err-date',     'Tanggal wajib diisi.');           valid = false; }
  if (!type)                                              { showFieldError('tx-type',     'err-type',     'Pilih jenis transaksi.');          valid = false; }
  if (!wallet)                                            { showFieldError('tx-wallet',   'err-wallet',   'Pilih dompet asal/tujuan.');       valid = false; }
  if (!category)                                          { showFieldError('tx-category', 'err-category', 'Pilih kategori transaksi.');       valid = false; }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { showFieldError('tx-amount', 'err-amount', 'Jumlah harus lebih dari 0.');    valid = false; }

  return valid;
}

/* ─── Form Submission ─────────────────────────────────────────── */

async function handleSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  // Disable submit button to prevent double-submit
  const btn     = document.querySelector('#tx-form button[type="submit"]');
  const btnText = document.getElementById('submit-btn-text');
  const spinner = document.getElementById('submit-spinner');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Menyimpan…';
  if (spinner) spinner.classList.remove('hidden');

  const date     = document.getElementById('tx-date').value.trim();
  const type     = document.getElementById('tx-type').value;
  const wallet   = document.getElementById('tx-wallet').value;
  const category = document.getElementById('tx-category').value;
  const amount   = Math.round(Number(document.getElementById('tx-amount').value));
  const note     = document.getElementById('tx-note').value.trim();

  try {
    // Map front-end field names to API field names
    await createTransaction({
      date,
      type,
      wallet_source: wallet,
      category,
      amount,
      description: note,
    });

    // Reset form
    document.getElementById('tx-form').reset();
    setDefaultDate();
    populateCategories('');
    clearAllErrors();

    const typeLabel = type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    showToast(`${typeLabel} ${formatRupiah(amount)} berhasil disimpan! ✓`);

  } catch (err) {
    showToast(err.message || 'Gagal menyimpan transaksi.', 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Simpan Transaksi';
    if (spinner) spinner.classList.add('hidden');
  }
}

/* ─── Logout handler ─────────────────────────────────────────── */

window.handleLogout = async function () {
  await logout();
};

/* ─── Utility ─────────────────────────────────────────────────── */

function setDefaultDate() {
  const input = document.getElementById('tx-date');
  if (input) input.value = new Date().toISOString().split('T')[0];
}

function bindTypeChange() {
  const typeSelect = document.getElementById('tx-type');
  if (!typeSelect) return;
  typeSelect.addEventListener('change', () => {
    populateCategories(typeSelect.value);
    clearFieldError('tx-category', 'err-category');
  });
}

function bindLiveValidation() {
  [
    { field: 'tx-date',     err: 'err-date'     },
    { field: 'tx-type',     err: 'err-type'     },
    { field: 'tx-wallet',   err: 'err-wallet'   },
    { field: 'tx-category', err: 'err-category' },
    { field: 'tx-amount',   err: 'err-amount'   },
  ].forEach(({ field, err }) => {
    const el = document.getElementById(field);
    if (!el) return;
    el.addEventListener('input',  () => clearFieldError(field, err));
    el.addEventListener('change', () => clearFieldError(field, err));
  });
}

/* ─── Bootstrap ───────────────────────────────────────────────── */

(async function init() {
  // 1. Auth guard
  const user = await guardAuth();

  // 2. Show username in sidebar
  const userEl = document.getElementById('sidebar-username');
  if (userEl) userEl.textContent = user.username;

  // 3. Show budget from session
  const budgetEl = document.getElementById('sidebar-budget');
  if (budgetEl) {
    budgetEl.textContent = user.monthly_budget > 0
      ? formatRupiah(user.monthly_budget) + '/bulan'
      : 'Belum diatur';
  }

  // 4. Set up form
  setDefaultDate();
  populateCategories('');
  bindTypeChange();
  bindLiveValidation();

  const form = document.getElementById('tx-form');
  if (form) form.addEventListener('submit', handleSubmit);
})();
