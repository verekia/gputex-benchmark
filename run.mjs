// Launches the user's installed Google Chrome (headed, with WebGPU + full
// timestamp precision flags) via playwright-core, serves this directory over
// HTTP, runs bench.js, and writes results.json.
//
//   node run.mjs            # full run
//
// Requires: playwright-core (npm i), Google Chrome installed.

import { createServer } from 'node:http'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wgsl': 'text/plain', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

// Scan textures/ recursively → a manifest of { url, name } the page loads. A
// readable name is derived from the path (AmbientCG sets, packed-materials, …).
function niceName(rel) {
  const file = rel.replace(/\.(png|jpe?g)$/i, '').split('/').pop()
  let m = file.match(/^(.+?)_(\d+K)-JPG_(.+)$/)
  if (m) return `${m[1]} ${m[2]} ${m[3].replace('NormalGL', 'Normal').replace('AmbientOcclusion', 'AO')}`
  m = file.match(/^packed-materials-(\d+)$/)
  if (m) return `packed ${m[1]}`
  return file
}
async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(p))
    else if (/\.(png|jpe?g)$/i.test(e.name)) out.push(p)
  }
  return out
}
async function buildManifest() {
  const dir = join(ROOT, 'textures')
  let files = []
  try { files = await walk(dir) } catch { return [] }
  return files
    .map(f => ({ url: relative(ROOT, f).split(/[/\\]/).join('/'), name: niceName(relative(dir, f).split(/[/\\]/).join('/')) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
let manifest = await buildManifest()
if (process.env.TEX_LIMIT) manifest = manifest.slice(0, +process.env.TEX_LIMIT) // smoke-test subset
await writeFile(join(ROOT, 'textures.json'), JSON.stringify(manifest, null, 2))
console.log('textures manifest:', manifest.length, 'images')

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
    if (p === '/' || p === '\\') p = '/bench.html'
    const file = join(ROOT, p)
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404); res.end('not found')
  }
})

await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port
// FORMAT=ETC2 (or a comma list) runs only those formats — bench.js reads ?format=…
const fmtQuery = process.env.FORMAT ? `?format=${encodeURIComponent(process.env.FORMAT)}` : ''
const url = `http://127.0.0.1:${port}/bench.html${fmtQuery}`
console.log('serving', ROOT, '->', url, process.env.FORMAT ? `(formats: ${process.env.FORMAT})` : '')

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false, // headed: guarantees the real Metal GPU, not a SwiftShader fallback
  args: [
    '--enable-unsafe-webgpu',
    '--enable-dawn-features=allow_unsafe_apis',       // full-precision timestamps + unsafe APIs
    '--disable-dawn-features=timestamp_quantization', // turn off the 100us privacy bucketing
    '--use-angle=metal',
  ],
})

const page = await browser.newPage()
page.on('console', m => console.log('  [page]', m.text()))
page.on('pageerror', e => console.log('  [pageerror]', e.message))

await page.goto(url, { waitUntil: 'load' })
await page.waitForFunction('window.__BENCH_DONE__ === true', null, { timeout: 2400000 })

const err = await page.evaluate('window.__BENCH_ERROR__')
if (err) { console.error('BENCH ERROR:\n', err); await browser.close(); server.close(); process.exit(1) }

const results = await page.evaluate('window.__BENCH_RESULTS__')
await writeFile(join(ROOT, 'results.json'), JSON.stringify(results, null, 2))
console.log('\nwrote results.json —', results.runs.length, 'runs')

await browser.close()
server.close()
