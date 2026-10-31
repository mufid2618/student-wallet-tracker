<?php
/**
 * config/db.php
 * ─────────────────────────────────────────────────────────────────
 * Central database configuration.
 * - Starts a PHP session (called once; subsequent calls are no-ops).
 * - Returns a PDO connection with error-mode EXCEPTION.
 * - Sets PDO::ATTR_DEFAULT_FETCH_MODE to FETCH_ASSOC for clean arrays.
 *
 * Include this file at the TOP of every API endpoint:
 *   require_once __DIR__ . '/../config/db.php';
 * ─────────────────────────────────────────────────────────────────
 */

// ── Session ──────────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ── Database credentials ─────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'student_wallet_tracker');
define('DB_USER', 'root');      // ← change to your MySQL username
define('DB_PASS', '');          // ← change to your MySQL password
define('DB_CHARSET', 'utf8mb4');

/**
 * Return a singleton PDO connection.
 * Throws a PDOException (caught by the endpoint) if connection fails.
 *
 * @return PDO
 */
function getDB(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }

    return $pdo;
}

// ── CORS & JSON response helpers ──────────────────────────────────

/**
 * Set CORS headers permissive enough for local XAMPP development.
 * NOTE: Access-Control-Allow-Origin cannot be '*' when
 *       Allow-Credentials is 'true' — browsers reject that combo.
 *       We reflect the request Origin (or default to localhost).
 */
function setCorsHeaders(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost';
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, X-HTTP-Method-Override');
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

/**
 * Send a JSON response and exit.
 *
 * @param mixed $data    Anything JSON-serialisable.
 * @param int   $status  HTTP status code (default 200).
 */
function jsonResponse(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Return a standardised error response and exit.
 *
 * @param string $message  Human-readable error message.
 * @param int    $status   HTTP status code (default 400).
 */
function errorResponse(string $message, int $status = 400): never
{
    jsonResponse(['success' => false, 'message' => $message], $status);
}

/**
 * Assert that the current session has an authenticated user.
 * If not, respond with 401 and exit.
 *
 * @return int  The authenticated user_id.
 */
function requireAuth(): int
{
    if (empty($_SESSION['user_id'])) {
        errorResponse('Unauthorized. Please log in.', 401);
    }
    return (int) $_SESSION['user_id'];
}

/**
 * Return the effective HTTP method.
 *
 * Some servers / reverse-proxies block DELETE/PUT at the network level.
 * A client can send POST with header  X-HTTP-Method-Override: DELETE
 * and this function will return 'DELETE', letting the API handle it normally.
 *
 * @return string  Uppercase method name, e.g. 'GET', 'POST', 'DELETE'.
 */
function getHttpMethod(): string
{
    $real     = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $override = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '');
    // Only allow downgrade from POST → DELETE|PUT|PATCH via override
    if ($real === 'POST' && in_array($override, ['DELETE', 'PUT', 'PATCH'], true)) {
        return $override;
    }
    return $real;
}

// ── Handle pre-flight OPTIONS & set CORS (web context only) ───────
if (PHP_SAPI !== 'cli') {
    setCorsHeaders();
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
