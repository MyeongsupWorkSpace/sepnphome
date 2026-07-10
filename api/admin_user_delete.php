<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
$id = (int)($in['id'] ?? 0);
if ($id <= 0) { json_out(['ok'=>false,'error'=>'bad_request'], 400); }

if (use_json_fallback()) {
  require_admin_json();
  $target = json_user_find_by_id($id);
  if (!$target) { json_out(['ok'=>false,'error'=>'not_found'], 404); }
  if (strtolower((string)($target['username'] ?? '')) === 'sepnp') {
    json_out(['ok' => false, 'error' => 'protected_user'], 403);
    exit;
  }
  $deleted = json_user_delete_by_id($id);
  if ($deleted) {
    json_user_coupons_delete_by_username((string)($deleted['username'] ?? ''));
  }
  json_out(['ok' => (bool)$deleted]);
} else {
  $pdo = get_db();
  require_admin($pdo);
  $u = $pdo->prepare('SELECT `username` FROM `users` WHERE `id` = :id');
  $u->execute([':id' => $id]);
  $uname = (string)($u->fetchColumn() ?: '');
  if ($uname === '') { json_out(['ok'=>false,'error'=>'not_found'], 404); }
  if (strtolower($uname) === 'sepnp') { json_out(['ok'=>false,'error'=>'protected_user'], 403); exit; }
  $pdo->prepare('DELETE FROM `user_coupons` WHERE `user_id` = :id')->execute([':id' => $id]);
  $pdo->prepare('DELETE FROM `users` WHERE `id` = :id')->execute([':id' => $id]);
  json_out(['ok'=>true]);
}
