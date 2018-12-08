<?php
/**
 * Created by PhpStorm.
 * User: XiaoLin
 * Date: 2018-08-17
 * Time: 7:27 PM
 */

class Storage
{
    protected function output($data,$namespace)
    {
        if (!empty($data['file_type']))
            header("Content-type: " . $data['file_type']);
        header('Cache-Control: max-age=' . CONFIG['namespace'][$namespace]['expire']);
        header('Content-Length: ' . filesize(__DIR__ . '/../../' . $data['path_md5']));

        return $data['path'];
    }

    public function fetch($namespace,$path)
    {
        $db = new MysqliDb(CONFIG['database']['host'],CONFIG['database']['username'],
            CONFIG['database']['password'],CONFIG['database']['database'],CONFIG['database']['port']);

        try
        {
            $db->query("CREATE TABLE if not exists `{$namespace}` 
(`id` int(11) PRIMARY KEY AUTO_INCREMENT,`path` text, `path_md5` text, `file_type` text,`status` int(11), `time` int(11));");

            if (!is_dir(__DIR__ . '/../../' . $namespace))
                mkdir(__DIR__ . '/../../' . $namespace);

            if ($db->where('path_md5',md5($path))->has($namespace))
            {
                $result = $db->where('path_md5',md5($path))->get($namespace);

                if ($result['status'] == 0)
                {
                    $id = $result['id'];
                } else {
                    $result['path'] = urldecode($result['path']);
                    return $this->output($result,$namespace);
                }
            } else {
                $id = $db->insert($namespace,[
                    'path' => urlencode($path),
                    'path_md5' => md5($path),
                    'file_type' => '',
                    'time' => time(),
                    'status' => 0,
                ]);
            }

            ob_end_clean();
            header("Connection: close\r\n");
            header("Content-Encoding: none\r\n");
            header('Location: ' . CONFIG['namespace'][$namespace]['url'] . $path);
            header('Cache-Control: max-age=0');
            header("Connection: Close");
            ignore_user_abort(true);
            ob_start();
            echo 'Moved';
            $size = ob_get_length();
            header("Content-Length: $size");
            ob_end_flush();
            flush();
            ob_end_clean();

            $data = $this->get_file(CONFIG['namespace'][$namespace]['url'] . $path);
            if (file_put_contents(__DIR__ . '/../../' . md5($path),$data['data']))
            {
                $file_type = ($data['type'] == 'application/octet-stream') ? '' : $data['type'];

                $db->where('id',$id)->update($namespace,[
                    'file_type' => $file_type,
                    'status' => 1,
                    'time' => time(),
                ]);
            } else
                die;

            $result['file_type'] = $file_type;
            $result['time'] = time();
            $result['status'] = 1;

            return $this->output($result,$namespace);
        } catch (Exception $exception)
        {
            return '';
        }
    }

    protected function get_file($url)
    {
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Referer: ' . $url,
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
        ));

        $result = curl_exec($ch);
        $type = curl_getinfo($ch,CURLINFO_CONTENT_TYPE);

        if (curl_exec($ch) === false)
        {
            error_log('Curl error: ' . curl_error($ch));
            die;
        }

        curl_close($ch);

        return [
            'type' => (is_null($type)) ? 'text/html' : $type,
            'data' => $result,
        ];
    }
}