<?php
if (!defined('DOKU_INC')) define('DOKU_INC', realpath(__DIR__ . '/../../../') . '/');
require_once(DOKU_INC . 'inc/init.php');
session_write_close(); // avoid locking

header('Content-Type: application/json');

if (!isset($_SERVER['REMOTE_USER']) || auth_quickaclcheck($_REQUEST['id']) < AUTH_EDIT) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$id = cleanID($_REQUEST['id']);
$action = $_REQUEST['action'] ?? 'create';
$path = metaFN($id, ".comments");
$data = file_exists($path) ? json_decode(file_get_contents($path), true) : [];

if ($action === 'create') {
    $selected = trim($_REQUEST['selected'] ?? '');
    $comment = trim($_REQUEST['comment'] ?? '');
    $before = trim($_REQUEST['before'] ?? '');
    $after = trim($_REQUEST['after'] ?? '');
    $selected_html = trim($_REQUEST['selected_html'] ?? '');

    if (!$selected || !$comment) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing data']);
        exit;
    }

    $anchor = 'comm_' . substr(md5($selected . $comment . microtime()), 0, 8);
    $entry = [
        'anchor_id' => $anchor,
        'selected' => $selected,
        'selected_html' => $selected_html,
        'text' => $comment,
        'author' => $_SERVER['REMOTE_USER'],
        'timestamp' => date('c'),
        'before' => $before,
        'after' => $after
    ];

    $data[] = $entry;
    io_saveFile($path, json_encode($data, JSON_PRETTY_PRINT));

    echo json_encode(['success' => true, 'anchor_id' => $anchor]);
    exit;
}

if ($action === 'update') {
    $anchor = $_REQUEST['anchor_id'] ?? '';
    $newText = trim($_REQUEST['new_text'] ?? '');

    if (!$anchor || !$newText) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing data']);
        exit;
    }

    $updated = false;
    foreach ($data as &$entry) {
        if ($entry['anchor_id'] === $anchor) {
            $entry['text'] = $newText;
            $entry['timestamp'] = date('c');
            $updated = true;
            break;
        }
    }

    if ($updated) {
        io_saveFile($path, json_encode($data, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Comment not found']);
    }
    exit;
}

if ($action === 'delete') {
    $anchor = $_REQUEST['anchor_id'] ?? '';

    if (!$anchor) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing anchor_id']);
        exit;
    }

    $newData = array_filter($data, fn($entry) => $entry['anchor_id'] !== $anchor);

    if (count($newData) < count($data)) {
        io_saveFile($path, json_encode(array_values($newData), JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Comment not found']);
    }
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Unknown action']);
