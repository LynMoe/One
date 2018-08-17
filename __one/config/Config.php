<?php
/**
 * Created by PhpStorm.
 * User: XiaoLin
 * Date: 2018-08-17
 * Time: 4:49 PM
 */

if (!file_exists(__DIR__ . '/.env')) die('尚未配置');
define('CONFIG',parse_ini_file(__DIR__ . '/.env',true));