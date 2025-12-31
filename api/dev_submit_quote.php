<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

// 로컬 개발에서만 허용
if (($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1') {
  json_out(['ok'=>false,'error'=>'forbidden'], 403);
  exit;
}

$name = trim((string)($_GET['name'] ?? ''));
$product = trim((string)($_GET['product'] ?? ''));
$message = trim((string)($_GET['message'] ?? ''));
$email = trim((string)($_GET['email'] ?? ''));
$phone = trim((string)($_GET['phone'] ?? ''));
if ($name === '' || $product === '') {
  json_out(['ok'=>false,'error'=>'missing_fields'], 400);
  exit;
}

if (use_json_fallback()) {
  $entry = json_quote_add([
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'product' => $product,
    'message' => $message,
  ]);
  json_out(['ok'=>true,'entry'=>$entry]);
} else {
  $pdo = get_db();
  $stmt = $pdo->prepare('INSERT INTO quotes(name,email,phone,product,message,status,timestamp) VALUES(:name,:email,:phone,:product,:message,:status,:ts)');
  $ts = time();
  $stmt->execute([
    ':name' => $name,
    ':email' => $email,
    ':phone' => $phone,
    ':product' => $product,
    ':message' => $message,
    ':status' => '문의중',
    ':ts' => $ts,
  ]);
  $entry = [
    'id' => (int)$pdo->lastInsertId(),
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'product' => $product,
    'message' => $message,
    'status' => '문의중',
    'timestamp' => $ts,
  ];
  json_out(['ok'=>true,'entry'=>$entry]);
}
