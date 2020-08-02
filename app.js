const ERR_NO_SETTING_FOUND = Symbol('ERR_NO_SETTING_FOUND');

const fs = require('fs')
const { access, mkdir, readFile, stat, writeFile } = fs.promises
const { resolve } = require('path')
const request = require('request')
const fileType = require('file-type')
const rimraf = require('rimraf')
const http = require('http')
const sharp = require('sharp')
const CleanCss = require('clean-css')
const zlib = require('zlib')
const SHA256 = require('crypto-js/sha256')
const Promise = require('bluebird');

const processingList = {}

function exists(path) {
  const promise = access(path).then(() => true, err => {
    if (err.code !== 'ENOENT') throw err
    return false
  })

  return Promise.resolve(promise)
}

function existsAndStat(filename) {
  return Promise.resolve(stat(filename)).catch(() => false);
}

async function existsAndRead(filename) {
  return Promise.resolve(readFile(filename)).catch(() => null);
}

function handler(req, res) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
  let filehash, fileinfo, filemetadata, fileurl, pathname, namespace, settings

  if (req.url) {
    const parsedUrl = new URL('http://127.0.0.1' + req.url)
    const queryString = parsedUrl.search
    const { pathname: _pathname } = parsedUrl
    if (queryString) { pathname = _pathname + queryString } else { pathname = _pathname }

    namespace = pathname.split('/', 2)
    if (namespace) { namespace = namespace[1].replace(/ /g, '') }

    pathname = pathname.substr(namespace.length + 2)

    let DIR = path.resolve(__dirname, 'Cache/', namespace)

    return existsAndRead(path.resolve(DIR, 'settings.json'))
      .then(settings => {
        if (settings !== null) {
          settings = JSON.parse(settings)

          filehash = SHA256(pathname).toString()

          DIR = resolve(DIR, 'data/', filehash)

          fileurl = settings.host + pathname

          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Expose-Headers', '*')
          res.setHeader('X-Powered-By', 'One')

          return existsAndStat(path.resolve(DIR, 'file.br.data'))
        } else {
          throw new Error(ERR_NO_SETTING_FOUND);
        }
      })
      .then(filestat => {
        if (!processingList[DIR] && filestat && filestat.mtime.getTime() > (Date.now() - settings.expireTime)) {
          return readFile(resolve(DIR, 'info.json'))
            .then(fileinfo => {
              res.setHeader('Content-Type', fileinfo.type)
              res.setHeader('Cache-Control', `max-age=${settings.expireTime / 1000}`)
              res.setHeader('Vary', 'Accept-Encoding')

              let acceptEncoding = req.headers['accept-encoding']
              if (!acceptEncoding) {
                acceptEncoding = ''
              }

              if (/\bbr\b/.test(acceptEncoding)) {
                return readFile(resolve(DIR, 'file.br.data'), {
                  encoding: null
                }).then(data => {
                  res.setHeader('Content-Encoding', 'br')
                  res.end(data);
                })
              } else if (/\bgzip\b/.test(acceptEncoding)) {
                return readFile(resolve(DIR, 'file.gz.data'), {
                  encoding: null
                }).then(data => {
                  res.setHeader('Content-Encoding', 'gzip')
                  res.end(data)
                })
              } else {
                return readFile(resolve(DIR, 'file.data'), {
                  encoding: null
                }).then(data => {
                  res.setHeader('Content-Encoding', 'deflate')
                  res.end(data)
                })
              }
            });
        } else {
          res.writeHead(302, {
            Location: fileurl
          });

          res.end()

          if (processingList[DIR]) return;
          processingList[DIR] = true

          return exists(DIR).then(exist => {
            if (!exist) return mkdir(DIR, {
              recursive: true
            });
          }).then(() => Promise.fromCallback(cb => request.get({
            url: fileurl,
            encoding: null,
            headers: {
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36',
              'cache-control': 'max-age=0'
            },
            timeout: 10000
          }, cb), {
            multiArgs: true
          }).catch(e => {
            rimraf.sync(DIR);
            throw new e
          })).spread((response, body) => {
            if (!(fileType(body) && (filemetadata = fileType(body).mime))) { filemetadata = response.headers['content-type'] }

            if (['image/png', 'image/jpg', 'image/jpeg'].includes(filemetadata)) {
              return sharp(body).webp().toBuffer().then(body => {
                filemetadata = 'image/webp';
                return body
              }).catch(e => {
                rimraf.sync(DIR)
                throw new Error(e)
              });
            }

            if (filemetadata.indexOf('text/css') !== -1) {
              const data = new CleanCss({}).minify(body.toString())
              if (data.errors.length !== 0) {
              } else { body = Buffer.from(data.styles) }

              return body;
            }
          }).then(body => {
            filemetadata = {
              type: filemetadata,
              size: body.length,
              time: Date.now()
            }

            return Promise.all([
              writeFile(resolve(DIR, 'file.data'), body, 'binary'),
              writeFile(resolve(DIR, 'file.data'), body, 'binary'),
              writeFile(path.resolve(DIR, 'file.gz.data'), zlib.gzipSync(body, {
                level: 9
              }), 'binary')
            ])
          }).then(() => {
            delete processingList[DIR]
          })
        }
      })
      .catch(e => {
        if (e.message === ERR_NO_SETTING_FOUND) {
          res.writeHead(404)
          res.end()
        } else {
          throw new e
        }
      });
  }
}

http.createServer(handler).listen(3000)
