<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
$id = (int)($in['id'] ?? 0);
if ($id <= 0) { json_out(['ok'=>false,'error'=>'bad_request'], 400); }

function make_temp_password(int $len = 10): string {
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  $out = '';
  $max = strlen($chars) - 1;
  for ($i = 0; $i < $len; $i++) {
    $out .= $chars[random_int(0, $max)];
  }
  return $out;
}

if (use_json_fallback()) {
  require_admin_json();
  $target = json_user_find_by_id($id);
  if ($target && strtolower((string)$target['username']) === 'sepnp') {
    json_out(['ok' => false, 'error' => 'protected_user'], 403); exit;
  }
  $temp = make_temp_password();
  $hash = password_hash($temp, PASSWORD_DEFAULT);
  $ok = json_user_update_password_by_id($id, $hash);
  json_out(['ok' => $ok, 'temp_password' => $temp]);
} else {
  $pdo = get_db();
  require_admin($pdo);
  $u = $pdo->prepare('SELECT `username` FROM `users` WHERE `id` = :id');
  $u->execute([':id'=>$id]);
  $uname = (string)($u->fetchColumn() ?: '');
  if (strtolower($uname) === 'sepnp') { json_out(['ok'=>false,'error'=>'protected_user'], 403); exit; }
  $temp = make_temp_password();
  $hash = password_hash($temp, PASSWORD_DEFAULT);
  $pdo->prepare('UPDATE `users` SET `password_hash` = :ph WHERE `id` = :id')->execute([':ph' => $hash, ':id' => $id]);
  json_out(['ok'=>true, 'temp_password' => $temp]);
}
