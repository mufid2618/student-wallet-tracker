/**
 * js/login.js  —  Login / Register page logic (login.html)
 * ──────────────────────────────────────────────────────────────
 * Handles:
 *  1. Auto-redirect to index.html when user is already logged in.
 *  2. Login form submission → api/auth.php login.
 *  3. Register form submission → api/auth.php register.
 *  4. Inline validation for both forms.
 *  5. Post-login redirect back to the originally requested page
 *     (using ?redirect= query param set by guardAuth()).
 * ──────────────────────────────────────────────────────────────
 */

import { login, register, checkSession } from './api.js';

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
  setTimeout(() => { toast.classList.remove('show'); toast.classList.add('hide'); }, 3000);
}

/* ─── Inline error helpers ───────────────────────────────────── */

function showError(errorId, msg) {
  const el = document.getElementById(errorId);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function clearError(errorId) {
  const el = document.getElementById(errorId);
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

function clearLoginErrors() {
  ['l-err-username', 'l-err-password', 'l-global-err'].forEach(clearError);
  document.getElementById('l-username')?.classList.remove('error');
  document.getElementById('l-password')?.classList.remove('error');
}

function clearRegisterErrors() {
  ['r-err-username', 'r-err-password', 'r-err-confirm', 'r-global-err'].forEach(clearError);
  ['r-username', 'r-password', 'r-password-confirm'].forEach(id => {
    document.getElementById(id)?.classList.remove('error');
  });
}

/* ─── Redirect helper ────────────────────────────────────────── */

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('redirect');
  // Only allow relative paths to prevent open-redirect attacks
  if (target && target.startsWith('/')) return target;
  return 'index.html';
}

/* ─── Button loading state ───────────────────────────────────── */

function setSubmitting(prefix, submitting) {
  const btn     = document.getElementById(`${prefix}-spinner`)?.closest('button');
  const text    = document.getElementById(`${prefix}-btn-text`);
  const spinner = document.getElementById(`${prefix}-spinner`);
  if (btn)     btn.disabled = submitting;
  if (spinner) spinner.classList.toggle('hidden', !submitting);
  if (text)    text.textContent = submitting
    ? (prefix === 'login' ? 'Masuk…' : 'Membuat Akun…')
    : (prefix === 'login' ? 'Masuk'  : 'Buat Akun');
}

/* ─── Login handler ──────────────────────────────────────────── */

async function handleLogin(e) {
  e.preventDefault();
  clearLoginErrors();

  const username = document.getElementById('l-username').value.trim();
  const password = document.getElementById('l-password').value;

  let valid = true;
  if (!username) {
    showError('l-err-username', 'Username wajib diisi.');
    document.getElementById('l-username').classList.add('error');
    valid = false;
  }
  if (!password) {
    showError('l-err-password', 'Password wajib diisi.');
    document.getElementById('l-password').classList.add('error');
    valid = false;
  }
  if (!valid) return;

  setSubmitting('login', true);
  try {
    await login(username, password);
    showToast('Login berhasil! Mengarahkan…');
    setTimeout(() => { window.location.href = getRedirectTarget(); }, 800);
  } catch (err) {
    setSubmitting('login', false);
    showError('l-global-err', err.message || 'Login gagal. Periksa username/password.');
  }
}

/* ─── Register handler ───────────────────────────────────────── */

async function handleRegister(e) {
  e.preventDefault();
  clearRegisterErrors();

  const username = document.getElementById('r-username').value.trim();
  const password = document.getElementById('r-password').value;
  const confirm  = document.getElementById('r-password-confirm').value;
  const budget   = parseInt(document.getElementById('r-budget').value || '0', 10);

  let valid = true;
  if (username.length < 3) {
    showError('r-err-username', 'Username minimal 3 karakter.');
    document.getElementById('r-username').classList.add('error');
    valid = false;
  }
  if (password.length < 6) {
    showError('r-err-password', 'Password minimal 6 karakter.');
    document.getElementById('r-password').classList.add('error');
    valid = false;
  }
  if (password !== confirm) {
    showError('r-err-confirm', 'Konfirmasi password tidak cocok.');
    document.getElementById('r-password-confirm').classList.add('error');
    valid = false;
  }
  if (!valid) return;

  setSubmitting('register', true);
  try {
    await register(username, password, budget);
    showToast('Akun berhasil dibuat! Mengarahkan ke dashboard…');
    setTimeout(() => { window.location.href = 'index.html'; }, 900);
  } catch (err) {
    setSubmitting('register', false);
    showError('r-global-err', err.message || 'Registrasi gagal. Coba lagi.');
  }
}

/* ─── Live error clearing ────────────────────────────────────── */

function bindLiveClearing() {
  [
    { field: 'l-username', err: 'l-err-username' },
    { field: 'l-password', err: 'l-err-password' },
  ].forEach(({ field, err }) => {
    document.getElementById(field)?.addEventListener('input', () => {
      clearError(err);
      document.getElementById(field)?.classList.remove('error');
      clearError('l-global-err');
    });
  });

  [
    { field: 'r-username',         err: 'r-err-username' },
    { field: 'r-password',         err: 'r-err-password' },
    { field: 'r-password-confirm', err: 'r-err-confirm'  },
  ].forEach(({ field, err }) => {
    document.getElementById(field)?.addEventListener('input', () => {
      clearError(err);
      document.getElementById(field)?.classList.remove('error');
      clearError('r-global-err');
    });
  });
}

/* ─── Bootstrap ─────────────────────────────────────────────── */

(async function init() {
  // If user is already logged in, skip the login page
  try {
    const session = await checkSession();
    if (session.loggedIn) {
      window.location.href = getRedirectTarget();
      return;
    }
  } catch {
    // Network error — stay on login page
  }

  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('register-form')?.addEventListener('submit', handleRegister);
  bindLiveClearing();
})();
