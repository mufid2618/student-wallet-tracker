/**
 * js/api.js
 * ──────────────────────────────────────────────────────────────
 * Centralised fetch() wrapper layer for all API calls.
 *
 * Key design decisions:
 *  - All requests use credentials: 'include' so the PHP session
 *    cookie is sent on every call.
 *  - Every function is async and returns the parsed JSON body.
 *  - Any response with status 401 triggers a redirect to login.html
 *    (the global auth guard).
 *  - Non-ok responses throw an Error with the server message.
 * ──────────────────────────────────────────────────────────────
 */

/** Base path to API directory — adjust if served from a sub-folder */
const API_BASE = './api';

/* ─── Core fetch wrapper ──────────────────────────────────────── */

/**
 * Send an HTTP request and return the parsed JSON.
 * Handles 401 redirect and non-ok status errors uniformly.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Object>}
 */
async function request(url, options = {}) {
  // Always include session cookie
  options.credentials = 'include';

  // Default Content-Type for POST bodies
  if (options.body && !options.headers) {
    options.headers = { 'Content-Type': 'application/json' };
  }

  const res = await fetch(url, options);

  // ── 401: session expired or not logged in → redirect ──────────
  if (res.status === 401) {
    redirectToLogin();
    // Return a never-resolving promise so callers don't continue
    return new Promise(() => {});
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }

  return json;
}

/**
 * Redirect the browser to login.html.
 * Appends `?redirect=<current-path>` so login.js can send the user
 * back to where they came from after a successful login.
 */
export function redirectToLogin() {
  const current = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `login.html?redirect=${current}`;
}

/* ─── Auth API ────────────────────────────────────────────────── */

/**
 * Check whether the current PHP session is authenticated.
 * Called on page load to guard protected pages.
 * @returns {Promise<{ loggedIn: boolean, user?: Object }>}
 */
export async function checkSession() {
  const data = await fetch(`${API_BASE}/auth.php`, { credentials: 'include' });
  if (data.status === 401 || data.status === 200) {
    return data.json();
  }
  return { loggedIn: false };
}

/**
 * Log in with username + password.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>}  server response with user data
 */
export async function login(username, password) {
  return request(`${API_BASE}/auth.php`, {
    method: 'POST',
    body  : JSON.stringify({ action: 'login', username, password }),
  });
}

/**
 * Register a new user account.
 * @param {string} username
 * @param {string} password
 * @param {number} monthlyBudget
 * @returns {Promise<Object>}
 */
export async function register(username, password, monthlyBudget) {
  return request(`${API_BASE}/auth.php`, {
    method: 'POST',
    body  : JSON.stringify({
      action         : 'register',
      username,
      password,
      monthly_budget : monthlyBudget,
    }),
  });
}

/**
 * Log out (destroy PHP session).
 * Always redirects to login.html afterward.
 */
export async function logout() {
  try {
    await request(`${API_BASE}/auth.php`, {
      method: 'POST',
      body  : JSON.stringify({ action: 'logout' }),
    });
  } catch {
    // Ignore errors — redirect regardless
  }
  window.location.href = 'login.html';
}

/**
 * Update the authenticated user's monthly budget.
 * @param {number} monthlyBudget
 * @returns {Promise<Object>}
 */
export async function updateBudget(monthlyBudget) {
  return request(`${API_BASE}/auth.php`, {
    method: 'POST',
    body  : JSON.stringify({ action: 'update_budget', monthly_budget: monthlyBudget }),
  });
}

/* ─── Dashboard API ───────────────────────────────────────────── */

/**
 * Fetch all aggregated statistics for the dashboard.
 * @param {number} year   - e.g. 2025
 * @param {number} month  - 1-based (1 = January)
 * @returns {Promise<Object>}  the `data` object from dashboard.php
 */
export async function fetchDashboard(year, month) {
  const res = await request(
    `${API_BASE}/dashboard.php?year=${year}&month=${month}`
  );
  return res.data;
}

/* ─── Transactions API ────────────────────────────────────────── */

/**
 * Fetch transactions for a specific month.
 * @param {number} year
 * @param {number} month  1-based
 * @returns {Promise<Object[]>}
 */
export async function fetchTransactionsByMonth(year, month) {
  const res = await request(
    `${API_BASE}/transactions.php?year=${year}&month=${month}`
  );
  return res.data;
}

/**
 * Fetch ALL transactions for the history page.
 * @returns {Promise<Object[]>}
 */
export async function fetchAllTransactions() {
  const res = await request(`${API_BASE}/transactions.php?all=1`);
  return res.data;
}

/**
 * Create a new transaction.
 * @param {{
 *   date        : string,
 *   type        : 'income'|'expense',
 *   wallet_source: 'cash'|'bank'|'ewallet',
 *   category    : string,
 *   amount      : number,
 *   description : string
 * }} txData
 * @returns {Promise<Object>}  server response with saved data
 */
export async function createTransaction(txData) {
  return request(`${API_BASE}/transactions.php`, {
    method: 'POST',
    body  : JSON.stringify(txData),
  });
}

/**
 * Update an existing transaction.
 * Uses POST + X-HTTP-Method-Override: PUT so Apache won't block it.
 *
 * @param {number|string} id
 * @param {{ date, type, wallet_source, category, amount, description }} txData
 * @returns {Promise<Object>}
 */
export async function updateTransactionById(id, txData) {
  return request(`${API_BASE}/transactions.php?id=${id}`, {
    method : 'POST',
    headers: {
      'Content-Type'          : 'application/json',
      'X-HTTP-Method-Override': 'PUT',
    },
    body: JSON.stringify(txData),
  });
}

/**
 * Delete a transaction by its numeric ID.
 *
 * Sends a true HTTP DELETE request. Also sets X-HTTP-Method-Override: DELETE
 * so the PHP getHttpMethod() helper can honour it even when Apache/XAMPP
 * downgrades or blocks the DELETE verb at the server level.
 *
 * @param {number} id
 * @returns {Promise<Object>}
 */
export async function deleteTransactionById(id) {
  return request(`${API_BASE}/transactions.php?id=${id}`, {
    method : 'POST', // UBAH INI JADI POST agar tidak diblokir Apache
    headers: {
      'Content-Type'             : 'application/json',
      'X-HTTP-Method-Override'   : 'DELETE', // config/db.php akan mengubah POST ini jadi DELETE
    },
  });
}

/* ─── Auth guard helper ───────────────────────────────────────── */

/**
 * Call this at the top of every protected page script.
 * If the session is not active, redirects to login.html immediately.
 * Returns the user object so the page can display the username etc.
 *
 * @returns {Promise<{ id: number, username: string, monthly_budget: number }>}
 */
export async function guardAuth() {
  let session;
  try {
    session = await checkSession();
  } catch {
    redirectToLogin();
    return new Promise(() => {});
  }

  if (!session.loggedIn) {
    redirectToLogin();
    return new Promise(() => {});
  }

  return session.user;
}
