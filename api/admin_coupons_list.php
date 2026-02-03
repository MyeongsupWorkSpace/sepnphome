<?php
require_once "db.php";
requireAdmin();

$user_id = $_GET['user_id'] ?? null;
if ($user_id) {
    $coupons = getUserCoupons($user_id);
    echo json_encode($coupons);
    exit;
}
// 전체 사용자 쿠폰 목록 (간단하게 최근 100개)
$sql = "SELECT uc.id as user_coupon_id, u.id as user_id, u.name, c.id as coupon_id, c.name as coupon_name, uc.granted_at, uc.revoked_at FROM user_coupons uc JOIN users u ON uc.user_id = u.id JOIN coupons c ON uc.coupon_id = c.id ORDER BY uc.granted_at DESC LIMIT 100";
$rows = dbAll($sql);
echo json_encode($rows);
