<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$u = null;
if (use_json_fallback()) {
	$u = current_user_json();
} else {
	$pdo = get_db();
	if ($pdo instanceof PDO) {
		$u = current_user($pdo);
	} else {
		// 드라이버 문제로 DB 연결 실패 시 세션 폴백 확인
		$u = current_user_json();
	}
}
json_out(['ok'=>!!$u, 'user'=>$u]);
