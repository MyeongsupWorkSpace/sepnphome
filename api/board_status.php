<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
$pdo = use_json_fallback() ? null : get_db();
if (use_json_fallback()) { require_admin_json(); } else { require_admin($pdo); }

$path = __DIR__ . '/../data/board.json';
if (!file_exists($path)) { @file_put_contents($path, '[]'); }
$raw = file_get_contents('php://input');
$in = json_decode($raw ?: '[]', true);
$id = (int)($in['id'] ?? 0);
$status = (string)($in['status'] ?? '');
if ($id <= 0 || ($status !== '문의중' && $status !== '답변완료')) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'bad_request'], JSON_UNESCAPED_UNICODE);
  exit;
}
if (use_json_fallback()) {
  $items = json_decode(file_get_contents($path) ?: '[]', true);
  if (!is_array($items)) { $items = []; }
  $updated = false;
  foreach ($items as &$it){
    if ((int)($it['id'] ?? 0) === $id){ $it['status'] = $status; $updated = true; break; }
  }
  unset($it);
  if ($updated){ file_put_contents($path, json_encode($items, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)); }
  json_out(['ok'=>true,'updated'=>$updated]);
} else {
  $stmt = $pdo->prepare('UPDATE `board_posts` SET `status` = :s WHERE `id` = :id');
  $ok = $stmt->execute([':s' => $status, ':id' => $id]);
  json_out(['ok'=>true,'updated'=>$ok]);
}
