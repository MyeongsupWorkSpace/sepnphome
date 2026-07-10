<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$pdo = get_db();
require_admin($pdo);

$userQuery = trim((string)($_POST['user_id'] ?? ''));
$couponId = (int)($_POST['coupon_id'] ?? 0);
if ($userQuery === '' || $couponId <= 0) {
    json_out(["ok" => false, "error" => "user_id, coupon_id required"], 400);
}

$stmt = $pdo->prepare('SELECT `id` FROM `users` WHERE `id` = :id OR `username` = :q OR `nickname` = :q LIMIT 1');
$stmt->execute([':id' => (int)$userQuery, ':q' => $userQuery]);
$userId = (int)($stmt->fetchColumn() ?: 0);
if ($userId <= 0) { json_out(["ok" => false, "error" => "user_not_found"], 404); }

$res = grantCouponToUser($userId, $couponId);
if (!empty($res['error'])) {
    json_out(["ok" => false, "error" => $res['error']], 400);
}
json_out(["ok" => true]);
