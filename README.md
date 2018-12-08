## 简介

前段时间(大概是暑假的时候)整理博客的时候发现博客静态资源加载速度太慢了，而且也加载了各种来源的资源，于是就萌发了写一个整合静态资源的小程序，因为只会 PHP，所以自然也就用 PHP 来写了 (x

## 项目地址

别找惹就是这里

## Feature

- 简易的配置文件
- 轻量级的代码
- 高效的缓存机制
- 各种各样奇怪的Bug (x
- (编不出来惹 (还是那句老话

## 食用方法

- ```git clone https://github.com/LoliLin/One.git```
- ```cd One && mv config.example.php config.php```
- 修改 `config.php` 文件中的数据库信息及静态文件地址
- Enjoy it!

### 伪静态

Nginx: 
```nginx
rewrite  ^/(.*)$ /index.php?path=$uri last;
```

#### 示例

规则: `https://static.xx.xx/$namespace/$path`

原地址: https://cdnjs.com/abc/abc.min.js

在配置中添加数组(URL 后面一定要有 `/`)
> 用 JSON 写只是做个示范
```json
{
    "cdnjs":{
        "url":"https://cdnjs.com/",
        "expire":3600
    }
}
```
在此示范中 `cdnjs` 为 `namespace`

所以地址即可替换为: https://static.xx.xx/cdnjs/adc/adc.min.js

## DEMO
访问 小霖的个人页 并单击 F12 查看 Source 选项卡，静态资源全部都是 static.xiaolin.in 是吧 (x

## Tips
- 建议套 CDN ，不然可能起不到啥效果
- 小心你的流量 (
- 当遇到很奇葩的 CDN 供应商(就是那种缓存内容不看 max-age 的，比如腾讯云)的时候，你需要到 CDN 供应商那里通过目录设置缓存
- 小心你的服务器磁盘
- 不要用部署在国内的服务器本程序去缓存 404 网站的内容 (
- 小心 Bug (((