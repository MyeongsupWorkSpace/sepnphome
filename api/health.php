<?php
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$start = microtime(true);
$out = [
  'ok' => false,
  'db' => [
    'ok' => false,
  ],
];

try {
  $pdo = get_db();
  $pdo->query('SELECT 1');
  $out['db']['ok'] = true;
} catch (Throwable $e) {
  $out['db']['error'] = 'db_connect_failed';
  $out['db']['message'] = $e->getMessage();
  json_out($out, 500);
  return;
}

$out['ok'] = true;
$out['elapsed_ms'] = (int)round((microtime(true) - $start) * 1000);

try {
  $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
  $out['users_table'] = (bool)$stmt->fetchColumn();
} catch (Throwable $e) {
  $out['users_table'] = false;
}

try {
  $stmt = $pdo->query("SHOW TABLES LIKE 'portal_employees'");
  $out['portal_employees_table'] = (bool)$stmt->fetchColumn();
} catch (Throwable $e) {
  $out['portal_employees_table'] = false;
}

try {
  if (!empty($out['users_table'])) {
    $out['users_count'] = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
  }
} catch (Throwable $e) {
  $out['users_count'] = null;
}

try {
  if (!empty($out['portal_employees_table'])) {
    $out['portal_employees_count'] = (int)$pdo->query('SELECT COUNT(*) FROM portal_employees')->fetchColumn();
  }
} catch (Throwable $e) {
  $out['portal_employees_count'] = null;
}

json_out($out);
