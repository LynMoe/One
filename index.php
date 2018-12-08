<?php
/**
 * Created by PhpStorm.
 * User: XiaoLin
 * Date: 2018-08-17
 * Time: 4:24 PM
 */
require_once __DIR__ . '/vendor/autoload.php';
if (file_exists(__DIR__ . '/config.php'))
    require_once __DIR__ . '/config.php';

if (!isset($_GET['path']))
{
    http_response_code(403);
    die;
}

$namespace = explode('/',$_GET['path'])[1];

if (str_replace('path=' . $_GET['path'],'',$_SERVER["QUERY_STRING"]) == '')
{
    $path = str_replace("/{$namespace}/",'',$_GET['path']);
} else {
    $path = str_replace("/{$namespace}/",'',$_GET['path']) . '?' . str_replace('path=' . $_GET['path'] . '&','',$_SERVER["QUERY_STRING"]);
}

foreach (CONFIG['namespace'] as $key => $value)
{
    if ($namespace == $key)
    {
        require_once __DIR__ . '/core/main.php';
        die;
    }
}

http_response_code(404);