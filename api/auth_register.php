<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
if (!is_array($in)) { $in = []; }

$u = trim((string)($in['username'] ?? ''));
$p = (string)($in['password'] ?? '');
$pc = (string)($in['password_confirm'] ?? ($in['passwordConfirm'] ?? ''));
$n = trim((string)($in['nickname'] ?? ''));
if ($u === '' || $p === '') { json_out(['ok'=>false,'error'=>'missing_fields'], 400); return; }
if ($pc === '') { json_out(['ok'=>false,'error'=>'password_confirm_required'], 400); return; }
if ($p !== $pc) { json_out(['ok'=>false,'error'=>'password_mismatch'], 400); return; }

try {
  if (use_json_fallback()) {
    if (json_user_find($u)) { json_out(['ok'=>false,'error'=>'username_taken'], 409); return; }
    if ($n !== '' && json_user_find_by_nickname($n)) { json_out(['ok'=>false,'error'=>'nickname_taken'], 409); return; }
    $hash = password_hash($p, PASSWORD_DEFAULT);
    json_user_add($u, $hash, $n ?: $u, 'Normal', 'user', '승인대기');
    json_user_coupon_add($u, 'DIEFREE', 1);
    json_user_coupon_add($u, 'FREESAMPLE', 1);
    json_out(['ok'=>true, 'status'=>'승인대기']);
  } else {
    $pdo = get_db();
    $stmt = $pdo->prepare('SELECT `id` FROM `users` WHERE `username` = :u LIMIT 1');
    $stmt->execute([':u' => $u]);
    if ($stmt->fetchColumn()) { json_out(['ok'=>false,'error'=>'username_taken'], 409); return; }
    if ($n !== '') {
      $stmt = $pdo->prepare('SELECT `id` FROM `users` WHERE `nickname` = :n LIMIT 1');
      $stmt->execute([':n' => $n]);
      if ($stmt->fetchColumn()) { json_out(['ok'=>false,'error'=>'nickname_taken'], 409); return; }
    }
    $hash = password_hash($p, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO `users`(`username`,`password_hash`,`nickname`,`rank`,`role`,`status`,`created_at`) VALUES(:u,:ph,:n,:r,:role,:s,:ts)');
    $stmt->execute([
      ':u' => $u,
      ':ph' => $hash,
      ':n' => $n ?: $u,
      ':r' => 'Normal',
      ':role' => 'user',
      ':s' => '승인대기',
      ':ts' => time(),
    ]);
    $newId = (int)$pdo->lastInsertId();
    if ($newId > 0) {
      grant_default_coupons($pdo, $newId);
    }
    json_out(['ok'=>true, 'status'=>'승인대기']);
  }
} catch (Throwable $e) {
  json_out(['ok'=>false,'error'=>'username_taken'], 409);
}
