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
// Whether a file's header rules out transparency, by gputex's rule for picking
// its opaque-source ASTC kernel (imageHeaderIsOpaque): JPEG, or PNG colour
// type 0/2/3 with no tRNS chunk before the first IDAT. RGBA PNGs say no even
// when every pixel is opaque.
async function fileOpaque(path) {
  const b = await readFile(path)
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true
  if (b.length < 33 || b.toString('latin1', 1, 4) !== 'PNG' || b.toString('latin1', 12, 16) !== 'IHDR') return false
  if (![0, 2, 3].includes(b[25])) return false
  for (let off = 8; off + 8 <= b.length; off += 12 + b.readUInt32BE(off)) {
    const type = b.toString('latin1', off + 4, off + 8)
    if (type === 'tRNS') return false
    if (type === 'IDAT') return true
  }
  return false
}
async function buildManifest() {
  const dir = join(ROOT, 'textures')
  let files = []
  try { files = await walk(dir) } catch { return [] }
  const entries = await Promise.all(files.map(async f => ({
    url: relative(ROOT, f).split(/[/\\]/).join('/'),
    name: niceName(relative(dir, f).split(/[/\\]/).join('/')),
    fileOpaque: await fileOpaque(f),
  })))
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}
let manifest = await buildManifest()
if (process.env.TEX_MATCH) manifest = manifest.filter(t => new RegExp(process.env.TEX_MATCH).test(t.name)) // e.g. TEX_MATCH=4K
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

let hasPrev = false, prevFiles = []
try { prevFiles = (await readdir(join(ROOT, 'shaders', 'gputex-prev'))).filter(f => f.endsWith('.wgsl')); hasPrev = prevFiles.length > 0 } catch {}
if (process.env.PREV === '0') hasPrev = false
const RUNS = Math.max(1, Math.floor(+(process.env.RUNS || 1)))

async function benchOnce(runIndex) {
  // FORMAT=ETC2 (or a comma list) runs only those formats — bench.js reads ?format=…
  const q = new URLSearchParams()
  if (process.env.FORMAT) q.set('format', process.env.FORMAT)
  if (hasPrev) { q.set('prev', '1'); q.set('prevfiles', prevFiles.join(',')) }
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

// MERGE=1 with FORMAT=…: replace only the measured formats' rows in the
// existing OUT file and keep every other format's rows as they are — for
// adding a format, or reporting one format's shader update, without
// re-measuring the rest. The previous run's meta is kept under meta.mergedFrom.
if (process.env.MERGE === '1') {
  if (!process.env.FORMAT) { console.error('MERGE=1 needs FORMAT=…'); server.close(); process.exit(1) }
  const formats = new Set(results.runs.map(r => r.format).concat(results.quality?.metrics?.map(m => m.format) ?? []))
  const prev = JSON.parse(await readFile(resolve(ROOT, OUT), 'utf8'))
  const keep = r => !formats.has(r.format)
  results.runs = [...prev.runs.filter(keep), ...results.runs]
  if (prev.quality && results.quality) {
    const names = new Set(results.quality.sources.map(s => s.name))
    results.quality = {
      ...results.quality,
      sources: [...results.quality.sources, ...prev.quality.sources.filter(s => !names.has(s.name))],
      metrics: [...prev.quality.metrics.filter(keep), ...results.quality.metrics],
    }
  }
  results.meta = { ...results.meta, sizes: prev.meta.sizes, mergedFormats: [...formats], mergedFrom: { ...prev.meta, mergedFrom: undefined } }
  console.log(`merging ${[...formats].join(', ')} into ${OUT} (other formats kept from the previous run)`)
}
await writeFile(resolve(ROOT, OUT), JSON.stringify(results, null, 2))
console.log(`\nwrote ${OUT} —`, results.runs.length, 'speed rows' + (RUNS > 1 ? `, aggregated over ${RUNS} runs` : ''))
server.close()
