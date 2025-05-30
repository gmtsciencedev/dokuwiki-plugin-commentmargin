<?php
if (!defined('DOKU_INC')) define('DOKU_INC', realpath(__DIR__ . '/../../../') . '/');
require_once(DOKU_INC . 'inc/init.php');
session_write_close(); // to avoid locking

if (!isset($_SERVER['REMOTE_USER']) || auth_quickaclcheck($_REQUEST['id']) < AUTH_EDIT) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$id = cleanID($_REQUEST['id']);
$selected = trim($_REQUEST['selected']);
$comment = trim($_REQUEST['comment']);

if (!$selected || !$comment) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing data']);
    exit;
}

$anchor = 'comm_' . substr(md5($selected . $comment . microtime()), 0, 8);
$entry = [
    'anchor_id' => $anchor,
    'selected' => $selected,
    'text' => $comment,
    'author' => $_SERVER['REMOTE_USER'],
    'timestamp' => date('c')
];

$path = metaFN($id, ".comments");
$data = file_exists($path) ? json_decode(file_get_contents($path), true) : [];
$data[] = $entry;
io_saveFile($path, json_encode($data, JSON_PRETTY_PRINT));

echo json_encode([
    'success' => true,
    'anchor_id' => $anchor
]);