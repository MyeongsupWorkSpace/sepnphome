<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
$raw = file_get_contents('php://input');
$in = $raw ? json_decode($raw, true) : $_POST;
$id = (int)($in['id'] ?? 0);
$rank = trim((string)($in['rank'] ?? ''));
if ($id <= 0 || $rank === '') { json_out(['ok'=>false,'error'=>'bad_request'], 400); }
$isManager = strcasecmp($rank, 'Manager') === 0 || $rank === '매니저';
if (use_json_fallback()) {
	require_admin_json();
	$target = json_user_find_by_id($id);
	if ($target && strtolower((string)$target['username']) === 'sepnp') {
		json_out(['ok' => false, 'error' => 'protected_user'], 403); exit;
	}
	$ok = json_user_update_rank_by_id($id, $rank);
	if ($ok) {
		$users = json_users_all();
		foreach ($users as &$u) {
			if ((int)($u['id'] ?? 0) === $id) {
				$u['role'] = $isManager ? 'admin' : 'user';
				break;
			}
		}
		unset($u);
		json_save(json_users_path(), $users);
	}
	json_out(['ok' => $ok]);
} else {
	$pdo = get_db();
	require_admin($pdo);
	$u = $pdo->prepare('SELECT `username` FROM `users` WHERE `id` = :id');
	$u->execute([':id'=>$id]);
	$uname = (string)($u->fetchColumn() ?: '');
	if (strtolower($uname) === 'sepnp') { json_out(['ok'=>false,'error'=>'protected_user'], 403); exit; }
	$role = $isManager ? 'admin' : 'user';
	$pdo->prepare('UPDATE `users` SET `rank` = :r, `role` = :role WHERE `id` = :id')
		->execute([':r'=>$rank, ':role'=>$role, ':id'=>$id]);
	json_out(['ok'=>true]);
}
