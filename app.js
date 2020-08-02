const Promise = require('bluebird')
const {
  accessAsync: access,
  mkdirAsync: mkdir,
  readFileAsync: readFile,
  statAsync: stat,
  writeFileAsync: writeFile
} = Promise.promisifyAll(require('fs'))
const cluster = require('cluster')
const hash = require('crypto').createHash
const os = require('os')

const request = cluster.isMaster && require('request')
const fileType = cluster.isMaster && require('file-type')
const rimraf = cluster.isMaster && require('rimraf')
const sharp = cluster.isMaster && require('sharp')
const CleanCSS = cluster.isMaster && require('clean-css')
const zlib = cluster.isMaster && require('zlib')

function md5 (string) {
  return hash('md5').update(string).digest('hex')
}

const processingList = {}
const settingList = {}

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
        const data = new CleanCSS({}).minify(body.toString())
        if (data.errors.length !== 0) {
        } else { body = Buffer.from(data.styles) }
      }

      filemetadata = {
        type: filemetadata,
        size: body.length,
        time: Date.now()
      }

      await writeFile(DIR + 'file.data', body, 'binary')
      await writeFile(DIR + 'file.gzip.data', zlib.gzipSync(body, {
        level: 9
      }), 'binary')
      await writeFile(DIR + 'file.br.data', zlib.brotliCompressSync(body), 'binary')
      await writeFile(DIR + 'info.json', JSON.stringify(filemetadata), 'utf8')
      delete processingList[filehash]

      resolve()
    })
  })
}

async function handler (req, res) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
  let filehash, fileinfo, pathname, namespace

  pathname = req.url

  namespace = pathname.split('/', 2)
  if (namespace) { namespace = namespace[1].replace(/ /g, '') }

  pathname = pathname.substr(namespace.length + 2)

  let DIR = `${__dirname}/Cache/${namespace}/`

  let settings
  {
    const settingPath = DIR + 'settings.json'
    const settingHash = md5(settingPath)

    settings = settingList[settingHash] || (settingList[settingHash] = await existsAndRead(settingPath))
  }

  if (settings !== false) {
    settings = JSON.parse(settings)

    filehash = md5(pathname)

    DIR += 'data/' + filehash + '/'

    const filestat = await existsAndStat(DIR + 'info.json')
    if (!processingList[filehash] && filestat && filestat.mtime.getTime() > (Date.now() - settings.expireTime)) {
      try {
        fileinfo = JSON.parse(await readFile(DIR + 'info.json'))
      } catch (error) {
        fileinfo = false
      }
    } else fileinfo = false

    if (fileinfo !== false) {
      let acceptEncoding = req.headers['accept-encoding']
      if (!acceptEncoding) {
        acceptEncoding = ''
      }

      if (/\bbr\b/.test(acceptEncoding)) {
        acceptEncoding = 'br'
      } else if (/\bgzip\b/.test(acceptEncoding)) {
        acceptEncoding = 'gzip'
      } else {
        acceptEncoding = 'deflate'
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

      res.end(await readFile(DIR + `file.${acceptEncoding}data`, {
        encoding: null
      }))
    } else {
      const fileurl = settings.host + pathname

      res.writeHead(302, {
        Location: fileurl
      })
      res.end()

      if (cluster.isWorker) {
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
const http = require('http')

function createServer () {
  http.createServer(handler).listen(3000)
}

if (clusterWorkerSize > 1) {
  if (cluster.isMaster) {
    for (let i = 0; i < clusterWorkerSize; i++) {
      const worker = cluster.fork()
      worker.on('message', (msg = {}) => {
        if (msg.type === 'fetch') {
          try {
            fetchFile(...msg.data)
          } catch (error) {
            delete processingList[msg.data[1]]
          }
        }
      })
    }

    cluster.on('exit', function (worker) {
      console.log('Worker', worker.id, ' has exitted.')
    })
  } else {
    createServer()

    console.log(`HTTP server listening on port 3000, pid ${process.pid}`)
  }
} else {
  createServer()

  console.log(`HTTP server listening on port 3000 with the single worker, pid ${process.pid}`)
}
