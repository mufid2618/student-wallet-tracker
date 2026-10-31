/**
 * chart.js
 * ──────────────────────────────────────────────────────────────
 * All Chart.js rendering logic lives here.
 * Each exported function receives a canvas element ID and the data
 * needed to draw the chart.  It destroys any existing Chart instance
 * on the same canvas before creating a new one (safe to call on
 * re-renders / data refresh).
 *
 * Depends on: Chart.js loaded globally via CDN (<script> in HTML).
 * ──────────────────────────────────────────────────────────────
 */

/** Internal registry — maps canvasId → Chart instance */
const chartInstances = {};

/**
 * Safely destroy an existing Chart instance before recreating it.
 * Prevents the "Canvas is already in use" error on re-render.
 * @param {string} canvasId
 */
function destroyIfExists(canvasId) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
}

/* ─── Colour palette (consistent across charts) ──────────────── */
const PALETTE = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

/* ─── Donut Chart — Expense by Category ──────────────────────── */

/**
 * Render (or re-render) a Donut Chart showing spending per category.
 *
 * @param {string} canvasId  - id of the <canvas> element
 * @param {Object.<string, number>} categoryMap  - { category: totalAmount }
 */
export function renderDonutChart(canvasId, categoryMap) {
  destroyIfExists(canvasId);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = Object.keys(categoryMap);
  const data   = Object.values(categoryMap);

  // Show a placeholder message when there is no expense data yet
  if (labels.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data pengeluaran', canvas.width / 2, canvas.height / 2);
    return;
  }

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor : PALETTE.slice(0, labels.length),
        borderColor     : '#ffffff',
        borderWidth     : 3,
        hoverOffset     : 6,
      }],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: true,
      cutout             : '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding  : 16,
            boxWidth : 12,
            font     : { size: 12 },
            color    : '#374151',
          },
        },
        tooltip: {
          callbacks: {
            /** Format tooltip values as Rupiah */
            label(ctx) {
              const val = ctx.parsed;
              return ` Rp ${val.toLocaleString('id-ID')}`;
            },
          },
        },
      },
    },
  });
}

/* ─── Line Chart — Cash-flow Trend ───────────────────────────── */

/**
 * Render (or re-render) a Line Chart showing daily net cash-flow for a month.
 *
 * @param {string} canvasId         - id of the <canvas> element
 * @param {number[]} days           - sorted array of day numbers (1–31)
 * @param {number[]} incomeData     - daily income totals (parallel to days)
 * @param {number[]} expenseData    - daily expense totals (parallel to days)
 */
export function renderLineChart(canvasId, days, incomeData, expenseData) {
  destroyIfExists(canvasId);

  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  chartInstances[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels  : days.map(d => `${d}`),
      datasets: [
        {
          label          : 'Pemasukan',
          data           : incomeData,
          borderColor    : '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.10)',
          borderWidth    : 2.5,
          pointRadius    : 4,
          pointHoverRadius: 6,
          tension        : 0.35,
          fill           : true,
        },
        {
          label          : 'Pengeluaran',
          data           : expenseData,
          borderColor    : '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderWidth    : 2.5,
          pointRadius    : 4,
          pointHoverRadius: 6,
          tension        : 0.35,
          fill           : true,
        },
      ],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: true,
      interaction: {
        mode     : 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            font    : { size: 12 },
            color   : '#374151',
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              return ` ${ctx.dataset.label}: Rp ${ctx.parsed.y.toLocaleString('id-ID')}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid : { display: false },
          ticks: { color: '#6b7280', font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid       : { color: '#f3f4f6' },
          ticks: {
            color: '#6b7280',
            font : { size: 11 },
            /** Abbreviate large numbers on the y-axis (e.g. "1.5 jt") */
            callback(val) {
              if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} jt`;
              if (val >= 1_000)     return `${(val / 1_000).toFixed(0)} rb`;
              return val;
            },
          },
        },
      },
    },
  });
}
