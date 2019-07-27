<?php
/**
 * Created by PhpStorm.
 * User: LoliLin
 * Date: 2018-12-08
 * Time: 11:39
 */

define('CONFIG',[
    'general' => [
        'sentryDsn' => 'https://9570f7e1c9404f2b98cb3eed9e6192d8@sentry.io/1389092', // SenTry 平台错误管理，详见README
        'useCloudConvert' => false,
        'cloudConvertKey' => '',
    ],
    'namespace' => [
        'google' => [
            'url' => '',
            'expire' => 3600 * 24,
            'header' => [],
            'proxy' => [
                'host' => 'http://',
                'auth' => 'username:password',
                'type' => CURLPROXY_HTTP,
            ],
        ],
    ],
    'database' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'username' => '',
        'password' => '',
        'database' => '',
    ],
]);