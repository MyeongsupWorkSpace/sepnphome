<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (session_status() !== PHP_SESSION_ACTIVE) { @session_start(); }
function require_master_main_ad(): void {
  $u = use_json_fallback() ? current_user_json() : current_user(get_db());
  $rank = strtolower((string)($u['rank'] ?? ''));
  if ($rank !== 'master') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
require_master_main_ad();

$raw = file_get_contents('php://input');
$data = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($data)) { $data = []; }

$enabled = !empty($data['enabled']) ? 1 : 0;
$title = trim((string)($data['title'] ?? ''));
$message = trim((string)($data['message'] ?? ''));
$now = time();

try {
  $pdo = get_db();
  $stmt = $pdo->prepare(
    'INSERT INTO `main_ad_settings` (`id`,`enabled`,`title`,`message`,`updated_at`)
     VALUES (1,:enabled,:title,:message,:updated_at)
     ON DUPLICATE KEY UPDATE
       `enabled`=VALUES(`enabled`),
       `title`=VALUES(`title`),
       `message`=VALUES(`message`),
       `updated_at`=VALUES(`updated_at`)'
  );
  $stmt->execute([
    ':enabled' => $enabled,
    ':title' => $title,
    ':message' => $message,
    ':updated_at' => $now,
  ]);
  json_out([
    'ok' => true,
    'settings' => [
      'enabled' => $enabled === 1,
      'title' => $title,
      'message' => $message,
    ]
  ]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
