const fs = require('fs')
const { access, mkdir, readFile, stat, writeFile, unlink } = fs.promises
const path = require('path')
const request = require('request')
const fileType = require('file-type')
const rimraf = require('rimraf')
const http = require('http')
const sharp = require('sharp')
const CleanCss = require('clean-css')
const zlib = require('zlib')
const SHA256 = require('crypto-js/sha256')

function exists (path) {
  const promise = access(path).then(() => true, err => {
    if (err.code !== 'ENOENT') throw err
    return false
  })

  return Promise.resolve(promise)
}

async function existsAndStat (filename) {
  try {
    return await stat(filename)
  } catch (error) {
    return false
  }
}

async function handler (req, res) {
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

    if (await exists(path.resolve(DIR, 'settings.json'))) {
      settings = JSON.parse(await readFile(path.resolve(DIR, 'settings.json')))

      filehash = SHA256(pathname).toString()

      DIR = path.resolve(DIR, 'data/', filehash)

      fileurl = settings.host + pathname

      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Expose-Headers', '*')
      res.setHeader('X-Powered-By', 'One')

      const filestat = await existsAndStat(path.resolve(DIR, 'file.br.data'))
      if (filestat && filestat.mtime.getTime() > (Date.now() - settings.expireTime)) {
        fileinfo = JSON.parse(await readFile(path.resolve(DIR, 'info.json')))

        res.setHeader('Content-Type', fileinfo.type)
        res.setHeader('Cache-Control', `max-age=${settings.expireTime / 1000}`)
        res.setHeader('Vary', 'Accept-Encoding')

        let acceptEncoding = req.headers['accept-encoding']
        if (!acceptEncoding) {
          acceptEncoding = ''
        }

        if (/\bbr\b/.test(acceptEncoding)) {
          res.setHeader('Content-Encoding', 'br')
          res.end(await readFile(path.resolve(DIR, 'file.br.data'), {
            encoding: null
          }))
        } else if (/\bgzip\b/.test(acceptEncoding)) {
          res.setHeader('Content-Encoding', 'gzip')
          res.end(await readFile(path.resolve(DIR, 'file.gz.data'), {
            encoding: null
          }))
        } else {
          res.setHeader('Content-Encoding', 'deflate')
          res.end(await readFile(path.resolve(DIR, 'file.data'), {
            encoding: null
          }))
        }
      } else {
        res.writeHead(302, {
          Location: fileurl
        })

        res.end()

        if (!await exists(DIR)) {
          await mkdir(DIR, {
            recursive: true
          })
        }

        if (await exists(path.resolve(DIR, 'do.lock')) && (await stat(path.resolve(DIR, 'do.lock')).mtime.getTime() + 60000) > Date.now()) {
          return
        }

        await writeFile(path.resolve(DIR, 'do.lock'), Date.now(), 'utf8')

        return new Promise((resolve, reject) => {
          request.get({
            url: fileurl,
            encoding: null,
            headers: {
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36',
              'cache-control': 'max-age=0'
            },
            timeout: 10000
          }, async (error, response, body) => {
            if (error) {
              rimraf.sync(DIR)
              reject(new Error(error))
              return
            }

            if (!(fileType(body) && (filemetadata = fileType(body).mime))) { filemetadata = response.headers['content-type'] }

            if (['image/png', 'image/jpg', 'image/jpeg'].includes(filemetadata)) {
              try {
                body = await sharp(body)
                  .webp()
                  .toBuffer()

                filemetadata = 'image/webp'
              } catch (e) {
                rimraf.sync(DIR)
                reject(new Error(e))
                return
              }
            }

            if (filemetadata.indexOf('text/css') !== -1) {
              const data = new CleanCss({}).minify(body.toString())
              if (data.errors.length !== 0) {
                // console.log(data.errors);
              } else { body = Buffer.from(data.styles) }
            }

            filemetadata = {
              type: filemetadata,
              size: body.length,
              time: Date.now()
            }
            // console.log(`[${response.statusCode}] ${filemetadata}`);

            await writeFile(path.resolve(DIR, 'file.data'), body, 'binary')
            await writeFile(path.resolve(DIR, 'file.gz.data'), zlib.gzipSync(body, {
              level: 9
            }), 'binary')
            await writeFile(path.resolve(DIR, 'file.br.data'), zlib.brotliCompressSync(body), 'binary')
            await writeFile(path.resolve(DIR, 'info.json'), JSON.stringify(filemetadata), 'utf8')
            await unlink(path.resolve(DIR, 'do.lock'))

            resolve()
          })
        })
      }
    } else {
      res.writeHead(404)
      res.end()
    }
  }
}

http.createServer(handler).listen(3000)
