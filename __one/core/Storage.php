<?php
/**
 * Created by PhpStorm.
 * User: XiaoLin
 * Date: 2018-08-17
 * Time: 7:27 PM
 */

class Storage
{
    public static function get_file($url)
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
            'data' => $result,
            'type' => $type,
        ];
    }
}