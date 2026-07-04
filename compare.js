// compare.js — local visual quality A/B between gputex and spark.
//
// For the picked texture + format it encodes BOTH libraries live on the GPU
// (reusing the exact bind layouts from bench.js), decodes each with the same
// reference decoder (refcodec.js / bc7full.js / hardware ASTC), and shows them
// on one plane you flip between. The sidebar pulls the committed speed/quality
// numbers for that texture from results.json. Spark shaders are read locally and
// are NOT committed — this page is for local inspection only.

import { decodeBC1Block, decodeBC5Block, decodeETC2Block } from './refcodec.js'
import { decodeBC7Full } from './bc7full.js'

// gputex uses bind 'gputex' (0=tex,1=dst,2=params,[3=sampler]); spark uses bind
// 'spark' (0=tex,1=sampler,2=dst). Same as bench.js's headline pairing.
const FORMATS = [
  { key: 'BC1', label: 'BC1', bpb: 8, gvar: 'rgb', svar: 'rgb',
    g: { file: 'shaders/gputex/bc1_fast_f16.wgsl', entry: 'encode', wg: [8, 8], bind: 'gputex' },
    s: { file: 'shaders/spark/spark_bc1_rgb.wgsl', entry: 'main', wg: [16, 8], bind: 'spark' } },
  { key: 'BC5', label: 'BC5', bpb: 16, gvar: 'rg', svar: 'rg',
    g: { file: 'shaders/gputex/bc5_fast_f16.wgsl', entry: 'encode', wg: [8, 8], bind: 'gputex', sampler: true },
    s: { file: 'shaders/spark/spark_bc5_rg.wgsl', entry: 'main', wg: [16, 8], bind: 'spark' } },
  { key: 'BC7', label: 'BC7', bpb: 16, gvar: 'rgba', svar: 'rgba',
    g: { file: 'shaders/gputex/bc7_fast_f16.wgsl', entry: 'encode', wg: [8, 8], bind: 'gputex' },
    s: { file: 'shaders/spark/spark_bc7_rgba.wgsl', entry: 'main', wg: [16, 8], bind: 'spark' } },
  { key: 'ASTC4x4', label: 'ASTC', bpb: 16, gvar: 'rgba', svar: 'rgba', needsAstc: true,
    g: { file: 'shaders/gputex/astc4x4_fast_f16.wgsl', entry: 'encode', wg: [8, 8], bind: 'gputex' },
    s: { file: 'shaders/spark/spark_astc_rgba.wgsl', entry: 'main', wg: [16, 8], bind: 'spark' } },
  { key: 'ETC2', label: 'ETC2', bpb: 8, gvar: 'rgb', svar: 'rgb',
    g: { file: 'shaders/gputex/etc2.wgsl', entry: 'encode', wg: [8, 8], bind: 'gputex' },
    s: { file: 'shaders/spark/spark_etc2_rgb.wgsl', entry: 'main', wg: [16, 8], bind: 'spark' } },
]

// per-block decoder → {values (interleaved [0,1]), channels}; ASTC uses the GPU.
const BLOCK_DECODE = {
  BC1: b => ({ values: decodeBC1Block(b), channels: 3 }),
  BC5: b => { const { r, g } = decodeBC5Block(b); const v = new Float64Array(32); for (let k = 0; k < 16; k++) { v[k * 2] = r[k]; v[k * 2 + 1] = g[k] } return { values: v, channels: 2 } },
  BC7: b => ({ values: decodeBC7Full(b), channels: 4 }),
  ETC2: b => ({ values: decodeETC2Block(b), channels: 3 }),
}

const $ = id => document.getElementById(id)
const errEl = $('error')
const fail = msg => { errEl.textContent = String(msg); console.error('[compare]', String(msg)) }

let device, sampler, hasAstc = false
let results = null
let manifest = []
let state = { fmt: FORMATS[2], texIdx: 0, lib: 'gputex', pixelated: false, showOriginal: false }
let images = { original: null, gputex: null, spark: null, size: 0 } // ImageData per side
let view = { zoom: 1, x: 0, y: 0, fitZoom: 1 } // canvas transform

// ------------------------------------------------------------------ init ---
async function init() {
  if (!navigator.gpu) return fail('WebGPU not available in this browser.')
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) return fail('No WebGPU adapter.')
  const want = ['shader-f16', 'texture-compression-astc']
  const feats = want.filter(f => adapter.features.has(f))
  if (!feats.includes('shader-f16')) return fail('shader-f16 required (both libraries ship f16 kernels).')
  hasAstc = feats.includes('texture-compression-astc')
  device = await adapter.requestDevice({ requiredFeatures: feats })
  device.lost.then(i => fail('GPU device lost: ' + i.message))
  sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' })

  results = await fetch('results.json').then(r => r.ok ? r.json() : null).catch(() => null)
  manifest = await fetch('textures.json').then(r => r.json()).catch(() => [])
  if (!manifest.length) return fail('textures.json missing — run `npm run bench` once (or `node run.mjs`).')

  buildFormatButtons()
  buildTextureDropdown()
  wireControls()
  await refresh()
}

// -------------------------------------------------------------- ui build ---
function buildFormatButtons() {
  const box = $('formats')
  box.innerHTML = ''
  for (const f of FORMATS) {
    const b = document.createElement('button')
    b.className = 'fmt' + (f === state.fmt ? ' active' : '')
    b.textContent = f.label
    if (f.needsAstc && !hasAstc) { b.disabled = true; b.title = 'texture-compression-astc not supported here' }
    b.onclick = () => { state.fmt = f; buildFormatButtons(); refresh() }
    box.appendChild(b)
  }
}

function buildTextureDropdown() {
  const sel = $('texture')
  sel.innerHTML = ''
  manifest.forEach((t, i) => {
    const o = document.createElement('option'); o.value = i; o.textContent = t.name; sel.appendChild(o)
  })
  sel.value = state.texIdx
  sel.onchange = () => { state.texIdx = +sel.value; refresh() }
}

function wireControls() {
  const toggle = $('libToggle')
  toggle.onclick = () => setLib(state.lib === 'gputex' ? 'spark' : 'gputex')

  $('pixelated').onchange = e => { state.pixelated = e.target.checked; $('view').classList.toggle('pixelated', state.pixelated); draw() }

  const orig = $('origBtn')
  const showOrig = on => { state.showOriginal = on; renderBadge(); draw() }
  orig.onmousedown = () => showOrig(true)
  window.addEventListener('mouseup', () => state.showOriginal && showOrig(false))
  orig.onmouseleave = () => state.showOriginal && showOrig(false)
  // O key holds original too
  window.addEventListener('keydown', e => { if (e.key === 'o' && !e.repeat) showOrig(true) })
  window.addEventListener('keyup', e => { if (e.key === 'o') showOrig(false) })
  // Space flips gputex/spark
  window.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle.onclick() } })

  $('reset').onclick = () => { fitView(); draw() }
  wirePanZoom()
}

function setLib(lib) {
  state.lib = lib
  const t = $('libToggle')
  t.dataset.lib = lib
  t.innerHTML = lib === 'gputex'
    ? 'gputex<small>click to compare spark</small>'
    : 'spark<small>click to compare gputex</small>'
  renderBadge(); draw()
}

function renderBadge() {
  const which = state.showOriginal ? 'original' : state.lib
  const badge = $('badge'); badge.dataset.lib = which; badge.textContent = which
}

// --------------------------------------------------------------- refresh ---
async function refresh() {
  errEl.textContent = ''
  const f = state.fmt, tex = manifest[state.texIdx]
  $('hud').textContent = 'encoding…'
  try {
    const src = await loadImage(tex.url)                 // {pixels, size, canvas}
    const srcView = uploadTexture(src)
    const gBytes = await encode(f.g, f.bpb, srcView, src.size)
    const sBytes = await encode(f.s, f.bpb, srcView, src.size)
    images.size = src.size
    images.original = new ImageData(new Uint8ClampedArray(src.pixels), src.size, src.size)
    images.gputex = await decodeImage(f, gBytes, src.size)
    images.spark = await decodeImage(f, sBytes, src.size)
    fitView()
    renderBadge(); draw()
    renderBench(tex, src.size)
    renderLive(f, src)
    console.log(`[compare] ready — ${f.label} ${tex.name} ${src.size}² (${$('liveNote').textContent})`)
  } catch (e) {
    // Most common failure here is a missing local spark shader (404).
    fail(/spark_/.test(String(e)) || /404|not found/i.test(String(e))
      ? `Could not load a shader for ${f.label}. Spark shaders are local-only — place them in shaders/spark/ (see shaders/spark/README.md).\n\n${e}`
      : e)
    $('hud').textContent = ''
  }
}

// ---------------------------------------------------------- gpu encode -----
const shaderCache = new Map()
async function loadShader(file) {
  if (shaderCache.has(file)) return shaderCache.get(file)
  const res = await fetch(file)
  if (!res.ok) throw new Error(`${file} (${res.status})`)
  const code = await res.text()
  shaderCache.set(file, code); return code
}

function uploadTexture(src) {
  const tex = device.createTexture({
    size: [src.size, src.size, 1], format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  })
  device.queue.copyExternalImageToTexture({ source: src.canvas }, { texture: tex }, { width: src.size, height: src.size })
  return tex.createView()
}

async function encode(e, bpb, srcView, size) {
  const bx = size >> 2, by = size >> 2, outBytes = bx * by * bpb
  const module = device.createShaderModule({ code: await loadShader(e.file) })
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: e.entry } })
  const dst = device.createBuffer({ size: outBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })
  let bind
  if (e.bind === 'gputex') {
    const params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    device.queue.writeBuffer(params, 0, new Uint32Array([bx, by, size, size]))
    bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: srcView }, { binding: 1, resource: { buffer: dst } }, { binding: 2, resource: { buffer: params } },
      ...(e.sampler ? [{ binding: 3, resource: sampler }] : [])] })
  } else {
    bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: srcView }, { binding: 1, resource: sampler }, { binding: 2, resource: { buffer: dst } }] })
  }
  const enc = device.createCommandEncoder()
  const pass = enc.beginComputePass()
  pass.setPipeline(pipeline); pass.setBindGroup(0, bind)
  pass.dispatchWorkgroups(Math.ceil(bx / e.wg[0]), Math.ceil(by / e.wg[1]), 1)
  pass.end()
  const staging = device.createBuffer({ size: outBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })
  enc.copyBufferToBuffer(dst, 0, staging, 0, outBytes)
  device.queue.submit([enc.finish()])
  await staging.mapAsync(GPUMapMode.READ)
  const bytes = new Uint8Array(staging.getMappedRange().slice(0))
  staging.unmap(); staging.destroy(); dst.destroy()
  return bytes
}

// ---------------------------------------------------------- decode ---------
async function decodeImage(fmt, bytes, size) {
  if (fmt.key === 'ASTC4x4') return astcToImage(bytes, size)
  const decode = BLOCK_DECODE[fmt.key]
  const bx = size >> 2, out = new Uint8ClampedArray(size * size * 4), nb = (size >> 2) * (size >> 2)
  for (let b = 0; b < nb; b++) {
    const { values, channels } = decode(bytes.subarray(b * fmt.bpb, b * fmt.bpb + fmt.bpb))
    const bX = (b % bx) * 4, bY = ((b / bx) | 0) * 4
    for (let i = 0; i < 16; i++) {
      const o = ((bY + (i >> 2)) * size + bX + (i & 3)) * 4
      if (channels === 2) { // BC5: reconstruct the normal so it isn't flat blue-less
        const x = values[i * 2] * 2 - 1, y = values[i * 2 + 1] * 2 - 1
        const z = Math.sqrt(Math.max(0, 1 - x * x - y * y))
        out[o] = (x * .5 + .5) * 255; out[o + 1] = (y * .5 + .5) * 255; out[o + 2] = (z * .5 + .5) * 255; out[o + 3] = 255
      } else {
        out[o] = values[i * channels] * 255; out[o + 1] = values[i * channels + 1] * 255
        out[o + 2] = values[i * channels + 2] * 255; out[o + 3] = channels === 4 ? values[i * channels + 3] * 255 : 255
      }
    }
  }
  return new ImageData(out, size, size)
}

// ASTC has no CPU reference for spark's config → hardware-decode via a sample pass.
async function astcToImage(bytes, size) {
  const bx = size >> 2
  const tex = device.createTexture({ size: [size, size, 1], format: 'astc-4x4-unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST })
  device.queue.writeTexture({ texture: tex }, bytes, { bytesPerRow: bx * 16, rowsPerImage: size >> 2 }, { width: size, height: size })
  const nearest = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' })
  const module = device.createShaderModule({ code: `
    @group(0) @binding(0) var t: texture_2d<f32>; @group(0) @binding(1) var s: sampler;
    @group(0) @binding(2) var<storage, read_write> o: array<u32>; @group(0) @binding(3) var<uniform> d: vec2<u32>;
    @compute @workgroup_size(8,8,1) fn main(@builtin(global_invocation_id) g: vec3<u32>) {
      if (g.x>=d.x||g.y>=d.y){return;}
      let c=textureSampleLevel(t,s,(vec2<f32>(f32(g.x),f32(g.y))+0.5)/vec2<f32>(f32(d.x),f32(d.y)),0.0);
      o[g.y*d.x+g.x]=u32(clamp(c.r,0.,1.)*255.+.5)|(u32(clamp(c.g,0.,1.)*255.+.5)<<8u)|(u32(clamp(c.b,0.,1.)*255.+.5)<<16u)|(u32(clamp(c.a,0.,1.)*255.+.5)<<24u);
    }` })
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } })
  const outBuf = device.createBuffer({ size: size * size * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })
  const dim = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
  device.queue.writeBuffer(dim, 0, new Uint32Array([size, size]))
  const bg = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: tex.createView() }, { binding: 1, resource: nearest }, { binding: 2, resource: { buffer: outBuf } }, { binding: 3, resource: { buffer: dim } }] })
  const enc = device.createCommandEncoder(); const pass = enc.beginComputePass()
  pass.setPipeline(pipeline); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(Math.ceil(size / 8), Math.ceil(size / 8), 1); pass.end()
  const staging = device.createBuffer({ size: size * size * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })
  enc.copyBufferToBuffer(outBuf, 0, staging, 0, size * size * 4)
  device.queue.submit([enc.finish()])
  await staging.mapAsync(GPUMapMode.READ)
  const out = new Uint8ClampedArray(staging.getMappedRange().slice(0))
  staging.unmap(); staging.destroy(); outBuf.destroy(); tex.destroy()
  return new ImageData(out, size, size)
}

// ---------------------------------------------------------- image load -----
async function loadImage(url) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  const size = bmp.width
  if (bmp.width !== bmp.height || size % 4) throw new Error(`${url}: need a square, multiple-of-4 image`)
  const cv = new OffscreenCanvas(size, size)
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bmp, 0, 0)
  const pixels = ctx.getImageData(0, 0, size, size).data
  bmp.close?.()
  return { size, canvas: cv, pixels }
}

// ------------------------------------------------------------ draw ---------
const canvas = $('view')
const cctx = canvas.getContext('2d')
function currentImage() { return state.showOriginal ? images.original : images[state.lib] }

function fitView() {
  const s = images.size || 1, st = $('stage')
  view.fitZoom = Math.min(st.clientWidth / s, st.clientHeight / s) * 0.92
  view.zoom = view.fitZoom
  view.x = (st.clientWidth - s * view.zoom) / 2
  view.y = (st.clientHeight - s * view.zoom) / 2
}

function draw() {
  const img = currentImage()
  if (!img) return
  const s = images.size
  if (canvas.width !== s) { canvas.width = s; canvas.height = s }
  cctx.putImageData(img, 0, 0)
  canvas.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.zoom})`
  $('hud').textContent = `${s}×${s} · zoom ${(view.zoom / view.fitZoom).toFixed(2)}× · ${state.fmt.label}`
}

function wirePanZoom() {
  const st = $('stage')
  let dragging = false, px = 0, py = 0
  st.addEventListener('mousedown', e => { if (e.button !== 0) return; dragging = true; px = e.clientX; py = e.clientY; st.classList.add('grabbing') })
  window.addEventListener('mousemove', e => { if (!dragging) return; view.x += e.clientX - px; view.y += e.clientY - py; px = e.clientX; py = e.clientY; draw() })
  window.addEventListener('mouseup', () => { dragging = false; st.classList.remove('grabbing') })
  st.addEventListener('wheel', e => {
    e.preventDefault()
    const r = st.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
    const k = Math.exp(-e.deltaY * 0.0015), nz = Math.min(64 * view.fitZoom, Math.max(view.fitZoom * 0.5, view.zoom * k))
    // zoom about the cursor
    view.x = mx - (mx - view.x) * (nz / view.zoom)
    view.y = my - (my - view.y) * (nz / view.zoom)
    view.zoom = nz; draw()
  }, { passive: false })
  window.addEventListener('resize', () => { fitView(); draw() })
}

// ----------------------------------------------------- benchmark panel -----
const psnrChannels = { BC1: [0, 1, 2], BC5: [0, 1], BC7: [0, 1, 2], ASTC4x4: [0, 1, 2], ETC2: [0, 1, 2] }

function renderBench(tex, size) {
  const f = state.fmt, head = $('benchHead'), body = $('benchBody')
  head.textContent = `${f.label} · ${tex.name} · ${size}²`
  body.innerHTML = ''
  if (!results) { body.innerHTML = row('results.json', 'not loaded', ''); return }
  const run = (lib, v) => results.runs.find(r => r.format === f.key && r.library === lib && r.source === tex.name && r.variant === v && r.size === size)
  const qm = (lib, v) => results.quality.metrics.find(m => m.format === f.key && m.library === lib && m.variant === v && m.source === tex.name)
  const g = run('gputex', f.gvar), s = run('spark', f.svar)
  const qg = qm('gputex', f.gvar), qs = qm('spark', f.svar)

  if (g && s) {
    const ratio = s.min / g.min, faster = ratio >= 1 ? 'gputex' : 'spark', rr = ratio >= 1 ? ratio : 1 / ratio
    body.innerHTML += row('gputex', g.min.toFixed(4) + ' ms', '')
    body.innerHTML += row('spark', s.min.toFixed(4) + ' ms', '')
    body.innerHTML += row('speed', `${rr < 1.1 ? 'tie' : rr.toFixed(2) + '×'}`, rr < 1.1 ? 't' : (faster === 'gputex' ? 'g' : 's'))
  } else body.innerHTML += row('speed', 'n/a', '')

  if (qg && qs && qg.psnr != null && qs.psnr != null) {
    const d = qg.psnr - qs.psnr, w = Math.abs(d) < 0.1 ? 't' : d > 0 ? 'g' : 's'
    body.innerHTML += row('gputex PSNR', qg.psnr.toFixed(2) + ' dB', '')
    body.innerHTML += row('spark PSNR', qs.psnr.toFixed(2) + ' dB', '')
    body.innerHTML += row('quality', (d >= 0 ? '+' : '') + d.toFixed(2) + ' dB', w)
  } else body.innerHTML += row('quality', 'n/a', '')
}

function row(k, v, win) {
  const cls = win === 'g' ? 'win-g' : win === 's' ? 'win-s' : win === 't' ? 'win-t' : ''
  return `<tr><td class="k">${k}</td><td class="v ${cls}">${v}</td></tr>`
}

// live PSNR of exactly what's on screen (from this browser's encode)
function renderLive(f, src) {
  const ch = psnrChannels[f.key]
  const p = dec => livePsnr(src.pixels, dec.data, src.size, ch)
  const g = p(images.gputex), s = p(images.spark)
  $('liveNote').textContent = `live encode PSNR — gputex ${g.toFixed(2)} dB · spark ${s.toFixed(2)} dB`
}
function livePsnr(ref, dec, size, ch) {
  let se = 0, n = 0
  for (let i = 0; i < size * size; i++) for (const c of ch) { const d = ref[i * 4 + c] - dec[i * 4 + c]; se += d * d; n++ }
  const mse = se / n
  return mse === 0 ? 99 : 10 * Math.log10(255 * 255 / mse)
}

init().catch(fail)
