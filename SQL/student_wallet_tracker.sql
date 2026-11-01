-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 01 Nov 2026 pada 05.39
-- Versi server: 10.4.32-MariaDB
-- Versi PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `student_wallet_tracker`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `transactions`
--

CREATE TABLE `transactions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `type` enum('Pemasukan','Pengeluaran') NOT NULL,
  `wallet_source` enum('Cash','Bank','E-Wallet') NOT NULL,
  `category` varchar(50) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `transactions`
--

INSERT INTO `transactions` (`id`, `user_id`, `date`, `type`, `wallet_source`, `category`, `amount`, `description`, `created_at`) VALUES
(1, 1, '2026-10-31', 'Pemasukan', 'Bank', 'Uang Saku', 2000000.00, 'Uang bulanan dari orang tua', '2026-10-31 05:56:14'),
(2, 1, '2026-10-31', 'Pengeluaran', 'Cash', 'Makanan', 25000.00, 'Makan siang soto ayam', '2026-10-31 05:56:14'),
(3, 1, '2026-10-31', 'Pengeluaran', 'E-Wallet', 'Transportasi', 15000.00, 'Ojek online ke kampus', '2026-10-31 05:56:14'),
(10, 6, '2026-10-31', 'Pemasukan', 'Bank', 'Gaji', 20000000.00, '', '2026-10-31 06:55:20'),
(11, 6, '2026-10-31', 'Pengeluaran', 'Bank', 'Pendidikan', 7000000.00, 'Bayr UKT', '2026-10-31 06:57:13'),
(15, 5, '2026-11-01', 'Pemasukan', 'Cash', 'Gaji', 3000000.00, 'Uang saku', '2026-11-01 04:19:25'),
(17, 5, '2026-11-01', 'Pengeluaran', 'Cash', 'Pendidikan', 30000.00, 'bayar infak', '2026-11-01 04:21:27');

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `monthly_budget` decimal(15,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `monthly_budget`, `created_at`) VALUES
(1, 'mahasiswa01', '$2y$10$wO8oK7bB7rI8e2m/X7D0uuXmS.JgV2lG1KqG6aO9U0q1Q8oW1/wO.', 1500000.00, '2026-10-31 05:56:13'),
(5, 'mufid', '$2y$10$RIqe.OAjjF7JSQZvEpae/ePVDr67vCDlStFXabocb2AJyoOrySX/K', 0.00, '2026-10-31 06:48:16'),
(6, 'damar', '$2y$10$3FfVO6RpfsQ7sjN.MlSFouCG98kOF2suTtRR2yYOxxZ.gUSK3.1Se', 10000000.00, '2026-10-31 06:54:44');

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
