<?php
/**
 * Created by PhpStorm.
 * User: XiaoLin
 * Date: 2018-08-17
 * Time: 5:00 PM
 */

require_once __DIR__ . '/Storage.php';

$db = new \Buki\Pdox(CONFIG['database']);
$db->query("CREATE TABLE if not exists `{$namespace}` (`id` int(11) PRIMARY KEY AUTO_INCREMENT,`path` text, `path_md5` text, `file_type` text, `time` int(11));");

if ($db->table($namespace)->where('path_md5',md5($path))->count('*','num')->get()->num > 0)
{
    error_log($db->table($namespace)->where('path_md5',md5($path))->count('*','num')->get()->num);
    if ((time() - $db->table($namespace)->where('path_md5',md5($path))->get()->time) > CONFIG['namespace'][$namespace]['expire'])
    {
        goto fetch;
    } else {
        $info = $db->table($namespace)->where('path_md5',md5($path))->get();
        $file_type = json_decode($info->file_type,true);
        header("Content-type: " . $file_type);
        //header('Content-Disposition: inline');
        header('Cache-Control: max-age=' . CONFIG['namespace'][$namespace]['expire']);
        header('Content-Length: ' . filesize(__DIR__ . '/../../' . $namespace . '/' . md5($path)));
        readfile(__DIR__ . '/../../' . $namespace . '/' . md5($path));
    }
} else {
    fetch:
    ob_start();
    header('Location: ' . CONFIG['namespace'][$namespace]['url'] . $path);
    header('Cache-Control: max-age=0');
    header("Connection: Close");
    echo 'Moved';
    ob_flush();
    flush();
    fastcgi_finish_request();
    ob_end_flush();

    if ($db->table($namespace)->where('path_md5',md5($path))->count('*','num')->get()->num > 0)
    {
        $result = Storage::get_file(CONFIG['namespace'][$namespace]['url'] . $path);
        if (file_put_contents(__DIR__ . '/../../' . $namespace . '/' . md5($path),$result['data']))
        {
            $db->table($namespace)->where('path_md5',md5($path))->update([
                'file_type' => ($result['type'] == null) ? (new finfo(FILEINFO_MIME_TYPE))->file(__DIR__ . '/../../' . $namespace . '/' . md5($path)) : $result['type'],
                'time' => time(),
            ]);
        }
    } else {
        $result = Storage::get_file(CONFIG['namespace'][$namespace]['url'] . $path);
        if ((is_dir(__DIR__ . '/../../' . $namespace) || mkdir(__DIR__ . '/../../' . $namespace)) && file_put_contents(__DIR__ . '/../../' . $namespace . '/' . md5($path),$result['data']))
        {
            $db->table($namespace)->where('path_md5',md5($path))->insert([
                'path' => json_encode($path),
                'path_md5' => md5($path),
                'file_type' => ($result['type'] == null) ? (new finfo(FILEINFO_MIME_TYPE))->file(__DIR__ . '/../../' . $namespace . '/' . md5($path)) : $result['type'],
                'time' => time(),
            ]);
        }
    }
}