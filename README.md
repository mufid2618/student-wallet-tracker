# Student Wallet Tracker

A personal finance web application designed for students to record income and expenses, track wallet balances across multiple sources, monitor monthly budget progress, and visualise cash-flow trends — all without a build step or external framework dependencies.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Structure](#database-structure)
6. [API Reference](#api-reference)
7. [Setup & Installation](#setup--installation)
8. [Reusing the Code](#reusing-the-code)

---

## Overview

Student Wallet Tracker is a three-page web application served by a XAMPP (Apache + PHP + MariaDB) stack. The frontend is plain HTML/CSS/JS; the backend exposes a small REST API written in PHP that reads and writes to a MariaDB database. Users register an account, log in, and can then:

- Record income or expense transactions with a date, wallet source, category, amount, and optional note.
- View a dashboard summarising the current month's income, expenses, net balance, wallet balances, budget usage, a donut chart of spending by category, and a line chart of daily cash-flow.
- Browse, filter, sort, edit, and delete all historical transactions.
- Set a monthly budget and track spending against it with a colour-coded progress bar.
- Switch between **light mode** and **dark mode** (preference persisted in `localStorage`).

Authentication is handled server-side using PHP sessions. Passwords are stored as bcrypt hashes — plain-text passwords are never written to the database.

---

## Features

| Area | Details |
|---|---|
| Auth | Register, login, logout with bcrypt password hashing and session regeneration |
| Transactions | Create, read, update, delete with full ownership checks |
| Dashboard | Monthly income/expense totals, net balance, per-wallet balances, budget progress, donut + line charts |
| History | Filterable and sortable transaction table with PDF print export |
| Budget | Monthly budget stored per-user; real-time colour-coded progress (green / yellow / red) |
| Dark Mode | Toggle button in sidebar; state persisted in `localStorage` across pages |
| Responsive | Mobile-first layout with collapsible sidebar |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Tailwind CSS (CDN), Chart.js 4.4, vanilla ES Modules |
| Backend | PHP 8.2 (procedural REST API) |
| Database | MariaDB 10.4 / MySQL 8 |
| Server | Apache via XAMPP |
| Session | PHP native sessions (server-side, cookie-based) |

No Node.js, no bundler, and no external JS framework is required.

---

## Project Structure

```
student-wallet-tracker-1/
│
├── index.html          # Dashboard page
├── transaction.html    # Add transaction form
├── history.html        # Transaction history / management
├── login.html          # Login & register page
│
├── main.js             # Dashboard page logic
├── transaction.js      # Transaction form logic
├── history.js          # History page logic
├── budget.js           # Budget calculation helpers
├── chart.js            # Chart rendering helpers (Chart.js wrappers)
│
├── style.css           # Custom styles + dark mode overrides
│
├── js/
│   └── api.js          # Centralised fetch helpers for all API calls
│
├── api/
│   ├── auth.php        # Authentication endpoint (register / login / logout / update_budget)
│   ├── transactions.php # CRUD endpoint for transactions
│   └── dashboard.php   # Aggregated statistics endpoint
│
├── config/
│   └── db.php          # PDO connection, session init, CORS headers, helper functions
│
└── SQL/
    └── student_wallet_tracker.sql  # Full database schema + sample data dump
```

---

## Database Structure

The database is named **`student_wallet_tracker`** and contains two tables.

### `users`

Stores one row per registered account.

| Column | Type | Notes |
|---|---|---|
| `id` | `INT` AUTO_INCREMENT | Primary key |
| `username` | `VARCHAR(50)` | Unique, minimum 3 characters |
| `password` | `VARCHAR(255)` | bcrypt hash — never stored in plain text |
| `monthly_budget` | `DECIMAL(15,2)` | Set by the user; `0.00` means no budget configured |
| `created_at` | `TIMESTAMP` | Set automatically on insert |

### `transactions`

Stores every income and expense entry. Each row belongs to exactly one user.

| Column | Type | Notes |
|---|---|---|
| `id` | `INT` AUTO_INCREMENT | Primary key |
| `user_id` | `INT` | Foreign key → `users.id` (CASCADE DELETE) |
| `date` | `DATE` | The calendar date of the transaction |
| `type` | `ENUM('Pemasukan','Pengeluaran')` | `Pemasukan` = income, `Pengeluaran` = expense |
| `wallet_source` | `ENUM('Cash','Bank','E-Wallet')` | Which wallet the money came from / went to |
| `category` | `VARCHAR(50)` | User-selected category (e.g. Makanan, Transportasi) |
| `amount` | `DECIMAL(15,2)` | Always positive; the sign is implied by `type` |
| `description` | `TEXT` | Optional free-text note; may be `NULL` |
| `created_at` | `TIMESTAMP` | Set automatically on insert |

### Relationships & Constraints

```
users (id) ──< transactions (user_id)
  ON DELETE CASCADE  — deleting a user removes all their transactions
  UNIQUE KEY on users.username
```

### ENUM to JavaScript Mapping

The PHP API layer normalises the DB ENUM values to lowercase English keys before sending them to the browser, and maps them back on write:

| DB value | JS value |
|---|---|
| `Pemasukan` | `income` |
| `Pengeluaran` | `expense` |
| `Cash` | `cash` |
| `Bank` | `bank` |
| `E-Wallet` | `ewallet` |

---

## API Reference

All endpoints live under `api/` and return JSON with the shape `{ "success": bool, "message": string, ...data }`. All routes except `GET api/auth.php` require an active PHP session (i.e. the user must be logged in).

### `api/auth.php`

| Method | Body / Params | Action | Response |
|---|---|---|---|
| `GET` | — | Returns session status and user data if logged in | `{ loggedIn, user? }` |
| `POST` | `{ action: "register", username, password, monthly_budget? }` | Create account and auto-login | `201 { user }` |
| `POST` | `{ action: "login", username, password }` | Authenticate and start session | `200 { user }` |
| `POST` | `{ action: "logout" }` | Destroy session | `200` |
| `POST` | `{ action: "update_budget", monthly_budget }` | Update the authenticated user's budget | `200 { monthly_budget }` |

### `api/transactions.php`

All routes require authentication.

| Method | Params / Body | Action |
|---|---|---|
| `GET` | `?year=YYYY&month=MM` | List transactions for a specific month |
| `GET` | `?all=1` | List all transactions across all time |
| `POST` | `{ date, type, wallet_source, category, amount, description? }` | Create a new transaction |
| `PUT` | `?id=N` + same body as POST | Update an existing transaction owned by the user |
| `DELETE` | `?id=N` | Delete a transaction owned by the user |

> Servers that block `DELETE`/`PUT` at the network level are supported via `X-HTTP-Method-Override: DELETE` (or `PUT`) sent as a POST request.

### `api/dashboard.php`

| Method | Params | Response data |
|---|---|---|
| `GET` | `?year=YYYY&month=MM` | `{ monthly_budget, total_income, total_expense, net_balance, wallet_balances, expense_by_category, daily_cashflow }` |

`wallet_balances` is an all-time net balance per wallet: `{ cash, bank, ewallet }`.  
`daily_cashflow` is an array of `{ day, income, expense }` objects for the selected month.

---

## Setup & Installation

### Prerequisites

- [XAMPP](https://www.apachefriends.org/) (Apache + PHP 8.x + MariaDB) — or any equivalent LAMP stack.
- A web browser.

### Steps

**1. Place the project in the web root**

```
C:\xampp\htdocs\student-wallet-tracker-1\
```

**2. Import the database**

Open phpMyAdmin (`http://localhost/phpmyadmin`) and import the file:

```
SQL/student_wallet_tracker.sql
```

This creates the `student_wallet_tracker` database with both tables and optional sample data.

**3. Configure database credentials**

Open [`config/db.php`](config/db.php) and update the constants if your MySQL setup differs from the XAMPP defaults:

```php
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'student_wallet_tracker');
define('DB_USER', 'root');   // ← your MySQL username
define('DB_PASS', '');       // ← your MySQL password
```

**4. Start XAMPP**

Start the **Apache** and **MySQL** services from the XAMPP Control Panel.

**5. Open the application**

Navigate to:

```
http://localhost/student-wallet-tracker-1/login.html
```

Register a new account or use one of the sample accounts from the SQL dump:

| Username | Password |
|---|---|
| `mahasiswa01` | *(bcrypt hash — use registration to create a fresh account)* |

> The sample data uses hashed passwords. It is recommended to register a fresh account rather than trying to reverse the sample hashes.

---

## Reusing the Code

### Adding a new transaction category

Categories are hard-coded in the `<select>` elements inside [`transaction.html`](transaction.html) and [`history.html`](history.html), and in the JavaScript files [`transaction.js`](transaction.js) and [`history.js`](history.js). To add a new category:

1. Add an `<option>` to the relevant `<select>` in the HTML form.
2. Add the same string to the category array in the corresponding JS file where categories are populated dynamically.

No database schema change is required — `category` is a free-form `VARCHAR(50)`.

### Adding a new wallet type

1. Add a new value to the `wallet_source` ENUM in the database:
   ```sql
   ALTER TABLE transactions MODIFY wallet_source ENUM('Cash','Bank','E-Wallet','Savings');
   ```
2. Add the mapping entry in the `$walletToJs` / `$walletToDb` arrays in both [`api/transactions.php`](api/transactions.php) and [`api/dashboard.php`](api/dashboard.php).
3. Add the corresponding `<option>` to the wallet `<select>` elements in the HTML files.
4. Add the display label and colour in `main.js` (`WALLET_LABELS`, `WALLET_COLOURS`).

### Connecting to a different database

All connection settings are in one place: [`config/db.php`](config/db.php). Change `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASS` as needed. The rest of the application reads from this file via `require_once`.

### Deploying to a live server

1. Upload all files to your hosting `public_html` (or equivalent) directory.
2. Import the SQL schema on your live MySQL instance.
3. Update [`config/db.php`](config/db.php) with the live database credentials.
4. Ensure the `api/` directory is accessible via HTTP and that PHP sessions are enabled (default on most shared hosts).
5. Update the `setCorsHeaders()` function in [`config/db.php`](config/db.php) to reflect your actual domain if the frontend and backend are served from different origins.

### Dark mode

The dark mode toggle in the sidebar is purely CSS-driven via the class `dark` on the `<html>` element. All dark styles are defined in [`style.css`](style.css) under `html.dark { … }` selectors. To extend dark mode support to new components, add the appropriate `html.dark .your-class { … }` rules to that file.
