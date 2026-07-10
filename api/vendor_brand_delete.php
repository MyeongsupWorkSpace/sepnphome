<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
function require_master_vendor(): void {
  $u = use_json_fallback() ? current_user_json() : current_user(get_db());
  $rank = strtolower((string)($u['rank'] ?? ''));
  if ($rank !== 'master') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
require_master_vendor();

$raw = file_get_contents('php://input');
$data = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($data)) { $data = []; }

$id = (int)($data['id'] ?? 0);
if ($id <= 0) {
  json_out(['ok' => false, 'error' => 'invalid_id'], 400);
  exit;
}

try {
  $pdo = get_db();
  $stmt = $pdo->prepare('DELETE FROM `vendor_brands` WHERE `id` = :id');
  $stmt->execute([':id' => $id]);
  json_out(['ok' => true]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
