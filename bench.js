// Pure WebGPU compute-shader benchmark: gputex vs spark.js encoders.
//
// We do NOT run either library's JavaScript. Instead we load the raw .wgsl
// compute shaders from both projects and drive them through identical
// machinery so the only thing that differs between two timed runs is the
// shader code itself:
//
//   • one shared rgba8unorm source texture (same image, same upload) per size
//   • each shader's own pipeline (layout:'auto', exactly as the library uses)
//   • each shader's own bind group + workgroup dims + thread→block mapping
//   • GPU timestamp queries bracketing ONLY the compute pass
//
// What is measured: pure compute-shader execution time on the GPU. No image
// decode, no upload, no readback, no buffer→texture copy, no JS overhead.
// That is the fairest possible measure of "the shaders' performance".
//
// Quality is then measured with gputex's own CPU reference block decoders
// (refcodec.js, bundled from gputex/testing, MIT) — the same decoders its
// test suite validates the shaders against — applied to BOTH libraries' output
// where the format is standard (BC1, BC5) so the PSNR comparison uses one
// decoder per format instead of hand-rolled ones.

import { decodeBC1Block, decodeBC5Block, decodeBC7Block, decodeASTC4x4Block, decodeETC2Block } from './refcodec.js'
import { decodeBC7Full, bc7SupportedMode } from './bc7full.js'

const SIZES = [256, 512, 1024, 2048, 4096]
const WARMUP = 10      // warmup batches (each batch = many dispatches, see timeBatch)
const ITERS = 25       // timed batches per cell; min reported
const BATCH_TARGET_MS = 2.5 // aim each timed batch at ~this long → GPU stays saturated
const BATCH_MAX = 512  // cap dispatches per batch

// "Analysis" sources (synthetic + packed-materials) run the extra entries — the
// BC7 no-mode1 variant and spark's rgb variants. The rest of the real-texture
// suite runs only the headline gputex-vs-spark pairing, to keep it feasible.
const isAnalysis = name => name === 'synthetic' || name.startsWith('packed')

// BC7 mode 4 is opt-in (the enable_mode4 override, off by default because it
// costs ~50% encode time on decorrelated content). These are the sources that
// gain the most from it — both passes run a mode-4-ON BC7 variant on just these
// to populate the "mode 4 (opt-in)" speed+quality table.
const MODE4_BENCH = new Set([
  'color', 'normal',
  'Rock064 2K Normal', 'Rock064 4K Normal', 'WoodFloor004 4K Normal',
  'packed 512', 'packed 1024',
])

// Format table. Each entry pairs a gputex shader with the closest spark
// shader. gputex always encodes RGBA and runs one shader per format (the
// *_fast_f16.wgsl module the library selects on f16 hardware, as here). spark
// ships separate rgb / rgba variants for BC7 and ASTC; gputex's headline
// pairing is spark's rgba variant, and the rgb variant is an extra data point.
const FORMATS = [
  {
    key: 'BC1',
    bytesPerBlock: 8,
    entries: [
      { lib: 'gputex', variant: 'rgb',  file: 'shaders/gputex/bc1_fast_f16.wgsl', entry: 'encode', wg: [8, 8],  bind: 'gputex' },
      { lib: 'spark',  variant: 'rgb',  file: 'shaders/spark/spark_bc1_rgb.wgsl', entry: 'main',   wg: [16, 8], bind: 'spark' },
    ],
  },
  {
    key: 'BC5',
    bytesPerBlock: 16,
    entries: [
      { lib: 'gputex', variant: 'rg',   file: 'shaders/gputex/bc5_fast_f16.wgsl', entry: 'encode', wg: [8, 8],  bind: 'gputex', sampler: true },
      { lib: 'spark',  variant: 'rg',   file: 'shaders/spark/spark_bc5_rg.wgsl',  entry: 'main',   wg: [16, 8], bind: 'spark' },
    ],
  },
  {
    key: 'BC7',
    bytesPerBlock: 16,
    entries: [
      { lib: 'gputex', variant: 'rgba', file: 'shaders/gputex/bc7_fast_f16.wgsl', entry: 'encode', wg: [8, 8],  bind: 'gputex' },
      // Opt-in mode 4 (enable_mode4 override), timed + scored on just the
      // MODE4_BENCH sources — see the mode4 gating in both passes.
      { lib: 'gputex', variant: 'rgba-m4', file: 'shaders/gputex/bc7_fast_f16.wgsl', entry: 'encode', wg: [8, 8], bind: 'gputex', constants: { enable_mode4: true }, mode4: true },
      { lib: 'spark',  variant: 'rgba', file: 'shaders/spark/spark_bc7_rgba.wgsl', entry: 'main',   wg: [16, 8], bind: 'spark' },
      { lib: 'spark',  variant: 'rgb',  file: 'shaders/spark/spark_bc7_rgb.wgsl',  entry: 'main',   wg: [16, 8], bind: 'spark', extra: true },
    ],
  },
  {
    key: 'ASTC4x4',
    bytesPerBlock: 16,
    entries: [
      { lib: 'gputex', variant: 'rgba', file: 'shaders/gputex/astc4x4_fast_f16.wgsl', entry: 'encode', wg: [8, 8],  bind: 'gputex' },
      { lib: 'spark',  variant: 'rgba', file: 'shaders/spark/spark_astc_rgba.wgsl',  entry: 'main',   wg: [16, 8], bind: 'spark' },
      { lib: 'spark',  variant: 'rgb',  file: 'shaders/spark/spark_astc_rgb.wgsl',   entry: 'main',   wg: [16, 8], bind: 'spark', extra: true },
    ],
  },
  {
    // ETC2 RGB8 (8 bytes/block, no alpha). gputex now ships an f16 module
    // (etc2_fast_f16.wgsl — an exact-value port, byte-identical to its f32);
    // spark's is f16 too. Both write big-endian ETC2 blocks decoded by gputex's
    // reference decoder (decodeETC2Block).
    key: 'ETC2',
    bytesPerBlock: 8,
    entries: [
      { lib: 'gputex', variant: 'rgb', file: 'shaders/gputex/etc2_fast_f16.wgsl', entry: 'encode', wg: [8, 8],  bind: 'gputex' },
      { lib: 'spark',  variant: 'rgb', file: 'shaders/spark/spark_etc2_rgb.wgsl',  entry: 'main',  wg: [16, 8], bind: 'spark' },
    ],
  },
]

// Optional format filter for fast iteration when a change is contained to one
// format: `FORMAT=ETC2 npm run bench` (run.mjs forwards it as ?format=…). Accepts
// a comma list and is case-insensitive; "ASTC" matches "ASTC4x4". No filter = all.
const FORMAT_FILTER = (new URLSearchParams(location.search).get('format') || '')
  .split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
const inFilter = key => FORMAT_FILTER.length === 0 ||
  FORMAT_FILTER.includes(key.toUpperCase()) || (key === 'ASTC4x4' && FORMAT_FILTER.includes('ASTC'))
const ACTIVE_FORMATS = FORMATS.filter(f => inFilter(f.key))

const log = (...a) => {
  console.log(...a)
  const el = document.getElementById('log')
  if (el) { el.textContent += a.join(' ') + '\n'; el.scrollTop = el.scrollHeight }
}

// ---- deterministic procedural test image -------------------------------- //
// Resolution-independent: the same "scene" sampled at each size, so content
// is comparable across sizes and identical for both libraries at a given
// size. Rich in gradients, high-frequency detail and varying alpha to give
// the BC7/ASTC mode selectors realistic, data-dependent work.

function hash2(ix, iy) {
  let h = (ix * 374761393 + iy * 668265263) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = (h * 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function smooth(t) { return t * t * (3 - 2 * t) }
function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const a = hash2(ix, iy), b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1)
  const u = smooth(fx), v = smooth(fy)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

function makeImage(size) {
  const cv = new OffscreenCanvas(size, size)
  const ctx = cv.getContext('2d')
  const img = ctx.createImageData(size, size)
  const data = img.data
  const TAU = Math.PI * 2
  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      // smooth low-frequency colour field
      let r = 0.5 + 0.5 * Math.sin(u * TAU * 3 + v * 2.0)
      let g = 0.5 + 0.5 * Math.sin(v * TAU * 4 + u * 1.3 + 1.0)
      let b = 0.5 + 0.5 * Math.sin((u + v) * TAU * 5 + 2.0)
      // multi-octave high-frequency detail (resolution-independent freq)
      const n =
        valueNoise(u * 64, v * 64) * 0.5 +
        valueNoise(u * 160, v * 160) * 0.3 +
        valueNoise(u * 384, v * 384) * 0.2
      r = r * 0.6 + n * 0.4
      g = g * 0.6 + valueNoise(u * 200 + 11, v * 200 + 7) * 0.4
      b = b * 0.6 + valueNoise(u * 120 + 3, v * 120 + 19) * 0.4
      // sharp edges from a few analytic discs
      const d1 = Math.hypot(u - 0.33, v - 0.4), d2 = Math.hypot(u - 0.7, v - 0.65)
      if (d1 < 0.18) r = 0.9
      if (d2 < 0.12) { g = 0.05; b = 0.95 }
      // varying alpha so RGBA encoders exercise the alpha path
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(u * TAU * 2 + v * TAU * 2))
      const o = (y * size + x) * 4
      data[o] = Math.max(0, Math.min(255, r * 255)) | 0
      data[o + 1] = Math.max(0, Math.min(255, g * 255)) | 0
      data[o + 2] = Math.max(0, Math.min(255, b * 255)) | 0
      data[o + 3] = Math.max(0, Math.min(255, a * 255)) | 0
    }
  }
  ctx.putImageData(img, 0, 0)
  return { canvas: cv, pixels: data } // pixels: Uint8ClampedArray rgba, length size*size*4
}

// ---- stats -------------------------------------------------------------- //
function stats(arr) {
  const s = [...arr].sort((a, b) => a - b)
  const q = p => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]
  const mean = s.reduce((a, b) => a + b, 0) / s.length
  return { min: s[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: s[s.length - 1], mean }
}

// ---- main --------------------------------------------------------------- //
async function runBench() {
  if (!navigator.gpu) throw new Error('WebGPU not available')
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) throw new Error('No WebGPU adapter')

  const want = ['timestamp-query', 'shader-f16', 'texture-compression-astc', 'texture-compression-bc']
  const features = want.filter(f => adapter.features.has(f))
  if (!features.includes('timestamp-query')) {
    throw new Error('timestamp-query feature not available — cannot measure GPU time')
  }
  const hasF16 = features.includes('shader-f16')
  const device = await adapter.requestDevice({ requiredFeatures: features })

  const info = adapter.info || {}
  const meta = {
    ua: navigator.userAgent,
    gpu: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description },
    features,
    hasF16,
    sizes: SIZES,
    warmup: WARMUP,
    iters: ITERS,
  }
  log('GPU:', JSON.stringify(meta.gpu))
  log('features:', features.join(', '), '\n')
  if (FORMAT_FILTER.length) {
    if (!ACTIVE_FORMATS.length) throw new Error(`FORMAT filter "${FORMAT_FILTER.join(',')}" matched no formats (have: ${FORMATS.map(f => f.key).join(', ')})`)
    log('format filter:', ACTIVE_FORMATS.map(f => f.key).join(', '), '(others skipped)\n')
  }

  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' })

  // load + (if needed) downgrade f16 shaders, exactly as spark.js does.
  const shaderCache = new Map()
  async function loadShader(file) {
    if (shaderCache.has(file)) return shaderCache.get(file)
    let code = await (await fetch(file)).text()
    if (!hasF16) {
      code = code
        .replace(/^enable f16;\s*/m, '')
        .replace(/\bf16\b/g, 'f32')
        .replace(/\bvec([234])h\b/g, 'vec$1f')
        .replace(/\bmat([234]x[234])h/g, 'mat$1f')
        .replace(/\b(\d*\.\d+|\d+\.)h\b/g, '$1')
    }
    shaderCache.set(file, code)
    return code
  }

  // timestamp query plumbing
  const querySet = device.createQuerySet({ type: 'timestamp', count: 2 })
  const resolveBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC })
  const readBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })

  // Time `batch` back-to-back dispatches inside ONE compute pass, bracketed by a
  // single timestamp pair, and return the per-dispatch time (total / batch). All
  // dispatches run without any CPU↔GPU sync between them, so the GPU stays
  // saturated and its clock stays boosted for the whole measurement — which is
  // what makes the sub-0.1 ms cells reproducible instead of catching a sagging,
  // ramping clock between synced single dispatches. (The dispatches race on the
  // output buffer, but we never read it for timing.)
  async function timeBatch(pipeline, bindGroup, dx, dy, batch) {
    const enc = device.createCommandEncoder()
    const pass = enc.beginComputePass({
      timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    for (let j = 0; j < batch; j++) pass.dispatchWorkgroups(dx, dy, 1)
    pass.end()
    enc.resolveQuerySet(querySet, 0, 2, resolveBuf, 0)
    enc.copyBufferToBuffer(resolveBuf, 0, readBuf, 0, 16)
    device.queue.submit([enc.finish()])
    await readBuf.mapAsync(GPUMapMode.READ)
    const ts = new BigUint64Array(readBuf.getMappedRange().slice(0))
    readBuf.unmap()
    return Number(ts[1] - ts[0]) / 1e6 / batch // ns -> ms, per dispatch
  }

  // Pick a batch size so each timed pass runs for ~BATCH_TARGET_MS: many
  // dispatches for cheap cells (keeps the GPU busy, amortises timer granularity),
  // few for expensive ones. Rough single-dispatch estimate is fine — it only
  // sets the batch magnitude.
  async function calibrateBatch(pipeline, bindGroup, dx, dy) {
    await timeBatch(pipeline, bindGroup, dx, dy, 1)
    let t = Infinity
    for (let i = 0; i < 4; i++) t = Math.min(t, await timeBatch(pipeline, bindGroup, dx, dy, 1))
    return Math.max(1, Math.min(BATCH_MAX, Math.round(BATCH_TARGET_MS / Math.max(t, 1e-4))))
  }

  const runs = []
  const quantSet = new Set()

  // Real-texture manifest (textures/ scanned by run.mjs into textures.json).
  const manifest = await fetch('textures.json').then(r => r.ok ? r.json() : []).catch(() => [])
  meta.textureCount = manifest.length
  log('textures:', manifest.length, '\n')

  // Speed sources: the synthetic card at every size, plus every real texture at
  // its native size. gputex BC7 is mode 6 by default; its grayscale fast path and
  // spark's adaptive mode-4/6 mix make BC7 timing content-dependent.
  const SPEED_SOURCES = [
    ...SIZES.map(s => ({ name: 'synthetic', size: s })),
    ...manifest.map(t => ({ name: t.name, url: t.url })),
  ]
  for (const job of SPEED_SOURCES) {
    let imgCanvas, size
    try {
      if (job.url) { const s = await loadImageSource(job.url, job.name); imgCanvas = s.canvas; size = s.size }
      else { imgCanvas = makeImage(job.size).canvas; size = job.size }
    } catch (err) { log(`  (skipping speed source ${job.name}: ${err.message})`); continue }
    log(`--- ${job.name} ${size}x${size} ---`)
    const srcTex = device.createTexture({
      label: `src-${job.name}-${size}`,
      size: [size, size, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    })
    device.queue.copyExternalImageToTexture({ source: imgCanvas }, { texture: srcTex }, { width: size, height: size })
    await device.queue.onSubmittedWorkDone()
    const srcView = srcTex.createView()

    const blocksX = size >> 2
    const blocksY = size >> 2
    const blockCount = blocksX * blocksY

    for (const fmt of ACTIVE_FORMATS) {
      const outBytes = blockCount * fmt.bytesPerBlock
      for (const e of fmt.entries) {
        if (e.extra && !isAnalysis(job.name)) continue
        if (e.mode4 && !MODE4_BENCH.has(job.name)) continue // mode-4 variant: only the beneficiaries
        const tag = `${fmt.key}/${e.lib}-${e.variant}`
        try {
          const code = await loadShader(e.file)
          const module = device.createShaderModule({ label: tag, code })
          const ci = await module.getCompilationInfo?.()
          if (ci && ci.messages.some(m => m.type === 'error')) {
            for (const m of ci.messages) if (m.type === 'error') log('  WGSL error', tag, m.message)
            throw new Error('shader compile error')
          }
          const pipeline = device.createComputePipeline({
            label: tag,
            layout: 'auto',
            compute: { module, entryPoint: e.entry, ...(e.constants ? { constants: e.constants } : {}) },
          })

          const dst = device.createBuffer({ label: `${tag}-out`, size: outBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })

          let bindGroup
          if (e.bind === 'gputex') {
            const params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
            device.queue.writeBuffer(params, 0, new Uint32Array([blocksX, blocksY, size, size]))
            bindGroup = device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: srcView },
                { binding: 1, resource: { buffer: dst } },
                { binding: 2, resource: { buffer: params } },
                // BC5's f16 path gathers texels through a sampler (binding 3).
                ...(e.sampler ? [{ binding: 3, resource: sampler }] : []),
              ],
            })
          } else {
            bindGroup = device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: srcView },
                { binding: 1, resource: sampler },
                { binding: 2, resource: { buffer: dst } },
              ],
            })
          }

          const dx = Math.ceil(blocksX / e.wg[0])
          const dy = Math.ceil(blocksY / e.wg[1])

          // Warm the clock to steady-state boost BEFORE calibrating, so the
          // batch size is chosen from a warm (not cold, ramping) estimate —
          // otherwise a cold calibration underestimates and picks a too-small
          // batch that never saturates, making the mid-size mins jump run to run.
          // Time-bounded (~30 ms) so slow 4K cells don't warm up for seconds.
          for (let i = 0, warm = 0; i < 8 && warm < 30; i++) warm += await timeBatch(pipeline, bindGroup, dx, dy, 8) * 8
          const batch = await calibrateBatch(pipeline, bindGroup, dx, dy)
          for (let i = 0; i < WARMUP; i++) await timeBatch(pipeline, bindGroup, dx, dy, batch)
          const samples = []
          for (let i = 0; i < ITERS; i++) samples.push(await timeBatch(pipeline, bindGroup, dx, dy, batch))

          // detect 100us timestamp quantization (would mean flags missing)
          for (const v of samples) if (Math.round(v * 1e3) % 100 !== 0) { /* sub-100us resolution present */ }
          const allQuant = samples.every(v => Math.abs((v * 1e4) - Math.round(v * 1e4) * 1) < 1e-9 && (Math.round(v * 1e6) % 100000 === 0))
          if (allQuant) quantSet.add(tag)

          const st = stats(samples)
          const mpix = (size * size) / 1e6
          runs.push({
            format: fmt.key, library: e.lib, variant: e.variant, source: job.name, size,
            blocks: blockCount, bytesPerBlock: fmt.bytesPerBlock, outBytes,
            workgroup: e.wg, dispatch: [dx, dy], batch,
            ...st, mpix, mpixPerMs: mpix / st.median,
          })
          log(`  ${tag.padEnd(20)} median ${st.median.toFixed(4)} ms  min ${st.min.toFixed(4)}  batch ${batch}  (${(mpix / st.median).toFixed(1)} Mpix/ms)`)

          dst.destroy()
        } catch (err) {
          log('  FAIL', tag, err.message)
          runs.push({ format: fmt.key, library: e.lib, variant: e.variant, source: job.name, size, error: String(err.message || err) })
        }
      }
    }
    srcTex.destroy()
  }

  meta.timestampQuantizationDetected = quantSet.size > 0

  // ---- quality pass (correctness + PSNR / mode analysis) --------------- //
  let quality = null
  try {
    quality = await runQuality({ device, sampler, loadShader, features, manifest })
  } catch (e) {
    log('quality pass failed:', e.message)
    quality = { error: String(e.message || e) }
  }

  const results = { meta, runs, quality }
  window.__BENCH_RESULTS__ = results
  window.__BENCH_DONE__ = true
  log('\nDONE')
  return results
}

// ====================================================================== //
// Quality pass: verify both shaders produce valid output and quantify the
// speed/quality trade-off. Runs at one size (512). Decoders are general
// (handle ANY valid block), so they work on spark's full-format output too.
// ====================================================================== //

const QSIZE = 512

async function encodeBytesOnce(device, sampler, loadShader, e, fmt, srcView, size) {
  const blocksX = size >> 2, blocksY = size >> 2, blockCount = blocksX * blocksY
  const outBytes = blockCount * fmt.bytesPerBlock
  const code = await loadShader(e.file) // same f16→f32 downgrade as the timed pass
  const module = device.createShaderModule({ code })
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module, entryPoint: e.entry, ...(e.constants ? { constants: e.constants } : {}) },
  })
  const dst = device.createBuffer({ size: outBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })

  let bindGroup
  if (e.bind === 'gputex') {
    const params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    device.queue.writeBuffer(params, 0, new Uint32Array([blocksX, blocksY, size, size]))
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: srcView }, { binding: 1, resource: { buffer: dst } }, { binding: 2, resource: { buffer: params } },
        ...(e.sampler ? [{ binding: 3, resource: sampler }] : [])],
    })
  } else {
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: srcView }, { binding: 1, resource: sampler }, { binding: 2, resource: { buffer: dst } }],
    })
  }

  const enc = device.createCommandEncoder()
  const pass = enc.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(Math.ceil(blocksX / e.wg[0]), Math.ceil(blocksY / e.wg[1]), 1)
  pass.end()
  const staging = device.createBuffer({ size: outBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })
  enc.copyBufferToBuffer(dst, 0, staging, 0, outBytes)
  device.queue.submit([enc.finish()])
  await staging.mapAsync(GPUMapMode.READ)
  const bytes = new Uint8Array(staging.getMappedRange().slice(0))
  staging.unmap(); staging.destroy(); dst.destroy()
  return bytes
}

// ---- reference-decoder PSNR (gputex/testing, via refcodec.js) ----------- //
// Each wrapper decodes ONE block to channel-interleaved [0,1] floats, matching
// gputex's own gpuTestSuite `DECODERS`. BC1/BC5 are standard formats, so these
// decode spark's output too; BC7 (mode 6 only) and ASTC (gputex's 0x042/CEM-12
// subset only) decode gputex's output but throw on spark's — the PSNR caller
// catches that and falls back (BC7 mode histogram / ASTC hardware decode).
const REF_DECODE = {
  BC1: b => ({ values: decodeBC1Block(b), channels: 3 }),
  BC5: b => {
    const { r, g } = decodeBC5Block(b)
    const v = new Float64Array(32)
    for (let k = 0; k < 16; k++) { v[k * 2] = r[k]; v[k * 2 + 1] = g[k] }
    return { values: v, channels: 2 }
  },
  // Full BC7 decoder (modes 4/5/6) — decodes BOTH libraries for a real PSNR
  // head-to-head. BC7REF is gputex's own reference decoder (modes 1/4/6), kept
  // for the bit-exact cross-check on gputex's output.
  BC7: b => ({ values: decodeBC7Full(b), channels: 4 }),
  BC7REF: b => ({ values: decodeBC7Block(b), channels: 4 }),
  ASTC4x4: b => ({ values: decodeASTC4x4Block(b), channels: 4 }),
  ETC2: b => ({ values: decodeETC2Block(b), channels: 3 }), // RGB8, decodes both libraries
}

// PSNR (dB) of compressed `bytes` against the source RGBA byte array `ref`,
// decoding block-by-block with a reference decoder and scoring `srcChannels`.
// Throws if the decoder rejects any block (e.g. spark's BC7 mode 4).
function psnrRef(bytes, ref, size, bpb, decode, srcChannels) {
  const bx = size >> 2, by = size >> 2
  let se = 0, n = 0
  for (let b = 0; b < bx * by; b++) {
    const { values, channels } = decode(bytes.subarray(b * bpb, b * bpb + bpb))
    const blockX = (b % bx) * 4, blockY = ((b / bx) | 0) * 4
    for (let i = 0; i < 16; i++) {
      const px = blockX + (i & 3), py = blockY + (i >> 2)
      const ro = (py * size + px) * 4
      for (const c of srcChannels) {
        const d = values[i * channels + c] * 255 - ref[ro + c]
        se += d * d; n++
      }
    }
  }
  if (se === 0) return 99
  return 10 * Math.log10(255 * 255 / (se / n))
}

function bc7ModeHistogram(bytes) {
  const h = new Array(9).fill(0)
  const n = (bytes.length / 16) | 0
  for (let i = 0; i < n; i++) {
    const b = bytes[i * 16]
    let m = 8
    if (b !== 0) { m = 0; while (((b >> m) & 1) === 0) m++ }
    h[m]++
  }
  return h // index 0..7 = mode, 8 = invalid (byte0===0)
}

async function decodeASTC4x4GPU(device, bytes, size) {
  const blocksX = size >> 2
  const tex = device.createTexture({ size: [size, size, 1], format: 'astc-4x4-unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST })
  device.queue.writeTexture({ texture: tex }, bytes, { bytesPerRow: blocksX * 16, rowsPerImage: size >> 2 }, { width: size, height: size })
  const nearest = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' })
  const code = `
    @group(0) @binding(0) var t: texture_2d<f32>;
    @group(0) @binding(1) var s: sampler;
    @group(0) @binding(2) var<storage, read_write> outb: array<u32>;
    @group(0) @binding(3) var<uniform> dim: vec2<u32>;
    @compute @workgroup_size(8,8,1)
    fn main(@builtin(global_invocation_id) g: vec3<u32>) {
      if (g.x >= dim.x || g.y >= dim.y) { return; }
      let uv = (vec2<f32>(f32(g.x), f32(g.y)) + 0.5) / vec2<f32>(f32(dim.x), f32(dim.y));
      let c = textureSampleLevel(t, s, uv, 0.0);
      let r = u32(clamp(c.r,0.0,1.0)*255.0+0.5);
      let gg = u32(clamp(c.g,0.0,1.0)*255.0+0.5);
      let b = u32(clamp(c.b,0.0,1.0)*255.0+0.5);
      let a = u32(clamp(c.a,0.0,1.0)*255.0+0.5);
      outb[g.y*dim.x+g.x] = r | (gg<<8u) | (b<<16u) | (a<<24u);
    }`
  const module = device.createShaderModule({ code })
  const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } })
  const outBuf = device.createBuffer({ size: size * size * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })
  const dim = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
  device.queue.writeBuffer(dim, 0, new Uint32Array([size, size]))
  const bg = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: tex.createView() }, { binding: 1, resource: nearest },
      { binding: 2, resource: { buffer: outBuf } }, { binding: 3, resource: { buffer: dim } },
    ],
  })
  const enc = device.createCommandEncoder()
  const pass = enc.beginComputePass()
  pass.setPipeline(pipeline); pass.setBindGroup(0, bg)
  pass.dispatchWorkgroups(Math.ceil(size / 8), Math.ceil(size / 8), 1)
  pass.end()
  const staging = device.createBuffer({ size: size * size * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })
  enc.copyBufferToBuffer(outBuf, 0, staging, 0, size * size * 4)
  device.queue.submit([enc.finish()])
  await staging.mapAsync(GPUMapMode.READ)
  const out = new Uint8Array(staging.getMappedRange().slice(0))
  staging.unmap(); staging.destroy(); outBuf.destroy(); tex.destroy()
  return out
}

function psnr(ref, dec, size, channels) {
  let se = 0, n = 0
  for (let i = 0; i < size * size; i++) {
    for (const c of channels) { const d = ref[i * 4 + c] - dec[i * 4 + c]; se += d * d; n++ }
  }
  const mse = se / n
  if (mse === 0) return 99
  return 10 * Math.log10(255 * 255 / mse)
}
function distinctBlocks(bytes, bpb) {
  const set = new Set()
  const n = (bytes.length / bpb) | 0
  const step = Math.max(1, (n / 4096) | 0)
  for (let i = 0; i < n; i += step) {
    let key = ''
    for (let j = 0; j < bpb; j++) key += bytes[i * bpb + j].toString(16)
    set.add(key)
  }
  return set.size
}

// Channels each format actually stores (scored for PSNR). BC7/ASTC also carry
// alpha, reported separately.
const PSNR_CHANNELS = { BC1: [0, 1, 2], BC5: [0, 1], BC7: [0, 1, 2], ASTC4x4: [0, 1, 2], ETC2: [0, 1, 2] }

// Load a PNG as a square RGBA source. We read back the exact pixels we upload
// (same canvas → getImageData for the PSNR reference, copyExternalImageToTexture
// for the shader input) so the reference and the encoder input are bit-identical.
// premultiplyAlpha:'none' + colorSpaceConversion:'none' keep the bytes faithful.
async function loadImageSource(url, name) {
  const blob = await (await fetch(url)).blob()
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  if (bmp.width !== bmp.height) throw new Error(`${url}: expected a square image, got ${bmp.width}×${bmp.height}`)
  if (bmp.width % 4 !== 0) throw new Error(`${url}: size ${bmp.width} is not a multiple of 4`)
  const size = bmp.width
  const cv = new OffscreenCanvas(size, size)
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bmp, 0, 0)
  const pixels = ctx.getImageData(0, 0, size, size).data
  bmp.close?.()
  return { name, size, canvas: cv, pixels }
}

// Encode + score every entry against one source image; returns metric records.
async function qualityForSource({ device, sampler, loadShader, hasASTC, src }) {
  const { size, canvas, pixels: ref } = src
  const srcTex = device.createTexture({
    size: [size, size, 1], format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  })
  device.queue.copyExternalImageToTexture({ source: canvas }, { texture: srcTex }, { width: size, height: size })
  await device.queue.onSubmittedWorkDone()
  const srcView = srcTex.createView()

  const out = []
  for (const fmt of ACTIVE_FORMATS) {
    const bpb = fmt.bytesPerBlock
    const sc = PSNR_CHANNELS[fmt.key]
    for (const e of fmt.entries) {
      if (e.extra && !isAnalysis(src.name)) continue
      if (e.mode4 && !MODE4_BENCH.has(src.name)) continue // mode-4 variant: only the beneficiaries
      const tag = `${fmt.key}/${e.lib}-${e.variant}`
      try {
        const bytes = await encodeBytesOnce(device, sampler, loadShader, e, fmt, srcView, size)
        const rec = {
          format: fmt.key, library: e.lib, variant: e.variant, source: src.name, size,
          distinctBlocks: distinctBlocks(bytes, bpb), psnr: null, psnrChannels: null, decoder: null,
        }

        if (fmt.key === 'BC1' || fmt.key === 'BC5' || fmt.key === 'ETC2') {
          // Standard formats — gputex's reference decoder decodes both libraries.
          rec.psnr = psnrRef(bytes, ref, size, bpb, REF_DECODE[fmt.key], sc)
          rec.psnrChannels = fmt.key === 'BC5' ? 'RG' : 'RGB'
          rec.decoder = 'gputex-ref'
        } else if (fmt.key === 'BC7') {
          rec.bc7Modes = bc7ModeHistogram(bytes)
          // Full decoder (modes 4/5/6) decodes BOTH libraries → real PSNR
          // head-to-head. spark uses modes 4 and 6; gputex is mode 6 by default
          // (the rgba-m4 variant opts into mode 4).
          // Guard: any block in an unsupported mode would be mis-scored, so
          // check the histogram and bail to a note if one appears.
          const unsupported = rec.bc7Modes.reduce((n, count, mode) => n + (count > 0 && !bc7SupportedMode(mode) ? count : 0), 0)
          if (unsupported > 0) {
            rec.note = `PSNR n/a — ${unsupported} blocks use BC7 modes outside the decoder's 4/5/6 coverage`
          } else {
            rec.psnr = psnrRef(bytes, ref, size, bpb, REF_DECODE.BC7, sc)
            rec.psnrA = psnrRef(bytes, ref, size, bpb, REF_DECODE.BC7, [3])
            rec.psnrChannels = 'RGB'
            rec.decoder = 'bc7-full(4/5/6)'
            // Cross-check: gputex's output must decode identically with its own
            // reference decoder (validates the full decoder; covers mode 4 too
            // via the rgba-m4 variant).
            if (e.lib === 'gputex') { try { rec.psnrRef = psnrRef(bytes, ref, size, bpb, REF_DECODE.BC7REF, sc) } catch {} }
          }
        } else if (fmt.key === 'ASTC4x4') {
          if (hasASTC) {
            // Native hardware decode: valid for any conforming ASTC block and
            // symmetric across libraries — the fair head-to-head metric.
            rec.psnr = psnr(ref, await decodeASTC4x4GPU(device, bytes, size), size, sc)
            rec.psnrChannels = 'RGB'
            rec.decoder = 'gpu-hardware'
            // Cross-check: gputex's own blocks must also round-trip through its
            // CPU reference decoder and agree with hardware (spark's config throws).
            if (e.lib === 'gputex') { try { rec.psnrRef = psnrRef(bytes, ref, size, bpb, REF_DECODE.ASTC4x4, sc) } catch {} }
          } else {
            rec.note = 'astc decode unavailable'
          }
        }

        out.push(rec)
        const psnrStr = rec.psnr != null
          ? `PSNR(${rec.psnrChannels}) ${rec.psnr.toFixed(2)} dB` + (rec.psnrA != null ? ` A ${rec.psnrA.toFixed(2)}` : '')
          : rec.bc7Modes ? 'modes ' + JSON.stringify(rec.bc7Modes) : (rec.note || '')
        log(`  ${tag.padEnd(24)} ${psnrStr}  distinct≈${rec.distinctBlocks}`)
      } catch (err) {
        log('  quality FAIL', tag, err.message)
        out.push({ format: fmt.key, library: e.lib, variant: e.variant, source: src.name, size, error: String(err.message || err) })
      }
    }
  }
  srcTex.destroy()
  return out
}

async function runQuality({ device, sampler, loadShader, features, manifest }) {
  const hasASTC = features.includes('texture-compression-astc')
  // Synthetic (resolution-independent, 512²) plus every real texture from the
  // manifest, each at its native size.
  const sm = makeImage(QSIZE)
  const metrics = []
  const sizes = { synthetic: QSIZE }
  // Load-and-score one source at a time so we never hold 34 decoded images in RAM.
  for (const job of [{ name: 'synthetic' }, ...(manifest || [])]) {
    let src
    try { src = job.url ? await loadImageSource(job.url, job.name) : { name: 'synthetic', size: QSIZE, canvas: sm.canvas, pixels: sm.pixels } }
    catch (err) { log(`  (skipping quality source ${job.name}: ${err.message})`); continue }
    sizes[src.name] = src.size
    log(`\n=== quality @ ${src.size}² — source: ${src.name} ===`)
    metrics.push(...await qualityForSource({ device, sampler, loadShader, hasASTC, src }))
  }
  const sources = [...new Set(metrics.map(m => m.source))].map(name => ({ name, size: sizes[name] }))
  return { size: QSIZE, sources: sources.map(s => ({ name: s.name, size: s.size })), metrics }
}

window.runBench = runBench
// auto-run when opened directly in a browser
if (!window.__NO_AUTORUN__) {
  runBench().catch(e => {
    log('ERROR', e.message)
    window.__BENCH_ERROR__ = String(e.stack || e)
    window.__BENCH_DONE__ = true
  })
}
