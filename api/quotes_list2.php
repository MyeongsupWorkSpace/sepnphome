<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/db.php';
if (use_json_fallback()) {
  $rows = json_quotes_all();
  usort($rows, function($a,$b){ return ($b['timestamp']??0) <=> ($a['timestamp']??0); });
  echo json_encode($rows, JSON_UNESCAPED_UNICODE);
} else {
  $pdo = get_db();
  if ($pdo instanceof PDO) {
    $stmt = $pdo->query('SELECT id, name, product, message, email, phone, status, timestamp FROM quotes ORDER BY timestamp DESC');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
  } else {
    echo json_encode([], JSON_UNESCAPED_UNICODE);
  }
}
