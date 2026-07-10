<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
  $pdo = get_db();
  $stmt = $pdo->prepare('SELECT `enabled`,`title`,`message` FROM `main_ad_settings` WHERE `id` = 1 LIMIT 1');
  $stmt->execute();
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$row) {
    json_out(['ok' => true, 'settings' => []]);
    exit;
  }
  $settings = [
    'enabled' => (int)($row['enabled'] ?? 1) === 1,
    'title' => (string)($row['title'] ?? ''),
    'message' => (string)($row['message'] ?? ''),
  ];
  json_out(['ok' => true, 'settings' => $settings]);
} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'server_error'], 500);
}
