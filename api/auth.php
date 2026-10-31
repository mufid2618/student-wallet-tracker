<?php
/**
 * api/auth.php
 * ─────────────────────────────────────────────────────────────────
 * Authentication endpoint — handles three actions via POST body:
 *
 *   POST { "action": "register", "username": "...", "password": "...", "monthly_budget": 1000000 }
 *   POST { "action": "login",    "username": "...", "password": "..." }
 *   POST { "action": "logout" }
 *   GET  (no body)                → returns current session status
 *
 * Responses always include: { "success": bool, "message": string, ...data }
 * ─────────────────────────────────────────────────────────────────
 */

require_once __DIR__ . '/../config/db.php';

// ── Route by HTTP method ──────────────────────────────────────────
// getHttpMethod() handles OPTIONS (already intercepted in db.php) and
// X-HTTP-Method-Override for environments that block DELETE at the server level.
$method = getHttpMethod();

if ($method === 'GET') {
    // Health-check / session status
    if (!empty($_SESSION['user_id'])) {
        jsonResponse([
            'success'  => true,
            'loggedIn' => true,
            'user'     => [
                'id'             => $_SESSION['user_id'],
                'username'       => $_SESSION['username']       ?? '',
                'monthly_budget' => $_SESSION['monthly_budget'] ?? 0,
            ],
        ]);
    }
    jsonResponse(['success' => true, 'loggedIn' => false]);
}

if ($method !== 'POST') {
    errorResponse('Method not allowed.', 405);
}

// ── Parse JSON body ───────────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    errorResponse('Invalid JSON body.');
}

$action = $body['action'] ?? '';

// ─────────────────────────────────────────────────────────────────
// ACTION: register
// ─────────────────────────────────────────────────────────────────
if ($action === 'register') {
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';
    $budget   = (int) ($body['monthly_budget'] ?? 0);

    // Validation
    if (strlen($username) < 3) {
        errorResponse('Username minimal 3 karakter.');
    }
    if (strlen($password) < 6) {
        errorResponse('Password minimal 6 karakter.');
    }

    try {
        $pdo = getDB();

        // Check username uniqueness
        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            errorResponse('Username sudah digunakan.');
        }

        // Insert new user with hashed password
        // monthly_budget stored as decimal in DB — cast to float
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare(
            'INSERT INTO users (username, password, monthly_budget) VALUES (?, ?, ?)'
        );
        $stmt->execute([$username, $hash, (float) $budget]);
        $newId = (int) $pdo->lastInsertId();

        // Auto-login after registration
        $_SESSION['user_id']        = $newId;
        $_SESSION['username']       = $username;
        $_SESSION['monthly_budget'] = (int) $budget;

        jsonResponse([
            'success' => true,
            'message' => 'Registrasi berhasil! Selamat datang, ' . $username . '.',
            'user'    => [
                'id'             => $newId,
                'username'       => $username,
                'monthly_budget' => (int) $budget,
            ],
        ], 201);

    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

// ─────────────────────────────────────────────────────────────────
// ACTION: login
// ─────────────────────────────────────────────────────────────────
if ($action === 'login') {
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if (!$username || !$password) {
        errorResponse('Username dan password wajib diisi.');
    }

    try {
        $pdo  = getDB();
        $stmt = $pdo->prepare('SELECT id, password, monthly_budget FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            errorResponse('Username atau password salah.', 401);
        }

        // Regenerate session ID to prevent fixation attacks
        session_regenerate_id(true);

        $_SESSION['user_id']        = (int) $user['id'];
        $_SESSION['username']       = $username;
        // monthly_budget is decimal(15,2) in DB — round to int for JS
        $_SESSION['monthly_budget'] = (int) round((float) $user['monthly_budget']);

        jsonResponse([
            'success' => true,
            'message' => 'Login berhasil! Selamat datang, ' . $username . '.',
            'user'    => [
                'id'             => (int) $user['id'],
                'username'       => $username,
                'monthly_budget' => (int) round((float) $user['monthly_budget']),
            ],
        ]);

    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

// ─────────────────────────────────────────────────────────────────
// ACTION: logout
// ─────────────────────────────────────────────────────────────────
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(
            session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']
        );
    }
    session_destroy();
    jsonResponse(['success' => true, 'message' => 'Berhasil logout.']);
}

// ─────────────────────────────────────────────────────────────────
// ACTION: update_budget  (PATCH-like, still via POST for simplicity)
// ─────────────────────────────────────────────────────────────────
if ($action === 'update_budget') {
    $userId = requireAuth();
    $budget = (int) ($body['monthly_budget'] ?? 0);

    if ($budget <= 0) {
        errorResponse('Nominal anggaran harus lebih dari 0.');
    }

    try {
        $pdo  = getDB();
        // Store as decimal(15,2) — cast to float matches DB type
        $stmt = $pdo->prepare('UPDATE users SET monthly_budget = ? WHERE id = ?');
        $stmt->execute([(float) $budget, $userId]);
        $_SESSION['monthly_budget'] = $budget;

        jsonResponse([
            'success'        => true,
            'message'        => 'Anggaran berhasil diperbarui.',
            'monthly_budget' => $budget,
        ]);

    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

errorResponse('Action tidak dikenal.', 400);
