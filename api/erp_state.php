<?php
declare(strict_types=1);
define('SEPNP_NO_SESSION', true);
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

const ERP_STATE_KEY = 'se_erp_state_v1';
const ERP_SECTION_PREFIX = 'se_erp_section_';

function erp_state_default(): array {
  return [];
}

function erp_state_file_path(): string {
  return data_dir() . DIRECTORY_SEPARATOR . 'erp_state.json';
}

function erp_state_file_get(): array {
  $rows = json_load(erp_state_file_path());
  return is_array($rows) ? $rows : erp_state_default();
}

function erp_state_file_save(array $state): array {
  json_save(erp_state_file_path(), $state);
  return $state;
}

function erp_is_list_array(array $value): bool {
  if (function_exists('array_is_list')) {
    return array_is_list($value);
  }
  $i = 0;
  foreach ($value as $k => $_) {
    if ($k !== $i) {
      return false;
    }
    $i++;
  }
  return true;
}

function erp_state_get_snapshot(PDO $pdo): array {
  $stmt = $pdo->prepare('SELECT `data_json` FROM `portal_kv` WHERE `kv_key` = :k LIMIT 1');
  $stmt->execute([':k' => ERP_STATE_KEY]);
  $raw = $stmt->fetchColumn();
  if (!$raw) {
    return erp_state_default();
  }
  $decoded = json_decode((string)$raw, true);
  return is_array($decoded) ? $decoded : erp_state_default();
}

function erp_state_get_normalized(PDO $pdo): array {
  $state = [];

  $stmt = $pdo->query('SELECT `section_key`,`row_no`,`data_json` FROM `portal_erp_rows` ORDER BY `section_key` ASC, `row_no` ASC');
  foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $section = (string)($row['section_key'] ?? '');
    if ($section === '') {
      continue;
    }
    if (!isset($state[$section]) || !is_array($state[$section])) {
      $state[$section] = [];
    }
    $decoded = json_decode((string)($row['data_json'] ?? 'null'), true);
    $state[$section][] = $decoded;
  }

  $stmt2 = $pdo->prepare('SELECT `kv_key`,`data_json` FROM `portal_kv` WHERE `kv_key` LIKE :p');
  $stmt2->execute([':p' => ERP_SECTION_PREFIX . '%']);
  foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $kvKey = (string)($row['kv_key'] ?? '');
    if (strpos($kvKey, ERP_SECTION_PREFIX) !== 0) {
      continue;
    }
    $section = substr($kvKey, strlen(ERP_SECTION_PREFIX));
    if ($section === '') {
      continue;
    }
    $decoded = json_decode((string)($row['data_json'] ?? 'null'), true);
    if (is_array($decoded)) {
      $state[$section] = $decoded;
    }
  }

  return $state;
}

function erp_state_save_snapshot(PDO $pdo, array $state, int $now): void {
  $json = json_encode($state, JSON_UNESCAPED_UNICODE);
  $stmt = $pdo->prepare('INSERT INTO `portal_kv`(`kv_key`,`data_json`,`updated_at`) VALUES(:k,:v,:ts) ON DUPLICATE KEY UPDATE `data_json` = VALUES(`data_json`), `updated_at` = VALUES(`updated_at`)');
  $stmt->execute([
    ':k' => ERP_STATE_KEY,
    ':v' => $json,
    ':ts' => $now,
  ]);
}

function erp_state_save_normalized(PDO $pdo, array $state, int $now): void {
  $sectionsWithRows = [];
  $sectionsWithKv = [];

  foreach ($state as $section => $value) {
    if (!is_string($section) || $section === '') {
      continue;
    }

    if (is_array($value) && erp_is_list_array($value)) {
      $sectionsWithRows[] = $section;
      $pdo->prepare('DELETE FROM `portal_erp_rows` WHERE `section_key` = :s')->execute([':s' => $section]);

      if (count($value) > 0) {
        $ins = $pdo->prepare('INSERT INTO `portal_erp_rows`(`section_key`,`row_no`,`data_json`,`created_at`,`updated_at`) VALUES(:s,:n,:v,:ts,:ts)');
        foreach (array_values($value) as $idx => $row) {
          $ins->execute([
            ':s' => $section,
            ':n' => $idx,
            ':v' => json_encode($row, JSON_UNESCAPED_UNICODE),
            ':ts' => $now,
          ]);
        }
      }
      continue;
    }

    $sectionsWithKv[] = $section;
    $key = ERP_SECTION_PREFIX . $section;
    $payload = json_encode($value, JSON_UNESCAPED_UNICODE);
    $stmt = $pdo->prepare('INSERT INTO `portal_kv`(`kv_key`,`data_json`,`updated_at`) VALUES(:k,:v,:ts) ON DUPLICATE KEY UPDATE `data_json` = VALUES(`data_json`), `updated_at` = VALUES(`updated_at`)');
    $stmt->execute([
      ':k' => $key,
      ':v' => $payload,
      ':ts' => $now,
    ]);
  }

  $stmtRows = $pdo->query('SELECT DISTINCT `section_key` FROM `portal_erp_rows`');
  foreach ($stmtRows->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $section = (string)($row['section_key'] ?? '');
    if ($section !== '' && !in_array($section, $sectionsWithRows, true)) {
      $pdo->prepare('DELETE FROM `portal_erp_rows` WHERE `section_key` = :s')->execute([':s' => $section]);
    }
  }

  $stmtKv = $pdo->prepare('SELECT `kv_key` FROM `portal_kv` WHERE `kv_key` LIKE :p');
  $stmtKv->execute([':p' => ERP_SECTION_PREFIX . '%']);
  foreach ($stmtKv->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $kvKey = (string)($row['kv_key'] ?? '');
    if (strpos($kvKey, ERP_SECTION_PREFIX) !== 0) {
      continue;
    }
    $section = substr($kvKey, strlen(ERP_SECTION_PREFIX));
    if ($section !== '' && !in_array($section, $sectionsWithKv, true)) {
      $pdo->prepare('DELETE FROM `portal_kv` WHERE `kv_key` = :k')->execute([':k' => $kvKey]);
    }
  }
}

function erp_state_get(PDO $pdo): array {
  try {
    $snapshot = erp_state_get_snapshot($pdo);
    if (!empty($snapshot)) {
      return $snapshot;
    }

    $normalized = erp_state_get_normalized($pdo);
    if (!empty($normalized)) {
      return $normalized;
    }

    return erp_state_default();
  } catch (Throwable $e) {
    return erp_state_default();
  }
}

function erp_state_save(PDO $pdo, array $state): array {
  $now = time();
  try {
    $pdo->beginTransaction();
    erp_state_save_snapshot($pdo, $state, $now);
    erp_state_save_normalized($pdo, $state, $now);
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }
  return $state;
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
  try {
    $pdo = get_db();
    json_out(['ok' => true, 'state' => erp_state_get($pdo), 'storage' => 'db']);
  } catch (Throwable $e) {
    json_out(['ok' => true, 'state' => erp_state_file_get(), 'storage' => 'file', 'warning' => 'db_unavailable']);
  }
  exit;
}

if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  $payload = $raw ? json_decode($raw, true) : $_POST;
  $state = is_array($payload) ? ($payload['state'] ?? null) : null;
  if (!is_array($state)) {
    json_out(['ok' => false, 'error' => 'bad_request'], 400);
    exit;
  }

  try {
    $pdo = get_db();
    json_out(['ok' => true, 'state' => erp_state_save($pdo, $state), 'storage' => 'db']);
  } catch (Throwable $e) {
    json_out(['ok' => true, 'state' => erp_state_file_save($state), 'storage' => 'file', 'warning' => 'db_unavailable']);
  }
  exit;
}

json_out(['ok' => false, 'error' => 'method_not_allowed'], 405);
