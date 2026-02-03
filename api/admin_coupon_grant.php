<?php
require_once "db.php";
requireAdmin();

$user_id = $_POST['user_id'] ?? null;
$coupon_id = $_POST['coupon_id'] ?? null;
if (!$user_id || !$coupon_id) {
    http_response_code(400);
    echo json_encode(["error" => "user_id, coupon_id required"]);
    exit;
}
$res = grantCouponToUser($user_id, $coupon_id);
echo json_encode($res);
