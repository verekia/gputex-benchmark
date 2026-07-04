// Serves this directory and opens compare.html (the visual gputex-vs-spark
// quality tool) in headed Chrome with the real GPU, then stays open for
// interactive use. Unlike run.mjs it runs no benchmark — the page is driven by
// the user.  node serve.mjs   (or: npm run compare)

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wgsl': 'text/plain', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
    if (p === '/' || p === '\\') p = '/compare.html'
    const file = join(ROOT, p)
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end('not found') }
})

await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const url = `http://127.0.0.1:${port}/compare.html`
console.log('visual compare:', url, '\n(close the browser window or press Ctrl-C to stop)')

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false, // headed → real Metal GPU
  args: ['--enable-unsafe-webgpu', '--enable-dawn-features=allow_unsafe_apis', '--use-angle=metal', '--start-maximized'],
})
const context = await browser.newContext({ viewport: null }) // use the full window
const page = await context.newPage()
page.on('console', m => console.log('  [page]', m.text()))
page.on('pageerror', e => console.log('  [pageerror]', e.message))
await page.goto(url, { waitUntil: 'load' })
browser.on('disconnected', () => { server.close(); process.exit(0) })
