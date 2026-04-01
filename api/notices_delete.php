<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
function require_master_notice(): void {
  $u = use_json_fallback() ? current_user_json() : current_user(get_db());
  $rank = strtolower((string)($u['rank'] ?? ''));
  if ($rank !== 'master') {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
require_master_notice();

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '[]', true);
$id = (int)($data['id'] ?? 0);
if ($id <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'bad_request']); exit; }

$path = __DIR__ . '/../data/notices.json';
if (!file_exists($path)) { @file_put_contents($path, '[]'); }

if (use_json_fallback()) {
  $items = json_decode(file_get_contents($path) ?: '[]', true);
  if (!is_array($items)) { $items = []; }
  $next = array_values(array_filter($items, function($it) use ($id) {
    return (int)($it['id'] ?? 0) !== $id;
  }));
  if (count($next) === count($items)) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }
  file_put_contents($path, json_encode($next, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  echo json_encode(['ok'=>true], JSON_UNESCAPED_UNICODE);
  exit;
}

$pdo = get_db();
$stmt = $pdo->prepare('DELETE FROM `notices` WHERE `id` = :id');
$stmt->execute([':id' => $id]);
if ($stmt->rowCount() === 0) { http_response_code(404); echo json_encode(['ok'=>false,'error'=>'not_found']); exit; }

echo json_encode(['ok'=>true], JSON_UNESCAPED_UNICODE);
