<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = $raw ? json_decode($raw, true) : $_POST;
if (!is_array($data)) { $data = []; }

function s($v) { $v = is_string($v) ? trim($v) : ''; return mb_substr($v, 0, 1000); }

$name = s($data['name'] ?? '');
$email = s($data['email'] ?? '');
$phone = s($data['phone'] ?? '');
$product = s($data['product'] ?? '');
$message = s($data['message'] ?? '');

if (!$name || !$product) { json_out(['ok'=>false,'error'=>'missing_fields'], 400); }

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
