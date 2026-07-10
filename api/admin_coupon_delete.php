<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
$id = (int)($in['id'] ?? 0);
if ($id <= 0) { json_out(['ok' => false, 'error' => 'bad_request'], 400); }

$pdo = get_db();
require_admin($pdo);

$pdo->prepare('DELETE FROM `user_coupons` WHERE `coupon_id` = :id')->execute([':id' => $id]);
$pdo->prepare('DELETE FROM `coupons` WHERE `id` = :id')->execute([':id' => $id]);
json_out(['ok' => true]);
