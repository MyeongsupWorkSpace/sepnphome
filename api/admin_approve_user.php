<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
$id = (int)($in['id'] ?? 0);
$action = (string)($in['action'] ?? '');
if ($id <= 0 || !in_array($action, ['approve','deny'], true)) { json_out(['ok'=>false,'error'=>'bad_request'], 400); }
$status = $action === 'approve' ? '승인완료' : '거절';
if (use_json_fallback()) {
	require_admin_json();
	$target = json_user_find_by_id($id);
	if ($target && strtolower((string)$target['username']) === 'sepnp') {
		json_out(['ok' => false, 'error' => 'protected_user'], 403); exit;
	}
	$ok = json_user_update_status_by_id($id, $status);
	json_out(['ok' => $ok]);
} else {
	$pdo = get_db();
	require_admin($pdo);
	$u = $pdo->prepare('SELECT username FROM users WHERE id = :id');
	$u->execute([':id'=>$id]);
	$uname = (string)($u->fetchColumn() ?: '');
	if (strtolower($uname) === 'sepnp') { json_out(['ok'=>false,'error'=>'protected_user'], 403); exit; }
	$pdo->prepare('UPDATE users SET status = :s WHERE id = :id')->execute([':s'=>$status, ':id'=>$id]);
	json_out(['ok'=>true]);
}
