<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($in)) { $in = []; }

$resource = preg_replace('/[^a-z_]/', '', (string)($_GET['r'] ?? $in['r'] ?? ''));
$allowed = ['suppliers','papers','materials','products','customers','orders','assignments'];
if (!in_array($resource, $allowed, true)) {
  json_out(['ok'=>false,'error'=>'invalid_resource'], 400); return;
}
$id = (int)($_GET['id'] ?? $in['id'] ?? 0);
$dateKey = trim((string)($_GET['date'] ?? $in['date'] ?? $in['date_key'] ?? ''));
$q = trim((string)($_GET['q'] ?? $in['q'] ?? ''));

function normalize_rows(array $rows, string $resource): array {
  $out = [];
  foreach ($rows as $r) {
    $data = [];
    if (isset($r['data_json'])) {
      $decoded = json_decode((string)$r['data_json'], true);
      $data = is_array($decoded) ? $decoded : [];
    } else if (isset($r['data']) && is_array($r['data'])) {
      $data = $r['data'];
    }
    $data['id'] = (int)($r['id'] ?? ($data['id'] ?? 0));
    if (isset($r['created_at'])) { $data['createdAt'] = $r['created_at']; }
    if (isset($r['updated_at'])) { $data['updatedAt'] = $r['updated_at']; }
    if ($resource === 'assignments') {
      $data['date'] = $r['date_key'] ?? ($data['date'] ?? null);
    }
    $out[] = $data;
  }
  return $out;
}

if (use_json_fallback()) {
  $rows = json_portal_all($resource);
  if ($method === 'GET') {
    if ($resource === 'assignments' && $dateKey !== '') {
      $rows = array_values(array_filter($rows, fn($r) => ($r['date_key'] ?? '') === $dateKey));
    }
    $out = normalize_rows($rows, $resource);
    if ($q !== '') {
      $ql = mb_strtolower($q);
      $out = array_values(array_filter($out, function($row) use ($ql) {
        $flat = mb_strtolower(json_encode($row, JSON_UNESCAPED_UNICODE));
        return strpos($flat, $ql) !== false;
      }));
    }
    json_out($out);
    return;
  }
  if ($method === 'POST') {
    $record = [
      'id' => json_portal_next_id($rows),
      'data' => $in,
      'created_at' => time(),
      'updated_at' => time(),
    ];
    if ($resource === 'assignments') {
      $record['date_key'] = $dateKey ?: (string)($in['date'] ?? '');
    }
    $rows[] = $record;
    json_portal_save($resource, $rows);
    json_out(['ok'=>true,'id'=>$record['id']]);
    return;
  }
  if ($method === 'PUT') {
    $updated = false;
    foreach ($rows as &$r) {
      if ((int)($r['id'] ?? 0) !== $id) continue;
      $r['data'] = array_merge((array)($r['data'] ?? []), $in);
      if ($resource === 'assignments' && $dateKey !== '') { $r['date_key'] = $dateKey; }
      $r['updated_at'] = time();
      $updated = true;
      break;
    }
    if ($updated) json_portal_save($resource, $rows);
    json_out(['ok'=>$updated]);
    return;
  }
  if ($method === 'DELETE') {
    $rows = array_values(array_filter($rows, fn($r) => (int)($r['id'] ?? 0) !== $id));
    json_portal_save($resource, $rows);
    json_out(['ok'=>true]);
    return;
  }
}

$pdo = get_db();
$table = 'portal_' . $resource;
try {
  if ($method === 'GET') {
    if ($resource === 'assignments' && $dateKey !== '') {
      $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `date_key` = :d ORDER BY `id` DESC");
      $stmt->execute([':d' => $dateKey]);
    } else {
      $stmt = $pdo->query("SELECT * FROM `{$table}` ORDER BY `id` DESC");
    }
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $out = normalize_rows($rows, $resource);
    if ($q !== '') {
      $ql = mb_strtolower($q);
      $out = array_values(array_filter($out, function($row) use ($ql) {
        $flat = mb_strtolower(json_encode($row, JSON_UNESCAPED_UNICODE));
        return strpos($flat, $ql) !== false;
      }));
    }
    json_out($out);
    return;
  }
  if ($method === 'POST') {
    $now = time();
    if ($resource === 'assignments') {
      $stmt = $pdo->prepare("INSERT INTO `{$table}`(`date_key`,`data_json`,`created_at`,`updated_at`) VALUES(:d,:j,:ts,:ts)");
      $stmt->execute([
        ':d' => $dateKey ?: (string)($in['date'] ?? ''),
        ':j' => json_encode($in, JSON_UNESCAPED_UNICODE),
        ':ts' => $now,
      ]);
    } else {
      $stmt = $pdo->prepare("INSERT INTO `{$table}`(`data_json`,`created_at`,`updated_at`) VALUES(:j,:ts,:ts)");
      $stmt->execute([
        ':j' => json_encode($in, JSON_UNESCAPED_UNICODE),
        ':ts' => $now,
      ]);
    }
    json_out(['ok'=>true,'id'=>(int)$pdo->lastInsertId()]);
    return;
  }
  if ($method === 'PUT') {
    if ($id <= 0) { json_out(['ok'=>false,'error'=>'missing_id'], 400); return; }
    $now = time();
    if ($resource === 'assignments') {
      $stmt = $pdo->prepare("UPDATE `{$table}` SET `data_json`=:j, `date_key`=:d, `updated_at`=:ts WHERE `id`=:id");
      $stmt->execute([
        ':j' => json_encode($in, JSON_UNESCAPED_UNICODE),
        ':d' => $dateKey ?: (string)($in['date'] ?? ''),
        ':ts' => $now,
        ':id' => $id,
      ]);
    } else {
      $stmt = $pdo->prepare("UPDATE `{$table}` SET `data_json`=:j, `updated_at`=:ts WHERE `id`=:id");
      $stmt->execute([
        ':j' => json_encode($in, JSON_UNESCAPED_UNICODE),
        ':ts' => $now,
        ':id' => $id,
      ]);
    }
    json_out(['ok'=>true]);
    return;
  }
  if ($method === 'DELETE') {
    if ($id <= 0) { json_out(['ok'=>false,'error'=>'missing_id'], 400); return; }
    $pdo->prepare("DELETE FROM `{$table}` WHERE `id` = :id")->execute([':id'=>$id]);
    json_out(['ok'=>true]);
    return;
  }
} catch (Throwable $e) {
  json_out(['ok'=>false,'error'=>'server_error'], 500);
}
