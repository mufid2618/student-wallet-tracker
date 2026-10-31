/**
 * history.js  —  Transaction History page logic (history.html)
 * ──────────────────────────────────────────────────────────────
 * Responsibilities:
 *  1. Guard page — redirect if not authenticated.
 *  2. Load all transactions from API and cache them in memory.
 *  3. Populate category filter from actual data.
 *  4. Apply combined filters (type + category + wallet + search).
 *  5. Handle delete via API with custom confirm dialog.
 *  6. Handle edit via API with pre-filled modal form.
 * ──────────────────────────────────────────────────────────────
 */

import { guardAuth, fetchAllTransactions, deleteTransactionById, updateTransactionById, logout } from './js/api.js';
import { formatRupiah, formatDate } from './budget.js';

/* ─── Module-level state ──────────────────────────────────────── */

let allTransactions = [];
const filters = { type: '', category: '', wallet: '', search: '', month: '' };
const sort    = { key: 'date', dir: 'desc' };
let pendingDeleteId = null;

/* ─── Labels & category lists ────────────────────────────────── */

const WALLET_LABELS = {
  cash   : '💵 Cash',
  bank   : '🏦 Bank',
  ewallet: '📱 E-Wallet',
};

const TYPE_LABELS = {
  income : 'Pemasukan',
  expense: 'Pengeluaran',
};

const INCOME_CATEGORIES  = ['Gaji', 'Beasiswa', 'Freelance', 'Investasi', 'Hadiah', 'Penjualan', 'Lainnya'];
const EXPENSE_CATEGORIES = ['Makanan', 'Transportasi', 'Pendidikan', 'Hiburan', 'Kesehatan', 'Belanja', 'Tagihan', 'Sosial', 'Lainnya'];

/* ─── Toast ──────────────────────────────────────────────────── */

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove('bg-slate-800', 'bg-red-600', 'bg-emerald-600');
  toast.classList.add(type === 'error' ? 'bg-red-600' : 'bg-emerald-600');
  toast.classList.remove('hide');
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); toast.classList.add('hide'); }, 2500);
}

/* ─── Category filter population ─────────────────────────────── */

function populateCategoryFilter() {
  const categories = [...new Set(allTransactions.map(tx => tx.category))].sort();
  const select     = document.getElementById('filter-category');
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    select.appendChild(opt);
  });
}

/* ─── Filtering ──────────────────────────────────────────────── */

function applyFilters() {
  const query = filters.search.toLowerCase().trim();
  const filtered = allTransactions.filter(tx => {
    if (filters.type     && tx.type          !== filters.type)     return false;
    if (filters.category && tx.category      !== filters.category) return false;
    if (filters.wallet   && tx.wallet_source !== filters.wallet)   return false;
    if (filters.month    && !(tx.date || '').startsWith(filters.month)) return false;
    if (query && !(tx.description || '').toLowerCase().includes(query)) return false;
    return true;
  });

  const dir = sort.dir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    if (sort.key === 'amount') return dir * (Number(a.amount) - Number(b.amount));
    return dir * (new Date(a.date) - new Date(b.date));
  });

  return filtered;
}

/* ─── SVG snippets ───────────────────────────────────────────── */

const SVG_EDIT = `
  <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor"
       stroke-width="2" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582
             16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0
             011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25
             2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25
             2.25 0 015.25 6H10"/>
  </svg>`;

const SVG_DELETE = `
  <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor"
       stroke-width="2" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round"
          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107
             1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244
             2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456
             0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114
             1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0
             -1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037
             -2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
  </svg>`;

/* ─── Row builders ───────────────────────────────────────────── */

function buildTableRow(tx) {
  const isIncome  = tx.type === 'income';
  const amountCls = isIncome ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold';
  const sign      = isIncome ? '+' : '−';
  const badge     = isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700';

  const tr = document.createElement('tr');
  tr.className = 'tx-row border-b border-slate-50 last:border-0';
  tr.innerHTML = `
    <td class="px-5 py-3.5 text-slate-600 text-sm whitespace-nowrap">${formatDate(tx.date)}</td>
    <td class="px-5 py-3.5">
      <span class="text-xs font-medium px-2 py-1 rounded-full ${badge}">
        ${TYPE_LABELS[tx.type] || tx.type}
      </span>
    </td>
    <td class="px-5 py-3.5 text-slate-600 text-sm whitespace-nowrap">
      ${WALLET_LABELS[tx.wallet_source] || tx.wallet_source}
    </td>
    <td class="px-5 py-3.5 text-slate-700 text-sm">${tx.category}</td>
    <td class="px-5 py-3.5 text-right ${amountCls} whitespace-nowrap">
      ${sign} ${formatRupiah(tx.amount)}
    </td>
    <td class="px-5 py-3.5 text-slate-500 text-sm max-w-xs truncate">
      ${tx.description || '—'}
    </td>
    <td class="px-5 py-3.5">
      <div class="flex items-center gap-1">
        <button class="btn-edit p-1.5 text-slate-400 hover:text-primary transition-colors"
                data-id="${tx.id}" title="Edit transaksi">
          ${SVG_EDIT}
        </button>
        <button class="btn-delete p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                data-id="${tx.id}" title="Hapus transaksi">
          ${SVG_DELETE}
        </button>
      </div>
    </td>
  `;
  return tr;
}

function buildMobileCard(tx) {
  const isIncome  = tx.type === 'income';
  const amountCls = isIncome ? 'text-emerald-600' : 'text-red-600';
  const sign      = isIncome ? '+' : '−';
  const dotCls    = isIncome ? 'bg-emerald-400' : 'bg-red-400';

  const div = document.createElement('div');
  div.className = 'px-4 py-3.5 flex items-start justify-between gap-3';
  div.innerHTML = `
    <div class="flex items-start gap-3 flex-1 min-w-0">
      <span class="w-2.5 h-2.5 rounded-full ${dotCls} mt-1.5 flex-shrink-0"></span>
      <div class="min-w-0">
        <p class="text-sm font-medium text-slate-700 truncate">${tx.category}</p>
        <p class="text-xs text-slate-400 mt-0.5">
          ${formatDate(tx.date)} · ${WALLET_LABELS[tx.wallet_source] || tx.wallet_source}
        </p>
        ${tx.description
          ? `<p class="text-xs text-slate-500 mt-0.5 truncate">${tx.description}</p>`
          : ''}
      </div>
    </div>
    <div class="flex items-center gap-1 flex-shrink-0">
      <span class="text-sm font-bold ${amountCls} whitespace-nowrap mr-1">
        ${sign} ${formatRupiah(tx.amount)}
      </span>
      <button class="btn-edit p-1.5 text-slate-400 hover:text-primary"
              data-id="${tx.id}" title="Edit">
        ${SVG_EDIT}
      </button>
      <button class="btn-delete p-1.5 text-slate-400 hover:text-red-500"
              data-id="${tx.id}" title="Hapus">
        ${SVG_DELETE}
      </button>
    </div>
  `;
  return div;
}

/* ─── Table render ───────────────────────────────────────────── */

function renderTable() {
  const filtered   = applyFilters();
  const tbody      = document.getElementById('tx-table-body');
  const mobileList = document.getElementById('tx-mobile-list');
  const emptyState = document.getElementById('empty-state');
  const countEl    = document.getElementById('results-count');

  if (tbody)      tbody.innerHTML      = '';
  if (mobileList) mobileList.innerHTML = '';

  const total = allTransactions.length;
  if (countEl) {
    const hasFilter = filters.type || filters.category || filters.wallet || filters.search || filters.month;
    if (hasFilter) {
      let suffix = '';
      if (filters.month) {
        const [y, m] = filters.month.split('-').map(Number);
        suffix = ' · ' + new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      }
      countEl.textContent = `Menampilkan ${filtered.length} dari ${total} transaksi${suffix}`;
    } else {
      countEl.textContent = `${total} transaksi`;
    }
  }

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  filtered.forEach(tx => {
    if (tbody)      tbody.appendChild(buildTableRow(tx));
    if (mobileList) mobileList.appendChild(buildMobileCard(tx));
  });

  const sidebarCount = document.getElementById('sidebar-total-count');
  if (sidebarCount) sidebarCount.textContent = total;
}

/* ─── Delete flow ────────────────────────────────────────────── */

function showConfirmDialog(id) {
  pendingDeleteId = id;
  document.getElementById('confirm-dialog')?.classList.remove('hidden');
}

function hideConfirmDialog() {
  pendingDeleteId = null;
  document.getElementById('confirm-dialog')?.classList.add('hidden');
}

function handleDeleteClick(e) {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  showConfirmDialog(btn.dataset.id);
}

async function confirmDelete() {
  if (!pendingDeleteId) return;

  const btn = document.getElementById('confirm-delete');
  if (btn) { btn.disabled = true; btn.textContent = 'Menghapus…'; }

  try {
    await deleteTransactionById(pendingDeleteId);
    allTransactions = allTransactions.filter(tx => String(tx.id) !== String(pendingDeleteId));
    hideConfirmDialog();
    populateCategoryFilter();
    renderTable();
    showToast('Transaksi berhasil dihapus.');
  } catch (err) {
    hideConfirmDialog();
    showToast(err.message || 'Gagal menghapus transaksi.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Ya, Hapus'; }
  }
}

/* ─── Edit flow ──────────────────────────────────────────────── */

function populateEditCategories(type, selectedCategory) {
  const select = document.getElementById('edit-category');
  if (!select) return;
  select.innerHTML = '<option value="">— Pilih —</option>';
  const list = type === 'income' ? INCOME_CATEGORIES
             : type === 'expense' ? EXPENSE_CATEGORIES
             : [];
  list.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === selectedCategory) opt.selected = true;
    select.appendChild(opt);
  });
}

function openEditDialog(tx) {
  document.getElementById('edit-id').value     = tx.id;
  document.getElementById('edit-date').value   = tx.date;
  document.getElementById('edit-type').value   = tx.type;
  document.getElementById('edit-wallet').value = tx.wallet_source;
  document.getElementById('edit-amount').value = tx.amount;
  document.getElementById('edit-note').value   = tx.description || '';

  populateEditCategories(tx.type, tx.category);

  const errEl = document.getElementById('edit-error');
  if (errEl) errEl.classList.add('hidden');

  document.getElementById('edit-dialog')?.classList.remove('hidden');
}

function closeEditDialog() {
  document.getElementById('edit-dialog')?.classList.add('hidden');
}

function handleEditClick(e) {
  const btn = e.target.closest('.btn-edit');
  if (!btn) return;
  const tx = allTransactions.find(t => String(t.id) === String(btn.dataset.id));
  if (tx) openEditDialog(tx);
}

async function handleEditSubmit(e) {
  e.preventDefault();

  const id       = document.getElementById('edit-id').value;
  const date     = document.getElementById('edit-date').value.trim();
  const type     = document.getElementById('edit-type').value;
  const wallet   = document.getElementById('edit-wallet').value;
  const category = document.getElementById('edit-category').value;
  const amount   = Math.round(Number(document.getElementById('edit-amount').value));
  const note     = document.getElementById('edit-note').value.trim();
  const errEl    = document.getElementById('edit-error');

  if (!date || !type || !wallet || !category || !amount || amount <= 0) {
    if (errEl) { errEl.textContent = 'Semua field wajib diisi dengan benar.'; errEl.classList.remove('hidden'); }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  const saveBtn  = document.getElementById('edit-save');
  const saveText = document.getElementById('edit-save-text');
  const spinner  = document.getElementById('edit-spinner');
  if (saveBtn)  saveBtn.disabled      = true;
  if (saveText) saveText.textContent  = 'Menyimpan…';
  if (spinner)  spinner.classList.remove('hidden');

  try {
    const res = await updateTransactionById(id, {
      date,
      type,
      wallet_source: wallet,
      category,
      amount,
      description: note,
    });

    // Patch local cache so re-render shows updated data
    const idx = allTransactions.findIndex(t => String(t.id) === String(id));
    if (idx !== -1) allTransactions[idx] = { ...allTransactions[idx], ...res.data };

    closeEditDialog();
    populateCategoryFilter();
    renderTable();
    showToast('Transaksi berhasil diperbarui. ✓');

  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Gagal memperbarui transaksi.'; errEl.classList.remove('hidden'); }
  } finally {
    if (saveBtn)  saveBtn.disabled      = false;
    if (saveText) saveText.textContent  = 'Simpan';
    if (spinner)  spinner.classList.add('hidden');
  }
}

/* ─── PDF Download ───────────────────────────────────────────── */

function downloadPDF() {
  window.print();
}

/* ─── Sort headers ───────────────────────────────────────────── */

function updateSortIndicators() {
  ['date', 'amount'].forEach(key => {
    const th   = document.querySelector(`[data-sort="${key}"]`);
    const icon = th?.querySelector('.sort-icon');
    if (!icon) return;
    if (sort.key === key) {
      icon.textContent = sort.dir === 'asc' ? ' ↑' : ' ↓';
    } else {
      icon.textContent = ' ↕';
    }
  });
}

function bindSortHeaders() {
  document.querySelectorAll('[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sort.key === key) {
        sort.dir = sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sort.key = key;
        sort.dir = key === 'amount' ? 'asc' : 'desc';
      }
      updateSortIndicators();
      renderTable();
    });
  });
}

/* ─── Filter binding ─────────────────────────────────────────── */

function bindFilters() {
  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => { filters[key] = el.value; renderTable(); });
  };
  bind('filter-month',    'month');
  bind('filter-type',     'type');
  bind('filter-category', 'category');
  bind('filter-wallet',   'wallet');

  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    let debounceTimer;
    searchEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { filters.search = searchEl.value; renderTable(); }, 250);
    });
  }
}

/* ─── Dialog binding ─────────────────────────────────────────── */

function bindDeleteDialog() {
  document.getElementById('tx-table-body')?.addEventListener('click', handleDeleteClick);
  document.getElementById('tx-mobile-list')?.addEventListener('click', handleDeleteClick);
  document.getElementById('confirm-cancel')?.addEventListener('click', hideConfirmDialog);
  document.getElementById('confirm-delete')?.addEventListener('click', confirmDelete);
  const dialog = document.getElementById('confirm-dialog');
  if (dialog) dialog.addEventListener('click', e => { if (e.target === dialog) hideConfirmDialog(); });
}

function bindEditDialog() {
  document.getElementById('tx-table-body')?.addEventListener('click', handleEditClick);
  document.getElementById('tx-mobile-list')?.addEventListener('click', handleEditClick);

  // Re-populate categories when type changes inside the edit modal
  document.getElementById('edit-type')?.addEventListener('change', () => {
    const type    = document.getElementById('edit-type').value;
    const current = document.getElementById('edit-category').value;
    populateEditCategories(type, current);
  });

  document.getElementById('edit-close')?.addEventListener('click',  closeEditDialog);
  document.getElementById('edit-cancel')?.addEventListener('click', closeEditDialog);
  document.getElementById('edit-form')?.addEventListener('submit',  handleEditSubmit);

  const dialog = document.getElementById('edit-dialog');
  if (dialog) dialog.addEventListener('click', e => { if (e.target === dialog) closeEditDialog(); });
}

/* ─── Logout handler ─────────────────────────────────────────── */

window.handleLogout = async function () {
  await logout();
};

/* ─── Bootstrap ─────────────────────────────────────────────── */

(async function init() {
  // 1. Auth guard
  const user = await guardAuth();

  // 2. Sidebar username
  const userEl = document.getElementById('sidebar-username');
  if (userEl) userEl.textContent = user.username;

  // 3. Bind all UI interactions
  document.getElementById('btn-download-pdf')?.addEventListener('click', downloadPDF);
  bindSortHeaders();
  updateSortIndicators();
  bindFilters();
  bindDeleteDialog();
  bindEditDialog();

  // 4. Fetch all transactions
  try {
    allTransactions = await fetchAllTransactions();
  } catch (err) {
    showToast('Gagal memuat transaksi: ' + err.message, 'error');
    allTransactions = [];
  }

  // 5. Populate category filter + render table
  populateCategoryFilter();
  renderTable();

  const sidebarCount = document.getElementById('sidebar-total-count');
  if (sidebarCount) sidebarCount.textContent = allTransactions.length;
})();
