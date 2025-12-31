<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (use_json_fallback()) {
	$rows = json_quotes_all();
	usort($rows, function ($a, $b) {
		return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
	});
	json_out($rows);
} else {
	$pdo = get_db();
	if ($pdo instanceof PDO) {
		$stmt = $pdo->query('SELECT id, name, product, message, email, phone, status, timestamp FROM quotes ORDER BY timestamp DESC');
		$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
		json_out($rows);
	} else {
		// 드라이버 문제로 DB 연결 실패 시 안전 폴백 반환
		json_out([]);
	}
}
