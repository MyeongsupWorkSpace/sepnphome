<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
$data = $raw ? json_decode($raw, true) : $_POST;
// UTF-8 문제가 있을 경우 대체 플래그로 재시도
if (!is_array($data) && $raw) {
  $data = json_decode($raw, true, 512, defined('JSON_INVALID_UTF8_SUBSTITUTE') ? JSON_INVALID_UTF8_SUBSTITUTE : 0);
}
if (!is_array($data)) { $data = []; }

function s($v) {
  $v = is_string($v) ? trim($v) : '';
  if (function_exists('mb_substr')) { return mb_substr($v, 0, 1000); }
  return substr($v, 0, 1000);
}

$name = s($data['name'] ?? '');
$email = s($data['email'] ?? '');
$phone = s($data['phone'] ?? '');
$product = s($data['product'] ?? '');
$message = s($data['message'] ?? '');
$qty = (int)($data['qty'] ?? 0);
$length = s((string)($data['length'] ?? ''));
$width = s((string)($data['width'] ?? ''));
$height = s((string)($data['height'] ?? ''));
$finishing = $data['finishing'] ?? [];
if (is_string($finishing)) { $finishing = [$finishing]; }
if (!is_array($finishing)) { $finishing = []; }
$finishing_csv = implode(',', array_map('trim', $finishing));
$coating = $data['coating'] ?? [];
if (is_string($coating)) { $coating = [$coating]; }
if (!is_array($coating)) { $coating = []; }
$foil_w = s((string)($data['foil_w'] ?? ''));
$foil_h = s((string)($data['foil_h'] ?? ''));
$emboss_w = s((string)($data['emboss_w'] ?? ''));
$emboss_h = s((string)($data['emboss_h'] ?? ''));
$finishing_detail = s($data['finishing_detail'] ?? '');

// 유효성 검증: 부족한 필드는 200 상태로 에러 메시지만 반환(프론트에서 안내)
if (!$name || !$product) { json_out(['ok'=>false,'error'=>'missing_fields']); exit; }

if (use_json_fallback()) {
  $entry = json_quote_add([
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'product' => $product,
    'message' => $message,
    'qty' => $qty,
    'length' => $length,
    'width' => $width,
    'height' => $height,
    'finishing' => $finishing,
    'coating' => $coating,
    'foil_w' => $foil_w,
    'foil_h' => $foil_h,
    'emboss_w' => $emboss_w,
    'emboss_h' => $emboss_h,
    'finishing_detail' => $finishing_detail,
  ]);
  json_out(['ok'=>true,'entry'=>$entry]);
} else {
  $pdo = get_db();
  // DB에는 새 컬럼이 존재할 수도 있고 없을 수도 있으므로 동적으로 처리
  try {
    $stmt = $pdo->prepare('INSERT INTO quotes(name,email,phone,product,message,qty,length,width,height,finishing,finishing_detail,status,timestamp) VALUES(:name,:email,:phone,:product,:message,:qty,:length,:width,:height,:finishing,:finishing_detail,:status,:ts)');
  } catch (Throwable $e) {
    // 구버전 스키마: message에 요약을 덧붙여 저장
    $stmt = $pdo->prepare('INSERT INTO quotes(name,email,phone,product,message,status,timestamp) VALUES(:name,:email,:phone,:product,:message,:status,:ts)');
    $summary = "수량:$qty, 장:$length, 폭:$width, 고:$height, 후가공:$finishing_csv";
    if ($finishing_detail) { $summary .= " | " . $finishing_detail; }
    $message = trim($message) !== '' ? ($message . "\n" . $summary) : $summary;
  }
  $ts = time();
  $params = [
    ':name' => $name,
    ':email' => $email,
    ':phone' => $phone,
    ':product' => $product,
    ':message' => $message,
    ':status' => '문의중',
    ':ts' => $ts,
  ];
  if (strpos($stmt->queryString, 'qty') !== false) {
    $params[':qty'] = $qty;
    $params[':length'] = $length;
    $params[':width'] = $width;
    $params[':height'] = $height;
    $params[':finishing'] = $finishing_csv;
    if (strpos($stmt->queryString, 'finishing_detail') !== false) {
      $params[':finishing_detail'] = $finishing_detail;
    }
  }
  $stmt->execute($params);
  $entry = [
    'id' => (int)$pdo->lastInsertId(),
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'product' => $product,
    'message' => $message,
    'qty' => $qty,
    'length' => $length,
    'width' => $width,
    'height' => $height,
    'finishing' => $finishing,
    'coating' => $coating,
    'foil_w' => $foil_w,
    'foil_h' => $foil_h,
    'emboss_w' => $emboss_w,
    'emboss_h' => $emboss_h,
    'finishing_detail' => $finishing_detail,
    'status' => '문의중',
    'timestamp' => $ts,
  ];
  json_out(['ok'=>true,'entry'=>$entry]);
}
