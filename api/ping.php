<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
$pdo = null;
$dbOk = false;
try {
  $pdo = get_db();
  $dbOk = $pdo instanceof PDO;
} catch (Throwable $e) {
  $dbOk = false;
}
echo json_encode([
  'pong' => true,
  'ts' => time(),
  'db_ok' => $dbOk,
  'env_APP_USE_JSON' => getenv('APP_USE_JSON') ?: null,
], JSON_UNESCAPED_UNICODE);
