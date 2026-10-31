<?php
/**
 * api/dashboard.php
 * ─────────────────────────────────────────────────────────────────
 * Aggregated statistics for the Dashboard page (index.html).
 * Requires an authenticated session.
 *
 *  GET ?year=YYYY&month=MM
 *
 * Returns:
 * {
 *   "success": true,
 *   "data": {
 *     "monthly_budget" : number,
 *     "total_income"   : number,
 *     "total_expense"  : number,
 *     "net_balance"    : number,
 *     "wallet_balances": { "cash": n, "bank": n, "ewallet": n },
 *     "expense_by_category": { "<category>": n, ... },
 *     "daily_cashflow" : [
 *       { "day": 1, "income": n, "expense": n }, ...
 *     ]
 *   }
 * }
 * ─────────────────────────────────────────────────────────────────
 */

require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    errorResponse('Method not allowed.', 405);
}

$userId = requireAuth();

$year  = (int) ($_GET['year']  ?? date('Y'));
$month = (int) ($_GET['month'] ?? date('n'));

// Build the month BETWEEN range
$from = sprintf('%04d-%02d-01', $year, $month);
$to   = date('Y-m-t', mktime(0, 0, 0, $month, 1, $year));

try {
    $pdo = getDB();

    // ── 1. Monthly budget from users table ────────────────────────
    $stmt = $pdo->prepare('SELECT monthly_budget FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $monthlyBudget = (int) ($stmt->fetchColumn() ?? 0);

    // ── 2. Monthly income & expense totals ────────────────────────
    // DB uses ENUM('Pemasukan','Pengeluaran') — must match exactly
    $stmt = $pdo->prepare(
        'SELECT type, SUM(amount) AS total
           FROM transactions
          WHERE user_id = ?
            AND date BETWEEN ? AND ?
          GROUP BY type'
    );
    $stmt->execute([$userId, $from, $to]);

    $totalIncome  = 0;
    $totalExpense = 0;
    foreach ($stmt->fetchAll() as $row) {
        if ($row['type'] === 'Pemasukan')   $totalIncome  = (int) round((float) $row['total']);
        if ($row['type'] === 'Pengeluaran') $totalExpense = (int) round((float) $row['total']);
    }

    // ── 3. All-time wallet balances ───────────────────────────────
    //    Net = SUM(income) - SUM(expense) per wallet, all time.
    //    DB ENUM: 'Cash','Bank','E-Wallet' → map to JS keys after fetch
    $stmt = $pdo->prepare(
        "SELECT wallet_source,
                SUM(CASE WHEN type = 'Pemasukan'   THEN amount ELSE 0 END) AS income_total,
                SUM(CASE WHEN type = 'Pengeluaran' THEN amount ELSE 0 END) AS expense_total
           FROM transactions
          WHERE user_id = ?
          GROUP BY wallet_source"
    );
    $stmt->execute([$userId]);

    // Map DB wallet ENUM → JS keys
    $walletMap      = ['Cash' => 'cash', 'Bank' => 'bank', 'E-Wallet' => 'ewallet'];
    $walletBalances = ['cash' => 0, 'bank' => 0, 'ewallet' => 0];
    foreach ($stmt->fetchAll() as $row) {
        $jsKey = $walletMap[$row['wallet_source']] ?? null;
        if ($jsKey !== null) {
            $walletBalances[$jsKey] = (int) round((float) $row['income_total'])
                                    - (int) round((float) $row['expense_total']);
        }
    }

    // ── 4. Expense breakdown by category (current month) ─────────
    $stmt = $pdo->prepare(
        "SELECT category, SUM(amount) AS total
           FROM transactions
          WHERE user_id = ?
            AND type    = 'Pengeluaran'
            AND date BETWEEN ? AND ?
          GROUP BY category
          ORDER BY total DESC"
    );
    $stmt->execute([$userId, $from, $to]);

    $expenseByCategory = [];
    foreach ($stmt->fetchAll() as $row) {
        $expenseByCategory[$row['category']] = (int) $row['total'];
    }

    // ── 5. Daily cash-flow (current month) ───────────────────────
    $stmt = $pdo->prepare(
        'SELECT DAY(date) AS day, type, SUM(amount) AS total
           FROM transactions
          WHERE user_id = ?
            AND date BETWEEN ? AND ?
          GROUP BY DAY(date), type
          ORDER BY DAY(date)'
    );
    $stmt->execute([$userId, $from, $to]);

    // Merge into { day → { income, expense } }
    // DB type values are 'Pemasukan'/'Pengeluaran' — map to JS keys
    $dailyMap = [];
    foreach ($stmt->fetchAll() as $row) {
        $d     = (int) $row['day'];
        $jsKey = ($row['type'] === 'Pemasukan') ? 'income' : 'expense';
        if (!isset($dailyMap[$d])) {
            $dailyMap[$d] = ['day' => $d, 'income' => 0, 'expense' => 0];
        }
        $dailyMap[$d][$jsKey] = (int) round((float) $row['total']);
    }
    ksort($dailyMap);
    $dailyCashflow = array_values($dailyMap);

    // ── Respond ───────────────────────────────────────────────────
    jsonResponse([
        'success' => true,
        'data'    => [
            'monthly_budget'       => $monthlyBudget,
            'total_income'         => $totalIncome,
            'total_expense'        => $totalExpense,
            'net_balance'          => $totalIncome - $totalExpense,
            'wallet_balances'      => $walletBalances,
            'expense_by_category'  => $expenseByCategory,
            'daily_cashflow'       => $dailyCashflow,
        ],
    ]);

} catch (PDOException $e) {
    errorResponse('Database error: ' . $e->getMessage(), 500);
}
