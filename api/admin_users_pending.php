<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
if (use_json_fallback()) {
	require_admin_json();
	$rows = array_values(array_filter(json_users_all(), function($u){ return ($u['status'] ?? '') === '승인대기'; }));
	usort($rows, function($a,$b){ return ($b['created_at'] ?? 0) <=> ($a['created_at'] ?? 0); });
	json_out($rows);
} else {
	$pdo = get_db();
	require_admin($pdo);
	$stmt = $pdo->query('SELECT id, username, nickname, rank, role, status, created_at FROM users WHERE status = "승인대기" ORDER BY created_at DESC');
	$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
	json_out($rows);
}
