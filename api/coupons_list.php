<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$pdo = get_db();
require_admin($pdo);

$rows = $pdo->query('SELECT `id`, `code`, `title`, `description`, `expires_at`, `created_at` FROM `coupons` ORDER BY `id` ASC')->fetchAll(PDO::FETCH_ASSOC);
json_out(['ok' => true, 'coupons' => $rows]);
