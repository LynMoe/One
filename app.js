const Promise = require('bluebird')
const {
  accessAsync: access,
  mkdirAsync: mkdir,
  readFileAsync: readFile,
  statAsync: stat,
  writeFileAsync: writeFile
} = Promise.promisifyAll(require('fs'))
const path = require('path')
const request = require('request')
const fileType = require('file-type')
const rimraf = require('rimraf')
const http = require('http')
const sharp = require('sharp')
const CleanCss = require('clean-css')
const zlib = require('zlib')
const sha256 = require('crypto-js/sha256')
const os = require('os')
const cluster = require('cluster')

const processingList = {}
const settingList = {}

let isWorker = false

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

async function existsAndRead (filename) {
  try {
    return await readFile(filename)
  } catch (error) {
    return false
  }
}

async function fetchFile (DIR, filehash, fileurl) {
  if (processingList[filehash]) return
  processingList[filehash] = true

  if (!await exists(DIR)) {
    await mkdir(DIR, {
      recursive: true
    })
  }

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
      let filemetadata = ''

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
        } else { body = Buffer.from(data.styles) }
      }

      filemetadata = {
        type: filemetadata,
        size: body.length,
        time: Date.now()
      }

      await writeFile(path.resolve(DIR, 'file.data'), body, 'binary')
      await writeFile(path.resolve(DIR, 'file.gz.data'), zlib.gzipSync(body, {
        level: 9
      }), 'binary')
      await writeFile(path.resolve(DIR, 'file.br.data'), zlib.brotliCompressSync(body), 'binary')
      await writeFile(path.resolve(DIR, 'info.json'), JSON.stringify(filemetadata), 'utf8')
      delete processingList[filehash]

      resolve()
    })
  })
}

async function handler (req, res) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
  let filehash, fileinfo, fileurl, pathname, namespace

  pathname = req.url

  namespace = pathname.split('/', 2)
  if (namespace) { namespace = namespace[1].replace(/ /g, '') }

  pathname = pathname.substr(namespace.length + 2)

  let DIR = path.resolve(__dirname, 'Cache/', namespace)

  let settings
  {
    const settingPath = path.resolve(DIR, 'settings.json')
    const settingHash = sha256(settingPath)

    settings = settingList[settingHash] || (settingList[settingHash] = await existsAndRead(settingPath))
  }

  if (settings !== false) {
    settings = JSON.parse(settings)

    filehash = sha256(pathname).toString()

    DIR = path.resolve(DIR, 'data/', filehash)

    fileurl = settings.host + pathname

    const filestat = await existsAndStat(path.resolve(DIR, 'info.json'))
    if (!processingList[filehash] && filestat && filestat.mtime.getTime() > (Date.now() - settings.expireTime)) {
      try {
        fileinfo = JSON.parse(await readFile(path.resolve(DIR, 'info.json')))
      } catch (error) {
        fileinfo = false
      }
    } else fileinfo = false

    if (fileinfo !== false) {
      // res.setHeader('Content-Type', fileinfo.type)
      // res.setHeader('Cache-Control', `max-age=${settings.expireTime / 1000}`)
      // res.setHeader('Vary', 'Accept-Encoding')
      // res.setHeader('X-Powered-By', 'One')

      let acceptEncoding = req.headers['accept-encoding']
      if (!acceptEncoding) {
        acceptEncoding = ''
      }

      if (/\bbr\b/.test(acceptEncoding)) {
        acceptEncoding = 'br'
        // res.setHeader('Content-Encoding', 'br')
        // res.end(await readFile(path.resolve(DIR, 'file.br.data'), {
        //   encoding: null
        // }))
      } else if (/\bgzip\b/.test(acceptEncoding)) {
        acceptEncoding = 'gzip'
        // res.setHeader('Content-Encoding', 'gzip')
        // res.end(await readFile(path.resolve(DIR, 'file.gz.data'), {
        //   encoding: null
        // }))
      } else {
        acceptEncoding = 'deflate'
        // res.setHeader('Content-Encoding', 'deflate')
        // res.end(await readFile(path.resolve(DIR, 'file.data'), {
        //   encoding: null
        // }))
      }

      res.writeHead(200, {
        'Content-Type': fileinfo.type,
        'Cache-Control': `max-age=${settings.expireTime / 1000}`,
        'Content-Encoding': acceptEncoding,
        Vary: 'Accept-Encoding',
        'X-Powered-By': 'isXiaoLin/One'
      })
      if (acceptEncoding !== 'deflate') acceptEncoding += '.'
      else acceptEncoding = ''

      res.end(await readFile(path.resolve(DIR, `file.${acceptEncoding}data`), {
        encoding: null
      }))
    } else {
      res.writeHead(302, {
        Location: fileurl
      })
      res.end()

      if (isWorker) {
        process.send({
          type: 'fetch',
          data: [DIR, filehash, fileurl]
        })
      } else {
        fetchFile(DIR, filehash, fileurl)
      }
    }
  } else {
    res.writeHead(404)
    res.end()
  }
}

const clusterWorkerSize = os.cpus().length

if (clusterWorkerSize > 1) {
  if (cluster.isMaster) {
    for (let i = 0; i < clusterWorkerSize; i++) {
      const worker = cluster.fork()
      worker.on('message', (msg = {}) => {
        if (msg.type === 'fetch') fetchFile(...msg.data)
      })
    }

    cluster.on('exit', function (worker) {
      console.log('Worker', worker.id, ' has exitted.')
    })
  } else {
    isWorker = true

    http.createServer(handler).listen(3000)

    console.log(`HTTP server listening on port 3000, pid ${process.pid}`)
  }
} else {
  http.createServer(handler).listen(3000)

  console.log(`HTTP server listening on port 3000 with the single worker, pid ${process.pid}`)
}
