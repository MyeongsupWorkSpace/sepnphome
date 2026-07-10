<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (use_json_fallback()) {
  $u = current_user_json();
  if (!$u) { json_out(['ok'=>false,'error'=>'unauthorized'], 401); exit; }
  $rows = json_user_coupons((string)$u['username']);
  json_out(['ok'=>true, 'coupons'=>$rows]);
  exit;
}

$pdo = get_db();
$u = current_user($pdo);
if (!$u) { json_out(['ok'=>false,'error'=>'unauthorized'], 401); exit; }

$now = time();
$stmt = $pdo->prepare('SELECT c.`code`, c.`title`, c.`description`, c.`expires_at`, uc.`qty`, COALESCE(uc.`granted_at`, uc.`created_at`) AS `granted_at`
  FROM `user_coupons` uc
  JOIN `coupons` c ON c.`id` = uc.`coupon_id`
  WHERE uc.`user_id` = :uid AND uc.`qty` > 0 AND (c.`expires_at` IS NULL OR c.`expires_at` >= :now)
  ORDER BY c.`id` ASC');
$stmt->execute([':uid' => (int)$u['id'], ':now' => $now]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
json_out(['ok'=>true, 'coupons'=>$rows]);
