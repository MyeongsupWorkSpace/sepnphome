<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if (use_json_fallback()) {
	require_admin_json();
	$affected = json_user_update_status_all('승인완료');
	json_out(['ok'=>true, 'updated'=>$affected]);
} else {
	$pdo = get_db();
	require_admin($pdo);
	$stmt = $pdo->prepare('UPDATE users SET status = :s WHERE status <> :s');
	$stmt->execute([':s' => '승인완료']);
	$affected = $stmt->rowCount();
	json_out(['ok' => true, 'updated' => $affected]);
}
