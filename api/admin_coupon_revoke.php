<?php
require_once "db.php";
requireAdmin();

$user_coupon_id = $_POST['user_coupon_id'] ?? null;
if (!$user_coupon_id) {
    http_response_code(400);
    echo json_encode(["error" => "user_coupon_id required"]);
    exit;
}
$res = revokeUserCoupon($user_coupon_id);
echo json_encode($res);
