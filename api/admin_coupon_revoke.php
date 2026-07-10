<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$pdo = get_db();
require_admin($pdo);

$userCouponId = (int)($_POST['user_coupon_id'] ?? 0);
if ($userCouponId <= 0) {
    json_out(["ok" => false, "error" => "user_coupon_id required"], 400);
}
$res = revokeUserCoupon($userCouponId);
if (!empty($res['error'])) {
    json_out(["ok" => false, "error" => $res['error']], 400);
}
json_out(["ok" => true]);
