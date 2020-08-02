const fs = require("fs");
const { exists, mkdir, readFile, stat, writeFile, unlink } = fs.promises;
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

    if (!await exists(DIR + "Cache"))
        await mkdir(DIR + "Cache");
    DIR = DIR + "Cache/";

    if (pathname = req.url) {
        const parsedUrl = url.parse(pathname);
        const queryString = parsedUrl.search;
        const { pathname: _pathname } = parsedUrl;
        if (queryString)
            pathname = _pathname + queryString;
        else
            pathname = _pathname;
        // console.log("Pathname: " + pathname);

        namespace = pathname.split("/", 2);
        if (namespace)
            namespace = namespace[1].replace(/ /g, "");
        // console.log(`Namespace: ${namespace}`);
        pathname = pathname.substr(namespace.length + 2);

        if (await exists(DIR = DIR + namespace + "/") && namespace && await exists(DIR + "settings.json")) {
            // console.log("Namespace exist.");
            settings = JSON.parse(await readFile(DIR + "settings.json"));
            // console.log(settings);
            // console.log("File name: " + pathname);

            filehash = SHA256(pathname);
            // console.log("File path hash: " + filehash);

            if (await exists(DIR = DIR + "data/"))
                await mkdir(DIR);

            DIR = DIR + filehash + "/";

            fileurl = settings.host + pathname;
            // console.log("File url: " + fileurl);

            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Expose-Headers", "*");
            res.setHeader("X-Powered-By", "One");

            if (await exists(DIR) && await exists(DIR + "info.json") &&
                await stat(DIR + "file.data").mtime.getTime() > (Date.now() - settings.expireTime) &&
                await exists(DIR + "file.br.data")) {
                fileinfo = JSON.parse(await readFile(DIR + "info.json"));

                sent = true;
                // console.log("File type:" + fileinfo.type);

                res.setHeader("Content-Type", fileinfo.type);
                res.setHeader("Cache-Control", `max-age=${settings.expireTime / 1000}`);

                res.setHeader("Vary", "Accept-Encoding");

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

                if (await exists(DIR + "do.lock") && (await stat(DIR + "do.lock").mtime.getTime() + 60000) > Date.now()) {
                    return;
                }

                if (await exists(DIR))
                    await mkdir(DIR);

                await writeFile(DIR + "do.lock", Date.now(), "utf8");

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

                        await writeFile(DIR + "file.data", body, "binary");
                        await writeFile(DIR + "file.gz.data", zlib.gzipSync(body, {
                            level: 9
                        }), "binary");
                        await writeFile(DIR + "file.br.data", zlib.brotliCompressSync(body), "binary");
                        await writeFile(DIR + "info.json", JSON.stringify(filemetadata), "utf8");
                        await unlink(DIR + "do.lock");

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
