// Turns results.json into the generated blocks of README.md for gputex vs spark:
// the SUMMARY headline matrix, the MODES low-vs-high tables, the RESULTS
// per-texture tables, and the ENV environment block, each spliced between its
// <!-- NAME:START/END --> markers. node report.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const { meta, runs, quality } = JSON.parse(await readFile(ROOT + 'results.json', 'utf8'))

const sizes = meta.sizes
const fmts = ['BC1', 'BC5', 'BC7', 'ASTC4x4', 'ETC2']
const fmtLabel = f => (f === 'ASTC4x4' ? 'ASTC' : f)
const run = (format, lib, source, variant, size) =>
  runs.find(r => r.format === format && r.library === lib && r.source === source && r.variant === variant && r.size === size)

// gputex always encodes RGBA; the headline pairing is gputex vs spark's matched
// variant. gputex/spark use the same variant key per format here.
const gvar = { BC1: 'rgb', BC5: 'rg', BC7: 'rgba', ASTC4x4: 'rgba', ETC2: 'rgb' }
const svar = { BC1: 'rgb', BC5: 'rg', BC7: 'rgba', ASTC4x4: 'rgba', ETC2: 'rgb' }

const G = '🟢', S = '⚡️' // winner emojis: gputex / spark
// Reported speed is the PAIRED time (bench.js): the median per-round ratio to
// the cell's headline gputex entry, anchored to that entry's min (peak-clock)
// time. Ratios within a texture × format cell are therefore medians of
// interleaved paired ratios, immune to the GPU clock swings that make separate
// per-entry mins flip. Older results without it fall back to the min.
const t = r => r.paired ?? r.min
let md = ''
const p = s => (md += s + '\n')
const fx = (r, d = 4) => (r == null ? '—' : r.error ? 'ERR' : t(r).toFixed(d))
const tp = r => (r == null || r.error ? '—' : (r.mpix / t(r)).toFixed(1))
const rx = r => (r >= 10 ? r.toFixed(0) : r.toFixed(2)) + '×' // speed ratio
const TIE = 1.05 // within 5% → a tie, not a win
const strong = (cell, r) => (r > 1.5 ? `**${cell}**` : cell) // bold decisive wins (>1.5×)
// Winner cell for a speed pair (lower time wins). Ratio is always ≥ 1.
const speedCell = (g, k) => {
  if (!g || !k || g.error || k.error) return '—'
  const ratio = t(k) / t(g)
  const r = ratio >= 1 ? ratio : 1 / ratio
  return r < TIE ? 'tie' : strong(`${ratio >= 1 ? G : S} ${rx(r)}`, r)
}
// Winner cell for a quality pair (higher PSNR wins). Ratio = loser MSE / winner MSE.
const qualCell = (g, k) => {
  if (!g || g.psnr == null || !k || k.psnr == null) return 'n/a'
  const ratio = Math.pow(10, Math.abs(g.psnr - k.psnr) / 10)
  return ratio < TIE ? 'tie' : strong(`${g.psnr >= k.psnr ? G : S} ${ratio.toFixed(2)}×`, ratio)
}

// Environment block → its own ENV markers (near the foot of the README).
let env = ''
const ep = s => (env += s + '\n')
ep('## Environment\n')
ep('```')
ep('GPU:        ' + JSON.stringify(meta.gpu))
ep('features:   ' + meta.features.join(', '))
ep('shader-f16: ' + meta.hasF16 + (meta.hasF16 ? ' (both libraries run f16 kernels)' : ' (f16 downgraded to f32)'))
ep('timing:     ' + (meta.interleaved ? 'median paired ratio over ' : 'min of ') + meta.iters + ' batched samples (+' + meta.warmup + ' warmup) per cell' +
  (meta.aggregatedRuns ? `, median across ${meta.aggregatedRuns} runs` : ''))
ep('            each sample = many back-to-back dispatches in one timestamped pass (GPU kept saturated' +
  (meta.batchTargetMs ? `, ~${meta.batchTargetMs} ms` : '') + ')')
if (meta.interleaved) ep('            the libraries\' samples interleaved per texture × format, random order + washout each round')
ep('quantized:  ' + meta.timestampQuantizationDetected)
ep('```\n')

const qm = (format, lib, variant, source) =>
  quality.metrics.find(m => m.format === format && m.library === lib && m.variant === variant && m.source === source)

// Per-texture rows: the real textures (grouped by material/map then size), plus
// the procedural alpha card as one 512² row right after the standalone normal
// map. The card carries 8-bit alpha, so BC1 (1-bit) and BC5 (RG-only) can't use
// it as an alpha test → those cells are N/A and the aggregate skips them.
const texBase = n => n.replace(/\b\d+K\b/, '').replace(/packed \d+/, 'packed').replace(/\s+/g, ' ').trim()
const ALPHA = 'synthetic'
const textures = quality.sources.filter(s => s.name !== ALPHA)
  .sort((a, b) => texBase(a.name).localeCompare(texBase(b.name)) || a.size - b.size)
const alphaCard = quality.sources.find(s => s.name === ALPHA)
if (alphaCard) {
  const ni = textures.findIndex(t => t.name === 'normal')
  textures.splice(ni >= 0 ? ni + 1 : textures.length, 0, alphaCard)
}
const dispName = t => (t.name === ALPHA ? 'alpha card' : t.name)
const alphaNA = (t, f) => t.name === ALPHA && (f === 'BC1' || f === 'BC5' || f === 'ETC2')

// ===================== SUMMARY (aggregate matrix) ====================== //
// One cell per (format, metric): the MEDIAN result across the 34 real textures,
// with a single winner emoji so it reads at a glance. Generated into the TL;DR's
// <!-- SUMMARY --> markers so it can never drift from the data.
let sm = ''
const sp = x => (sm += x + '\n')
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN }
// median encode-time ratio (spark ÷ gputex; >1 → gputex faster)
const aggSpeed = f => {
  const rs = []
  for (const tx of textures) { if (alphaNA(tx, f)) continue; const g = run(f, 'gputex', tx.name, gvar[f], tx.size), k = run(f, 'spark', tx.name, svar[f], tx.size); if (g && k && !g.error && !k.error) rs.push(t(k) / t(g)) }
  const m = median(rs), r = m >= 1 ? m : 1 / m
  return r < TIE ? 'tie' : strong(`${m >= 1 ? G : S} ${rx(r)}`, r)
}
// median PSNR gap (gputex − spark, in dB), shown as ×-less-error like the rest
const aggQual = f => {
  const ds = []
  for (const tx of textures) { if (alphaNA(tx, f)) continue; const g = qm(f, 'gputex', gvar[f], tx.name), k = qm(f, 'spark', svar[f], tx.name); if (g && k && g.psnr != null && k.psnr != null) ds.push(g.psnr - k.psnr) }
  const m = median(ds), ratio = Math.pow(10, Math.abs(m) / 10)
  return ratio < TIE ? 'tie' : strong(`${m >= 0 ? G : S} ${ratio.toFixed(2)}×`, ratio)
}
sp('Median across the suite (34 textures + a procedural alpha card; the card is N/A for BC1/BC5)\n\n🟢 gputex ahead · ⚡️ spark ahead · tie (within 5%).\n\nSpeed = encode-time ratio; quality = PSNR gap (as ×-less-error).\n\n**Bold** = decisive (>1.5×).\n')
sp('| format | Speed | Quality |')
sp('|---|---|---|')
for (const f of fmts) sp(`| **${fmtLabel(f)}** | ${aggSpeed(f)} | ${aggQual(f)} |`)
sp('')
sp('Results vary by content and resolution: BC1\'s speed margin grows with resolution, spark leads BC7 quality on normal maps, ASTC quality gaps are largest on grayscale, and ETC2 speed splits by content (spark ahead on grayscale maps, gputex on colour / normal).')

// ============ LOW vs HIGH quality mode (within each library) ============= //
// The "prefer low quality" tradeoff: both libraries drop from a high-quality
// format (BC7 desktop / ASTC mobile, 8 bpp) to a low-quality one (BC1 / ETC2,
// 4 bpp) on the SAME split. This compares each library against ITSELF (not the
// rival): memory (always 2× smaller), median encode-time ratio, median PSNR gap.
let mo = ''
const mp = x => (mo += x + '\n')
const medn = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN }
const TRACKS = [
  { name: 'Desktop', low: 'BC1', high: 'BC7', label: 'BC1 (low) vs BC7 (high)' },
  { name: 'Mobile', low: 'ETC2', high: 'ASTC4x4', label: 'ETC2 (low) vs ASTC (high)' },
]
mp('Each library also lets you trade quality for size on the **same** format split — low quality (BC1 desktop / ETC2 mobile, 4 bpp) vs high (BC7 / ASTC, 8 bpp). This is each library measured against **itself**, not the rival. Output is always **2× smaller** in low mode; the encode-speed and quality effects are per-implementation. The **loses less** row calls out which library handles the downgrade better on each axis (smaller speed penalty, smaller PSNR drop):\n')
const speedTxt = r => (r >= 1.05 ? `${r.toFixed(1)}× faster` : r <= 0.95 ? `${(1 / r).toFixed(1)}× slower` : 'about the same')
const modeDrops = [] // every library × track PSNR drop, for the footnote
for (const tr of TRACKS) {
  const st = {}
  for (const lib of ['gputex', 'spark']) {
    const sr = [], qg = []
    for (const tx of textures) {
      if (tx.name === ALPHA) continue // procedural card — BC1/ETC2 are N/A on it elsewhere
      const lo = run(tr.low, lib, tx.name, gvar[tr.low], tx.size), hi = run(tr.high, lib, tx.name, gvar[tr.high], tx.size)
      if (lo && hi && !lo.error && !hi.error) sr.push(t(hi) / t(lo))
      const qlo = qm(tr.low, lib, gvar[tr.low], tx.name), qhi = qm(tr.high, lib, gvar[tr.high], tx.name)
      if (qlo && qhi && qlo.psnr != null && qhi.psnr != null) qg.push(qhi.psnr - qlo.psnr)
    }
    st[lib] = { r: medn(sr), dq: medn(qg) } // r = high÷low (higher = less slowdown); dq = PSNR lost going low
    modeDrops.push(st[lib].dq)
  }
  // "loses less" = smaller downgrade penalty: higher speed ratio, smaller PSNR drop
  const speedWin = st.gputex.r >= st.spark.r ? 'gputex' : 'spark'
  const qualWin = st.gputex.dq <= st.spark.dq ? 'gputex' : 'spark'
  mp(`**${tr.name} — ${tr.label}**\n`)
  mp('| library | memory | encode speed (low vs high) | quality (low vs high) |')
  mp('|---|---|---|---|')
  for (const lib of ['gputex', 'spark']) {
    const sp = lib === speedWin ? `**${speedTxt(st[lib].r)}**` : speedTxt(st[lib].r)
    const q = lib === qualWin ? `**−${st[lib].dq.toFixed(1)} dB**` : `−${st[lib].dq.toFixed(1)} dB`
    mp(`| ${lib} | 2× smaller | ${sp} | ${q} |`)
  }
  const libE = lib => `${lib === 'gputex' ? G : S} **${lib}**`
  mp(`| **loses less →** | tie | ${libE(speedWin)} | ${libE(qualWin)} |`)
  mp('')
}
mp(`Low mode always halves the output size and costs ${Math.min(...modeDrops).toFixed(1)}–${Math.max(...modeDrops).toFixed(1)} dB of PSNR (median per library and track). Whether it encodes faster depends on the implementation — see the speed column. The **loses less** row marks which library gives up less on each axis.`)

// ===================== PER-TEXTURE SPEED ================================ //
p('## ⚡ Speed — per texture (gputex vs spark)\n')
p(`${G} gputex faster · ${S} spark faster · tie = within 5%. Cell = winner + ratio (faster ÷ slower per-encode time).\n`)
p('| texture | size | ' + fmts.map(fmtLabel).join(' | ') + ' |')
p('|---|---|' + '---|'.repeat(fmts.length))
for (const tex of textures) {
  const cells = fmts.map(f => alphaNA(tex, f) ? 'N/A' : speedCell(run(f, 'gputex', tex.name, gvar[f], tex.size), run(f, 'spark', tex.name, svar[f], tex.size)))
  p(`| ${dispName(tex)} | ${tex.size}² | ` + cells.join(' | ') + ' |')
}
p('')

// ===================== PER-TEXTURE QUALITY ============================== //
p('## 🎨 Quality — per texture (gputex vs spark)\n')
p(`${G} gputex higher PSNR · ${S} spark higher · tie = within 5% MSE. Ratio = how much more squared error (MSE) the loser carries = 10^(ΔdB/10).\n`)
p('| texture | size | ' + fmts.map(fmtLabel).join(' | ') + ' |')
p('|---|---|' + '---|'.repeat(fmts.length))
for (const tex of textures) {
  const cells = fmts.map(f => alphaNA(tex, f) ? 'N/A' : qualCell(qm(f, 'gputex', gvar[f], tex.name), qm(f, 'spark', svar[f], tex.name)))
  p(`| ${dispName(tex)} | ${tex.size}² | ` + cells.join(' | ') + ' |')
}
p('')
p('> **BC7** uses `bc7full.js` (modes 4/5/6) to decode both libraries — its mode-4 and mode-6 paths match')
p('> gputex\'s reference decoder bit-for-bit. **ASTC** uses the M3 hardware decoder; **BC1/BC5** gputex\'s reference.\n')

// ---- BC7 mode 4 (opt-in) vs spark -------------------------------------- //
// gputex BC7 is mode 6 by default; both passes ran a mode-4-ON variant (rgba-m4)
// on just the sources that gain most. Same Speed/Quality cells as the tables
// above, but gputex here is the mode-4 encoder.
const m4rows = textures.filter(tx => qm('BC7', 'gputex', 'rgba-m4', tx.name)?.psnr != null)
if (m4rows.length) {
  p('## 🎨 BC7 mode 4 (opt-in) — gputex vs spark on the content that benefits most\n')
  p('gputex BC7 encodes mode 6 by default; `new BC7Encoder({ adaptiveMode4: true })` enables mode 4. On the decorrelated colour / normal / packed content that benefits, mode 4 raises PSNR for roughly 50% more encode time. With mode 4 enabled:\n')
  p('| texture | Speed | Quality |')
  p('|---|---|---|')
  for (const tx of m4rows) {
    const sCell = speedCell(run('BC7', 'gputex', tx.name, 'rgba-m4', tx.size), run('BC7', 'spark', tx.name, svar.BC7, tx.size))
    const qCell = qualCell(qm('BC7', 'gputex', 'rgba-m4', tx.name), qm('BC7', 'spark', svar.BC7, tx.name))
    p(`| ${dispName(tx)} | ${sCell} | ${qCell} |`)
  }
  p('')
}

// ---- gputex vs its previous shaders (console only) --------------------- //
// When the run carried the shaders/gputex-prev/ baseline (library
// 'gputex-prev', timed interleaved with gputex), print how the update moved
// each format — on its own and against spark. Not written to the README.
if (runs.some(r => r.library === 'gputex-prev')) {
  const PREV = 'gputex-prev'
  const out = ['', `gputex vs ${PREV} (same session, interleaved) — medians across the suite`, '']
  out.push('| format | speed prev÷new | new faster / slower / tie | PSNR Δ new−prev [min, max] | vs spark speed: prev → new | vs spark PSNR gap: prev → new |')
  out.push('|---|---|---|---|---|---|')
  const fmtR = m => (m >= 1 ? `${m.toFixed(3)}× faster` : `${(1 / m).toFixed(3)}× slower`)
  for (const f of fmts) {
    const sr = [], dq = [], vsS = { prev: [], cur: [] }, vsQ = { prev: [], cur: [] }
    for (const tx of textures) {
      if (alphaNA(tx, f)) continue
      const g = run(f, 'gputex', tx.name, gvar[f], tx.size), gp = run(f, PREV, tx.name, gvar[f], tx.size), k = run(f, 'spark', tx.name, svar[f], tx.size)
      const ok = r => r && !r.error
      if (ok(g) && ok(gp)) sr.push(t(gp) / t(g))
      if (ok(k) && ok(g) && ok(gp)) { vsS.cur.push(t(k) / t(g)); vsS.prev.push(t(k) / t(gp)) }
      const qg = qm(f, 'gputex', gvar[f], tx.name), qp = qm(f, PREV, gvar[f], tx.name), qk = qm(f, 'spark', svar[f], tx.name)
      if (qg?.psnr != null && qp?.psnr != null) dq.push(qg.psnr - qp.psnr)
      if (qg?.psnr != null && qp?.psnr != null && qk?.psnr != null) { vsQ.cur.push(qg.psnr - qk.psnr); vsQ.prev.push(qp.psnr - qk.psnr) }
    }
    if (!sr.length) continue
    const faster = sr.filter(r => r >= TIE).length, slower = sr.filter(r => r <= 1 / TIE).length
    const dB = x => (x >= 0 ? '+' : '') + x.toFixed(2)
    const q = dq.length ? `${dB(median(dq))} dB [${dB(Math.min(...dq))}, ${dB(Math.max(...dq))}]` : 'n/a'
    const sv = a => { const m = median(a); return m >= 1 ? `${m.toFixed(2)}× faster` : `${(1 / m).toFixed(2)}× slower` }
    out.push(`| ${fmtLabel(f)} | ${fmtR(median(sr))} | ${faster} / ${slower} / ${sr.length - faster - slower} | ${q} | ${sv(vsS.prev)} → ${sv(vsS.cur)} | ${vsQ.cur.length ? `${dB(median(vsQ.prev))} → ${dB(median(vsQ.cur))} dB` : 'n/a'} |`)
  }
  console.log(out.join('\n') + '\n')
}

// Splice the generated blocks into README.md: SUMMARY (headline matrix), MODES
// (low-vs-high tables), RESULTS (per-texture tables) and ENV (environment).
const README = ROOT + 'README.md'
const splice = (text, name, content) => {
  const s = `<!-- ${name}:START -->`, e = `<!-- ${name}:END -->`
  const a = text.indexOf(s), b = text.indexOf(e)
  if (a === -1 || b === -1) throw new Error(`README.md is missing the ${name} markers`)
  return text.slice(0, a + s.length) + '\n' + content + text.slice(b)
}
let readme = await readFile(README, 'utf8')
readme = splice(readme, 'SUMMARY', sm)
readme = splice(readme, 'MODES', mo)
readme = splice(readme, 'RESULTS', md)
readme = splice(readme, 'ENV', env)
await writeFile(README, readme)
console.log('updated README.md —', runs.length, 'speed rows,', quality.metrics.length, 'quality rows')
