<?php
/**
 * api/transactions.php
 * ─────────────────────────────────────────────────────────────────
 * CRUD endpoint for the authenticated user's transactions.
 *
 *  GET    ?year=YYYY&month=MM   → list transactions for a month
 *  GET    ?all=1                → list ALL transactions (history page)
 *  POST   { ... }               → create transaction
 *  PUT    ?id=N  { ... }        → update transaction
 *  DELETE ?id=N                 → delete transaction
 *
 * All routes require an active session (requireAuth()).
 * ─────────────────────────────────────────────────────────────────
 */

require_once __DIR__ . '/../config/db.php';

// getHttpMethod() supports X-HTTP-Method-Override for servers that block DELETE
$method = getHttpMethod();
$userId = requireAuth();   // 401 + exit if not logged in

// ─────────────────────────────────────────────────────────────────
// GET — list transactions
// ─────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    try {
        $pdo = getDB();

        if (isset($_GET['all'])) {
            // All-time list for the history page
            $stmt = $pdo->prepare(
                'SELECT id, date, type, wallet_source, category, amount, description, created_at
                   FROM transactions
                  WHERE user_id = ?
                  ORDER BY date DESC, id DESC'
            );
            $stmt->execute([$userId]);

        } else {
            // Scoped to a calendar month (defaults to current month)
            $year  = (int) ($_GET['year']  ?? date('Y'));
            $month = (int) ($_GET['month'] ?? date('n'));

            // Build a BETWEEN range for the month
            $from = sprintf('%04d-%02d-01', $year, $month);
            $to   = date('Y-m-t', mktime(0, 0, 0, $month, 1, $year)); // last day

            $stmt = $pdo->prepare(
                'SELECT id, date, type, wallet_source, category, amount, description, created_at
                   FROM transactions
                  WHERE user_id = ?
                    AND date BETWEEN ? AND ?
                  ORDER BY date DESC, id DESC'
            );
            $stmt->execute([$userId, $from, $to]);
        }

        $rows = $stmt->fetchAll();

        // ── Normalise DB values to the JS/front-end contract ─────
        // DB stores: type = 'Pemasukan'/'Pengeluaran', wallet = 'Cash'/'Bank'/'E-Wallet'
        // JS expects: type = 'income'/'expense',        wallet = 'cash'/'bank'/'ewallet'
        $typeToJs   = ['Pemasukan' => 'income',   'Pengeluaran' => 'expense'];
        $walletToJs = ['Cash'      => 'cash',      'Bank'       => 'bank', 'E-Wallet' => 'ewallet'];

        foreach ($rows as &$row) {
            $row['amount']        = (int) round((float) $row['amount']);
            $row['type']          = $typeToJs[$row['type']]             ?? $row['type'];
            $row['wallet_source'] = $walletToJs[$row['wallet_source']]  ?? $row['wallet_source'];
        }
        unset($row);

        jsonResponse(['success' => true, 'data' => $rows]);

    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

// ─────────────────────────────────────────────────────────────────
// POST — create transaction
// ─────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        errorResponse('Invalid JSON body.');
    }

    // ── Validate required fields ──────────────────────────────────
    $date        = trim($body['date']        ?? '');
    $type        = trim($body['type']        ?? '');
    $wallet      = trim($body['wallet_source'] ?? '');
    $category    = trim($body['category']    ?? '');
    $amount      = (int) ($body['amount']    ?? 0);
    $description = trim($body['description'] ?? '');

    // ── Value maps: JS contract → DB ENUM values ─────────────────
    $typeToDb   = ['income'  => 'Pemasukan', 'expense' => 'Pengeluaran'];
    $walletToDb = ['cash'    => 'Cash',      'bank'    => 'Bank', 'ewallet' => 'E-Wallet'];

    $errors = [];
    if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $errors[] = 'Tanggal tidak valid.';
    }
    if (!array_key_exists($type, $typeToDb)) {
        $errors[] = 'Jenis transaksi tidak valid.';
    }
    if (!array_key_exists($wallet, $walletToDb)) {
        $errors[] = 'Sumber dompet tidak valid.';
    }
    if (!$category) {
        $errors[] = 'Kategori wajib diisi.';
    }
    if ($amount <= 0) {
        $errors[] = 'Jumlah harus lebih dari 0.';
    }

    if ($errors) {
        errorResponse(implode(' ', $errors));
    }

    // Map to DB ENUM values before inserting
    $dbType   = $typeToDb[$type];
    $dbWallet = $walletToDb[$wallet];

    try {
        $pdo  = getDB();
        $stmt = $pdo->prepare(
            'INSERT INTO transactions (user_id, date, type, wallet_source, category, amount, description)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $date, $dbType, $dbWallet, $category, (float) $amount, $description]);
        $newId = (int) $pdo->lastInsertId();

        jsonResponse([
            'success' => true,
            'message' => 'Transaksi berhasil disimpan.',
            'data'    => [
                'id'           => $newId,
                'date'         => $date,
                'type'         => $type,          // return JS values, not DB ENUM
                'wallet_source'=> $wallet,
                'category'     => $category,
                'amount'       => $amount,
                'description'  => $description,
            ],
        ], 201);

    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

// ─────────────────────────────────────────────────────────────────
// PUT — update a transaction
// ─────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) errorResponse('ID transaksi tidak valid.');

    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) errorResponse('Invalid JSON body.');

    $date        = trim($body['date']          ?? '');
    $type        = trim($body['type']          ?? '');
    $wallet      = trim($body['wallet_source'] ?? '');
    $category    = trim($body['category']      ?? '');
    $amount      = (int) ($body['amount']      ?? 0);
    $description = trim($body['description']   ?? '');

    $typeToDb   = ['income' => 'Pemasukan', 'expense' => 'Pengeluaran'];
    $walletToDb = ['cash'   => 'Cash', 'bank' => 'Bank', 'ewallet' => 'E-Wallet'];

    $errors = [];
    if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) $errors[] = 'Tanggal tidak valid.';
    if (!array_key_exists($type,   $typeToDb))   $errors[] = 'Jenis transaksi tidak valid.';
    if (!array_key_exists($wallet, $walletToDb)) $errors[] = 'Sumber dompet tidak valid.';
    if (!$category)  $errors[] = 'Kategori wajib diisi.';
    if ($amount <= 0) $errors[] = 'Jumlah harus lebih dari 0.';
    if ($errors) errorResponse(implode(' ', $errors));

    try {
        $pdo = getDB();
        $check = $pdo->prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ? LIMIT 1');
        $check->execute([$id, $userId]);
        if (!$check->fetch()) errorResponse('Transaksi tidak ditemukan atau bukan milik Anda.', 404);

        $pdo->prepare(
            'UPDATE transactions
                SET date=?, type=?, wallet_source=?, category=?, amount=?, description=?
              WHERE id=? AND user_id=?'
        )->execute([
            $date, $typeToDb[$type], $walletToDb[$wallet],
            $category, (float) $amount, $description,
            $id, $userId,
        ]);

        jsonResponse([
            'success' => true,
            'message' => 'Transaksi berhasil diperbarui.',
            'data'    => [
                'id'            => $id,
                'date'          => $date,
                'type'          => $type,
                'wallet_source' => $wallet,
                'category'      => $category,
                'amount'        => $amount,
                'description'   => $description,
            ],
        ]);
    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

// ─────────────────────────────────────────────────────────────────
// DELETE — remove a transaction
// ─────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        errorResponse('ID transaksi tidak valid.');
    }

    try {
        $pdo  = getDB();

        // Verify ownership before deleting
        $stmt = $pdo->prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ? LIMIT 1');
        $stmt->execute([$id, $userId]);
        if (!$stmt->fetch()) {
            errorResponse('Transaksi tidak ditemukan atau bukan milik Anda.', 404);
        }

        $del = $pdo->prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?');
        $del->execute([$id, $userId]);

        jsonResponse(['success' => true, 'message' => 'Transaksi berhasil dihapus.']);

    } catch (PDOException $e) {
        errorResponse('Database error: ' . $e->getMessage(), 500);
    }
}

errorResponse('Method not allowed.', 405);
