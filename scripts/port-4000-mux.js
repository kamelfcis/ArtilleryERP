/**
 * VPS port-4000 multiplexer: ReelSaver (default) + Artillery (api-artillery host).
 * Deploy to C:\cloudflared\port-4000-mux.js; PM2 name: port-4000-mux.
 * Cloudflare tunnel remote ingress stays localhost:4000; Host header selects backend.
 */
const http = require('http')

const ARTILLERY_HOST = 'api-artillery.abdelrhmanabdelkhalek.com'
const ARTILLERY_TARGET = 'http://127.0.0.1:4001'
const REELSAVER_TARGET = 'http://127.0.0.1:4002'
const LISTEN_PORT = 4000

function proxy(req, res, targetBase) {
  const url = new URL(req.url || '/', targetBase)
  const opts = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers, host: url.host },
  }
  const upstream = http.request(opts, (up) => {
    res.writeHead(up.statusCode || 502, up.headers)
    up.pipe(res)
  })
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'bad_gateway', target: targetBase }))
  })
  req.pipe(upstream)
}

const server = http.createServer((req, res) => {
  const host = (req.headers.host || '').split(':')[0].toLowerCase()
  if (host === ARTILLERY_HOST) return proxy(req, res, ARTILLERY_TARGET)
  return proxy(req, res, REELSAVER_TARGET)
})

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(
    `port-${LISTEN_PORT}-mux listening; ${ARTILLERY_HOST} -> ${ARTILLERY_TARGET}, default -> ${REELSAVER_TARGET}`,
  )
})
