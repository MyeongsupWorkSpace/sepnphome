<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$pdo = get_db();
require_admin($pdo);

$userQuery = trim((string)($_GET['user_id'] ?? ''));
if ($userQuery !== '') {
    $stmt = $pdo->prepare('SELECT `id` FROM `users` WHERE `id` = :id OR `username` = :q OR `nickname` = :q LIMIT 1');
    $stmt->execute([':id' => (int)$userQuery, ':q' => $userQuery]);
    $userId = (int)($stmt->fetchColumn() ?: 0);
    if ($userId <= 0) { json_out([]); exit; }

    $sql = 'SELECT uc.id as user_coupon_id, c.id as coupon_id, c.title as coupon_name, c.expires_at, uc.qty, COALESCE(uc.granted_at, uc.created_at) as granted_at, uc.revoked_at
        FROM user_coupons uc
        JOIN coupons c ON uc.coupon_id = c.id
        WHERE uc.user_id = :uid
        ORDER BY uc.created_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':uid' => $userId]);
    json_out($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

// 전체 사용자 쿠폰 목록 (최근 100개)
$sql = 'SELECT uc.id as user_coupon_id, u.id as user_id, u.username, u.nickname, c.id as coupon_id, c.title as coupon_name, c.expires_at, uc.qty, COALESCE(uc.granted_at, uc.created_at) as granted_at, uc.revoked_at
    FROM user_coupons uc
    JOIN users u ON uc.user_id = u.id
    JOIN coupons c ON uc.coupon_id = c.id
    ORDER BY uc.created_at DESC LIMIT 100';
$rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
json_out($rows);
