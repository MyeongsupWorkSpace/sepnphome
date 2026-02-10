<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_REQUEST;
if (!is_array($in)) { $in = []; }

$status = trim((string)($_GET['status'] ?? $in['status'] ?? ''));
$id = (int)($_GET['id'] ?? $in['id'] ?? 0);

function normalize_emp(array $r): array {
  $perms = [];
  if (isset($r['perms_json'])) {
    $decoded = json_decode((string)$r['perms_json'], true);
    $perms = is_array($decoded) ? $decoded : [];
  } else if (isset($r['perms']) && is_array($r['perms'])) {
    $perms = $r['perms'];
  }
  return [
    'id' => (int)($r['id'] ?? 0),
    'empNo' => $r['emp_no'] ?? ($r['empNo'] ?? ''),
    'username' => $r['username'] ?? '',
    'name' => $r['name'] ?? '',
    'dept' => $r['dept'] ?? '',
    'position' => $r['position'] ?? '',
    'phone' => $r['phone'] ?? '',
    'email' => $r['email'] ?? '',
    'joinDate' => $r['join_date'] ?? ($r['joinDate'] ?? ''),
    'status' => $r['status'] ?? 'pending',
    'role' => $r['role'] ?? 'viewer',
    'perms' => $perms,
    'createdAt' => $r['created_at'] ?? ($r['createdAt'] ?? null),
    'updatedAt' => $r['updated_at'] ?? ($r['updatedAt'] ?? null),
  ];
}

if (use_json_fallback()) {
  $rows = json_portal_all('employees');
  if ($method === 'GET') {
    if ($status !== '') {
      $rows = array_values(array_filter($rows, fn($r) => ($r['status'] ?? '') === $status));
    }
    json_out(array_map('normalize_emp', $rows));
    return;
  }
  if ($method === 'POST') {
    $password = (string)($in['password'] ?? '');
    $passwordHash = (string)($in['passwordHash'] ?? '');
    $hash = $password ? password_hash($password, PASSWORD_DEFAULT) : ($passwordHash ?: password_hash('1234', PASSWORD_DEFAULT));
    $row = [
      'id' => json_portal_next_id($rows),
      'empNo' => $in['empNo'] ?? '',
      'username' => $in['username'] ?? '',
      'password_hash' => $hash,
      'name' => $in['name'] ?? '',
      'dept' => $in['dept'] ?? '',
      'position' => $in['position'] ?? '',
      'phone' => $in['phone'] ?? '',
      'email' => $in['email'] ?? '',
      'joinDate' => $in['joinDate'] ?? '',
      'status' => $in['status'] ?? 'active',
      'role' => $in['role'] ?? 'viewer',
      'perms' => $in['perms'] ?? [],
      'created_at' => time(),
      'updated_at' => time(),
    ];
    $rows[] = $row;
    json_portal_save('employees', $rows);
    json_out(['ok'=>true,'id'=>$row['id']]);
    return;
  }
  if ($method === 'PUT') {
    $updated = false;
    foreach ($rows as &$r) {
      if ((int)($r['id'] ?? 0) !== $id) continue;
      foreach (['empNo','username','name','dept','position','phone','email','joinDate','status','role'] as $k) {
        if (isset($in[$k])) { $r[$k] = $in[$k]; }
      }
      if (isset($in['perms'])) { $r['perms'] = $in['perms']; }
      if (!empty($in['password'])) { $r['password_hash'] = password_hash($in['password'], PASSWORD_DEFAULT); }
      $r['updated_at'] = time();
      $updated = true;
      break;
    }
    if ($updated) json_portal_save('employees', $rows);
    json_out(['ok'=>$updated]);
    return;
  }
  if ($method === 'DELETE') {
    $rows = array_values(array_filter($rows, fn($r) => (int)($r['id'] ?? 0) !== $id));
    json_portal_save('employees', $rows);
    json_out(['ok'=>true]);
    return;
  }
}

$pdo = get_db();
try {
  if ($method === 'GET') {
    if ($status !== '') {
      $stmt = $pdo->prepare('SELECT * FROM `portal_employees` WHERE `status` = :s ORDER BY `created_at` DESC');
      $stmt->execute([':s' => $status]);
    } else {
      $stmt = $pdo->query('SELECT * FROM `portal_employees` ORDER BY `created_at` DESC');
    }
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    json_out(array_map('normalize_emp', $rows));
    return;
  }
  if ($method === 'POST') {
    $password = (string)($in['password'] ?? '');
    $passwordHash = (string)($in['passwordHash'] ?? '');
    $hash = $password ? password_hash($password, PASSWORD_DEFAULT) : ($passwordHash ?: password_hash('1234', PASSWORD_DEFAULT));
    $now = time();
    $stmt = $pdo->prepare('INSERT INTO `portal_employees`(`emp_no`,`username`,`password_hash`,`name`,`dept`,`position`,`phone`,`email`,`join_date`,`status`,`role`,`perms_json`,`created_at`,`updated_at`) VALUES(:emp_no,:username,:ph,:name,:dept,:pos,:phone,:email,:join_date,:status,:role,:perms,:ts,:ts)');
    $stmt->execute([
      ':emp_no' => $in['empNo'] ?? '',
      ':username' => $in['username'] ?? '',
      ':ph' => $hash,
      ':name' => $in['name'] ?? '',
      ':dept' => $in['dept'] ?? '',
      ':pos' => $in['position'] ?? '',
      ':phone' => $in['phone'] ?? '',
      ':email' => $in['email'] ?? '',
      ':join_date' => $in['joinDate'] ?? '',
      ':status' => $in['status'] ?? 'active',
      ':role' => $in['role'] ?? 'viewer',
      ':perms' => json_encode($in['perms'] ?? [], JSON_UNESCAPED_UNICODE),
      ':ts' => $now,
    ]);
    json_out(['ok'=>true,'id'=>(int)$pdo->lastInsertId()]);
    return;
  }
  if ($method === 'PUT') {
    if ($id <= 0) { json_out(['ok'=>false,'error'=>'missing_id'], 400); return; }
    $fields = [];
    $params = [':id' => $id];
    $map = [
      'empNo' => 'emp_no',
      'username' => 'username',
      'name' => 'name',
      'dept' => 'dept',
      'position' => 'position',
      'phone' => 'phone',
      'email' => 'email',
      'joinDate' => 'join_date',
      'status' => 'status',
      'role' => 'role'
    ];
    foreach ($map as $k => $col) {
      if (isset($in[$k])) { $fields[] = "`$col` = :$col"; $params[":$col"] = $in[$k]; }
    }
    if (isset($in['perms'])) { $fields[] = '`perms_json` = :perms_json'; $params[':perms_json'] = json_encode($in['perms'], JSON_UNESCAPED_UNICODE); }
    if (!empty($in['password'])) { $fields[] = '`password_hash` = :ph'; $params[':ph'] = password_hash($in['password'], PASSWORD_DEFAULT); }
    $fields[] = '`updated_at` = :updated_at';
    $params[':updated_at'] = time();
    $sql = 'UPDATE `portal_employees` SET ' . implode(', ', $fields) . ' WHERE `id` = :id';
    $pdo->prepare($sql)->execute($params);
    json_out(['ok'=>true]);
    return;
  }
  if ($method === 'DELETE') {
    if ($id <= 0) { json_out(['ok'=>false,'error'=>'missing_id'], 400); return; }
    $pdo->prepare('DELETE FROM `portal_employees` WHERE `id` = :id')->execute([':id'=>$id]);
    json_out(['ok'=>true]);
    return;
  }
} catch (Throwable $e) {
  json_out(['ok'=>false,'error'=>'server_error'], 500);
}
