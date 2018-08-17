# One
整合你的所有静态资源

## 使用方法

1. 将 `.env.example` 改名为 `.env` 并配置完成
2. Ngnix 伪静态设置: 
    ```nginx
    if (!-e $request_filename) {
        rewrite  ^/(.*)$ /__one/index.php?path=$uri last;
    }
    ```
3. Enjoy it!

## 实例

现本人博客所有静态资源已全部改为从 `https://static.xiaolin.in` 自动加载

## Demo

`.env` 文件:
```ini
[namespace]
blog[url] = https://xiaolin.in/
blog[expire] = 2592000
```

1. 访问 `https://<your_url>/blog/wp-content/themes/c7v5/style.min.css`
2. 若为第一次访问会自动 302 跳转至原 URL 并异步缓存至本地
3. 再次访问 `https://<your_url>/blog/wp-content/themes/c7v5/style.min.css`
4. 此次因为已缓存至本地直接加载缓存文件, 缓存有效期 2592000 秒 (一年)