const fs = require("fs");
const url = require("url");
const request = require("request");
const fileType = require("file-type");
const rimraf = require("rimraf");
const http = require("http");
const sharp = require("sharp");
const cleanCss = require("clean-css");
const zlib = require("zlib");
const SHA256 = require("crypto-js/sha256");

async function handler(req, res) {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    let DIR = __dirname + "/";
    let filedata, filehash, fileinfo, filemetadata, fileurl, pathname, namespace, settings;

    // console.log("JavaScript HTTP trigger function processed a request.");

    if (!fs.existsSync(DIR + "Cache"))
        fs.mkdirSync(DIR + "Cache");
    DIR = DIR + "Cache/";

    if (pathname = req.url) {
        if (url.parse(pathname).search)
            pathname = url.parse(pathname).pathname + url.parse(pathname).search;
        else
            pathname = url.parse(pathname).pathname;
        // console.log("Pathname: " + pathname);

        namespace = pathname.split("/", 2);
        if (namespace)
            namespace = namespace[1].replace(/ /g, "");
        // console.log(`Namespace: ${namespace}`);
        pathname = pathname.substr(namespace.length + 2);

        if (fs.existsSync(DIR = DIR + namespace + "/") && namespace && fs.existsSync(DIR + "settings.json")) {
            // console.log("Namespace exist.");
            settings = JSON.parse(fs.readFileSync(DIR + "settings.json"));
            // console.log(settings);
            // console.log("File name: " + pathname);

            filehash = SHA256(pathname);
            // console.log("File path hash: " + filehash);

            if (!fs.existsSync(DIR = DIR + "data/"))
                fs.mkdirSync(DIR);

            DIR = DIR + filehash + "/";

            fileurl = settings.host + pathname;
            // console.log("File url: " + fileurl);

            if (fs.existsSync(DIR) && fs.existsSync(DIR + "info.json") &&
                fs.statSync(DIR + "file.data").mtime.getTime() > (Date.now() - settings.expireTime) &&
                fs.existsSync(DIR + "file.br.data")) {
                fileinfo = JSON.parse(fs.readFileSync(DIR + "info.json"));

                sent = true;
                // console.log("File type:" + fileinfo.type);

                res.setHeader("Content-Type", fileinfo.type);
                res.setHeader("Cache-Control", `max-age=${settings.expireTime / 1000}`);
                res.setHeader("Access-Control-Allow-Origin", "*");

                res.setHeader("Vary", "Accept-Encoding");
                res.setHeader("X-Powered-By", "One");

                let acceptEncoding = req.headers["accept-encoding"];
                if (!acceptEncoding) {
                    acceptEncoding = "";
                }

                if (/\bbr\b/.test(acceptEncoding)) {
                    res.setHeader("Content-Encoding", "br");
                    res.end(fs.readFileSync(DIR + "file.br.data", {
                        encoding: null
                    }));
                } else if (/\bgzip\b/.test(acceptEncoding)) {
                    res.setHeader("Content-Encoding", "gzip");
                    res.end(fs.readFileSync(DIR + "file.gz.data", {
                        encoding: null
                    }));
                } else {
                    res.setHeader("Content-Encoding", "deflate");
                    res.end(fs.readFileSync(DIR + "file.data", {
                        encoding: null
                    }));
                }

                return;
            } else {
                res.writeHead(307, {
                    "Location": fileurl,
                });
                sent = true;
                res.end("Moved");

                if (fs.existsSync(DIR + "do.lock") && (fs.statSync(DIR + "do.lock").mtime.getTime() + 60000) > Date.now()) {
                    return;
                }

                if (!fs.existsSync(DIR))
                    fs.mkdirSync(DIR);

                fs.writeFileSync(DIR + "do.lock", Date.now(), "utf8");

                sent = true;
                return new Promise((resolve, reject) => {
                    request.get({
                        url: fileurl,
                        encoding: null,
                        headers: {
                            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36",
                            "cache-control": "max-age=0",
                        },
                        timeout: 10000
                    }, async (error, response, body) => {
                        // console.log(error,response,body);
                        if (error) {
                            // console.log(error.toString());
                            rimraf.sync(DIR);
                            res.writeHead(500);
                            res.end();
                            reject();
                            return;
                        }

                        if (!(fileType(body) && (filemetadata = fileType(body).mime)))
                            filemetadata = response.headers["content-type"];

                        // console.log(filemetadata);

                        if (["image/png", "image/jpg", "image/jpeg"].includes(filemetadata)) {
                            try {
                                body = await sharp(body)
                                    .webp()
                                    .toBuffer();

                                filemetadata = "image/webp";
                            } catch (e) {
                                // console.log(e);
                                rimraf.sync(DIR);
                                reject();
                                return;
                            }
                        }

                        if (filemetadata.indexOf("text/css") !== -1) {
                            let data = new cleanCss({}).minify(body.toString());
                            if (data.errors.length !== 0) {
                                // console.log(data.errors);
                            } else
                                body = Buffer.from(data.styles);
                        }

                        filemetadata = {
                            "type": filemetadata,
                            "size": body.length,
                            "time": Date.now(),
                        };
                        // console.log(`[${response.statusCode}] ${filemetadata}`);

                        fs.writeFileSync(DIR + "file.data", body, "binary");
                        fs.writeFileSync(DIR + "file.gz.data", zlib.gzipSync(body, {
                            level: 9
                        }), "binary");
                        fs.writeFileSync(DIR + "file.br.data", zlib.brotliCompressSync(body), "binary");
                        fs.writeFileSync(DIR + "info.json", JSON.stringify(filemetadata), "utf8");
                        fs.unlinkSync(DIR + "do.lock");

                        resolve();
                    });
                });
            }
        } else {
            res.writeHead(404);
            res.end();
        }
    }
}

http.createServer(handler).listen(3000);