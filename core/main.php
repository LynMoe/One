<?php
/**
 * Created by PhpStorm.
 * User: XiaoLin
 * Date: 2018-08-17
 * Time: 5:00 PM
 */

require_once __DIR__ . '/Storage.php';

readfile(__DIR__ . '/../' . $namespace . '/' . (new Storage())->fetch($namespace,$path));