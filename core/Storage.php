<?php
/**
 * Created by PhpStorm.
 * User: XiaoLin
 * Date: 2018-08-17
 * Time: 7:27 PM
 */

use \CloudConvert\Api;

class Storage
{
    public function fetch($namespace,$path)
    {
        $db = new MysqliDb(CONFIG['database']['host'],CONFIG['database']['username'],
            CONFIG['database']['password'],CONFIG['database']['database'],CONFIG['database']['port']);

        try
        {
            $db->query("CREATE TABLE if not exists `{$namespace}` (`id` int(11) PRIMARY KEY AUTO_INCREMENT,`path` text, `path_md5` text, `file_type` text,`status` int(11), `time` int(11));");

            if (!is_dir(__DIR__ . '/../cache/' . $namespace))
                mkdir(__DIR__ . '/../cache/' . $namespace);

            if ($db->where('path_md5',md5($path))->has($namespace))
            {
                $result = $db->where('path_md5',md5($path))->get($namespace)[0];

                if ($result['status'] == 0 || (time() - $result['time']) > CONFIG['namespace'][$namespace]['expire'])
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

            $str = ob_get_contents() . 'Moved';
            header('Location: ' . CONFIG['namespace'][$namespace]['url'] . $path);
            header('Content-Length: '. strlen($str) - 1);
            header('Connection: Close');
            ob_start();
            echo $str;
            ob_flush();
            flush();
            fastcgi_finish_request();
            ignore_user_abort(true);

            $fileurl = CONFIG['namespace'][$namespace]['url'] . $path;

            $data = $this->
            get_file(
                $fileurl,
                (empty(CONFIG['namespace'][$namespace]['header'])) ? [
                    'Referer: ' . CONFIG['namespace'][$namespace]['url'] . $path,
                    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
                ] : CONFIG['namespace'][$namespace]['header'],
                (empty(CONFIG['namespace'][$namespace]['proxy'])) ? ['use' => false,] : CONFIG['namespace'][$namespace]['proxy']
            );

            $filename = __DIR__ . '/../cache/' . $namespace . '/' . md5($path);

            if (file_put_contents($filename,$data['data']))
            {
                $filetype = ($data['type'] == 'application/octet-stream') ? '' : $data['type'];

                if (isset(CONFIG['general']['useCloudConvert']) && CONFIG['general']['useCloudConvert'] && in_array($filetype,['image/jpg','image/png','image/jpeg',]))
                {
                    try
                    {
                        $api = new Api(CONFIG['general']['cloudConvertKey']);

                        $api->convert([
                            'inputformat' => (stripos('jpeg',$filetype)) ? 'jpeg' : ((stripos('jpg',$filetype)) ? 'jpg' : 'png'),
                            'outputformat' => 'webp',
                            'input' => 'download',
                            'file' => $fileurl,
                        ])
                            ->wait()
                            ->download($filename);
                        $filetype = 'image/webp';
                    } catch (Exception $exception)
                    {
                        \Sentry\captureException($exception);
                    }
                }

                $db->where('id',$id)->update($namespace,[
                    'file_type' => $filetype,
                    'status' => 1,
                    'time' => time(),
                ]);
            }
        } catch (Exception $exception)
        {
            \Sentry\captureException($exception);
        }
    }

    protected function output($data,$namespace)
    {
        if (!empty($data['file_type']))
            header("Content-type: " . $data['file_type']);
        header('Cache-Control: max-age=' . CONFIG['namespace'][$namespace]['expire']);
        header('Content-Length: ' . filesize(__DIR__ . '/../cache/' . $namespace . '/' . $data['path_md5']));
        header('Date: ' . date("D, j M Y G:i:s \G\M\T",$data['time']));

        return $data['path_md5'];
    }

    protected function get_file($url,$header = [],$proxy = ['use' => false,])
    {
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
        curl_setopt($ch,CURLOPT_TIMEOUT,40);

        if ($proxy['use'])
        {
            curl_setopt($ch, CURLOPT_PROXY, $proxy['host']);
            curl_setopt($ch, CURLOPT_PROXYUSERPWD, $proxy['auth']);
            curl_setopt($ch, CURLOPT_PROXYTYPE, $proxy['type']);
        }

        $result = curl_exec($ch);
        $type = curl_getinfo($ch,CURLINFO_CONTENT_TYPE);

        if (curl_exec($ch) === false)
        {
            \Sentry\captureMessage('Curl error: ' . curl_error($ch));
            die;
        }

        $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($httpcode < 200 && $httpcode >= 300)
        {
            \Sentry\captureMessage('404 error.');
            die;
        }

        curl_close($ch);

        return [
            'type' => (is_null($type)) ? 'text/plain' : $type,
            'data' => $result,
        ];
    }
}