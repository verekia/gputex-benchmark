// Launches the user's installed Google Chrome (headed, with WebGPU + full
// timestamp precision flags) via playwright-core, serves this directory over
// HTTP, runs bench.js, and writes results.json.
//
//   node run.mjs            # full run
//   RUNS=3 node run.mjs     # 3 fresh browser launches; per-cell median of the
//                           # per-run mins (quality is scored once — deterministic)
//
// If shaders/gputex-prev/ holds shaders (the previous gputex release), each
// format also times that baseline interleaved with the current gputex shader
// (library 'gputex-prev'); PREV=0 turns that off.
//
// Requires: playwright-core (npm i), Google Chrome installed.

import { createServer } from 'node:http'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join, normalize, relative, resolve } from 'node:path'
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

let hasPrev = false
try { hasPrev = (await readdir(join(ROOT, 'shaders', 'gputex-prev'))).some(f => f.endsWith('.wgsl')) } catch {}
if (process.env.PREV === '0') hasPrev = false
const RUNS = Math.max(1, Math.floor(+(process.env.RUNS || 1)))

async function benchOnce(runIndex) {
  // FORMAT=ETC2 (or a comma list) runs only those formats — bench.js reads ?format=…
  const q = new URLSearchParams()
  if (process.env.FORMAT) q.set('format', process.env.FORMAT)
  if (hasPrev) q.set('prev', '1')
  if (runIndex > 0 || process.env.QUALITY === '0') q.set('quality', '0') // deterministic — score it once
  if (process.env.BATCH_MS) q.set('batchms', process.env.BATCH_MS)
  const url = `http://127.0.0.1:${port}/bench.html${q.size ? '?' + q : ''}`
  console.log(`\n=== run ${runIndex + 1}/${RUNS} ===`, url, process.env.FORMAT ? `(formats: ${process.env.FORMAT})` : '', hasPrev ? '(+ gputex-prev baseline)' : '')

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
  try {
    const page = await browser.newPage()
    page.on('console', m => console.log('  [page]', m.text()))
    page.on('pageerror', e => console.log('  [pageerror]', e.message))
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForFunction('window.__BENCH_DONE__ === true', null, { timeout: 2400000 })
    const err = await page.evaluate('window.__BENCH_ERROR__')
    if (err) throw new Error('BENCH ERROR:\n' + err)
    return await page.evaluate('window.__BENCH_RESULTS__')
  } finally {
    await browser.close()
  }
}

// Per-cell aggregate over runs. Aggregate the paired RATIOS, not the times:
// each run's paired times are anchored to that run's clock (absolute speed
// swung ~1.5× between runs on the M3), so per-entry medians taken
// independently can pick different runs for different entries and break the
// pairing. paired = median over runs of the entry's ratio to the cell's
// reference entry × the median of the reference's own time; `min` is the
// median of the per-run mins. Raw per-run values are kept alongside.
function aggregate(all, results) {
  const maps = all.map(res => new Map(res.runs.filter(r => !r.error).map(r => [key(r), r])))
  results.runs = results.runs.map(r => {
    if (r.error) return r
    const rs = maps.map(m => m.get(key(r))).filter(Boolean)
    const out = { ...r, min: median(rs.map(x => x.min)), median: median(rs.map(x => x.median)), runMins: rs.map(x => x.min) }
    if (r.pairedRef) {
      const refKey = key({ ...r, ...r.pairedRef })
      const rels = [], anchors = []
      for (const m of maps) {
        const e = m.get(key(r)), ref = m.get(refKey)
        if (e?.paired != null && ref?.paired != null) { rels.push(e.paired / ref.paired); anchors.push(ref.paired) }
      }
      if (rels.length) Object.assign(out, { paired: median(rels) * median(anchors), rel: median(rels), runRel: rels })
    }
    return out
  })
  results.meta.aggregatedRuns = all.length
  results.meta.aggregation = 'per-cell median of per-run paired ratios'
}

const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
const key = r => [r.format, r.library, r.variant, r.source, r.size].join('|')

let results
try {
  const all = []
  for (let i = 0; i < RUNS; i++) all.push(await benchOnce(i))
  results = all[0]
  if (RUNS > 1) aggregate(all, results)
} catch (e) {
  console.error(e.message)
  server.close()
  process.exit(1)
}

const OUT = process.env.OUT || 'results.json' // OUT=… writes elsewhere (e.g. a scratch run)
await writeFile(resolve(ROOT, OUT), JSON.stringify(results, null, 2))
console.log(`\nwrote ${OUT} —`, results.runs.length, 'speed rows' + (RUNS > 1 ? `, aggregated over ${RUNS} runs` : ''))
server.close()
