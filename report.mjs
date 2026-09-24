// Turns results.json into the generated blocks of README.md for gputex vs spark:
// the SUMMARY headline matrix and the RESULTS per-texture tables, each spliced
// between its <!-- NAME:START/END --> markers.
// node report.mjs
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
const EVEN = '⚪️ even' // within TIE of each other
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
const TIE = 1.03 // within 3% → a tie, not a win
const strong = (cell, r) => (r > 1.5 ? `**${cell}**` : cell) // bold decisive wins (>1.5×)
// Winner cell for a speed pair (lower time wins). Ratio is always ≥ 1.
const speedCell = (g, k) => {
  if (!g || !k || g.error || k.error) return '—'
  const ratio = t(k) / t(g)
  const r = ratio >= 1 ? ratio : 1 / ratio
  return r < TIE ? EVEN : strong(`${ratio >= 1 ? G : S} ${rx(r)}`, r)
}
// Winner cell for a quality pair (higher PSNR wins). Ratio = loser MSE / winner MSE.
const qualCell = (g, k) => {
  if (!g || g.psnr == null || !k || k.psnr == null) return 'n/a'
  const ratio = Math.pow(10, Math.abs(g.psnr - k.psnr) / 10)
  return ratio < TIE ? EVEN : strong(`${g.psnr >= k.psnr ? G : S} ${ratio.toFixed(2)}×`, ratio)
}

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
// Every row name carries its size (1K/2K/4K, or the pixel width below 1K):
// the AmbientCG names already do, the rest get it appended ("packed 1024" → "packed 1K").
const sizeLabel = s => (s >= 1024 ? `${s / 1024}K` : `${s}`)
const dispName = t => {
  const n = t.name === ALPHA ? 'alpha card' : t.name
  return /\b\d+K\b/.test(n) ? n : `${n.replace(/ \d+$/, '')} ${sizeLabel(t.size)}`
}
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
  return r < TIE ? EVEN : strong(`${m >= 1 ? G : S} ${rx(r)}`, r)
}
// median PSNR gap (gputex − spark, in dB), shown as ×-less-error like the rest
const aggQual = f => {
  const ds = []
  for (const tx of textures) { if (alphaNA(tx, f)) continue; const g = qm(f, 'gputex', gvar[f], tx.name), k = qm(f, 'spark', svar[f], tx.name); if (g && k && g.psnr != null && k.psnr != null) ds.push(g.psnr - k.psnr) }
  const m = median(ds), ratio = Math.pow(10, Math.abs(m) / 10)
  return ratio < TIE ? EVEN : strong(`${m >= 0 ? G : S} ${ratio.toFixed(2)}×`, ratio)
}
sp(`Median across the ${textures.length - (alphaCard ? 1 : 0)}-texture suite. ${G} gputex ahead · ${S} spark ahead · ${EVEN} = within ${Math.round((TIE - 1) * 100)}%.\n`)
sp('| format | Speed | Quality |')
sp('|---|---|---|')
for (const f of fmts) sp(`| **${fmtLabel(f)}** | ${aggSpeed(f)} | ${aggQual(f)} |`)

// ===================== PER-TEXTURE SPEED ================================ //
p('### Speed\n')
p('How many times faster the winner encodes.\n')
p('| texture | ' + fmts.map(fmtLabel).join(' | ') + ' |')
p('|---|' + '---|'.repeat(fmts.length))
for (const tex of textures) {
  const cells = fmts.map(f => alphaNA(tex, f) ? 'N/A' : speedCell(run(f, 'gputex', tex.name, gvar[f], tex.size), run(f, 'spark', tex.name, svar[f], tex.size)))
  p(`| ${dispName(tex)} | ` + cells.join(' | ') + ' |')
}
p('')

// ===================== PER-TEXTURE QUALITY ============================== //
p('### Quality\n')
p('How many times more error (MSE) the loser has.\n')
p('| texture | ' + fmts.map(fmtLabel).join(' | ') + ' |')
p('|---|' + '---|'.repeat(fmts.length))
for (const tex of textures) {
  const cells = fmts.map(f => alphaNA(tex, f) ? 'N/A' : qualCell(qm(f, 'gputex', gvar[f], tex.name), qm(f, 'spark', svar[f], tex.name)))
  p(`| ${dispName(tex)} | ` + cells.join(' | ') + ' |')
}
p('')

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

// Splice the generated blocks into README.md: SUMMARY (headline matrix) and
// RESULTS (per-texture tables).
const README = ROOT + 'README.md'
const splice = (text, name, content) => {
  const s = `<!-- ${name}:START -->`, e = `<!-- ${name}:END -->`
  const a = text.indexOf(s), b = text.indexOf(e)
  if (a === -1 || b === -1) throw new Error(`README.md is missing the ${name} markers`)
  return text.slice(0, a + s.length) + '\n' + content + text.slice(b)
}
let readme = await readFile(README, 'utf8')
readme = splice(readme, 'SUMMARY', sm)
readme = splice(readme, 'RESULTS', md)
await writeFile(README, readme)
console.log('updated README.md —', runs.length, 'speed rows,', quality.metrics.length, 'quality rows')
