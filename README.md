# gputex vs spark.js — WebGPU texture-compression benchmark

A head-to-head benchmark of the **WebGPU texture-compression compute shaders** shipped by
[gputex](https://github.com/verekia/gputex) and
[spark.js](https://github.com/Ludicon/spark.js), for the five block formats both projects
implement: **BC1, BC5, BC7, ASTC 4×4, ETC2** (RGB). Measured against **gputex 0.4.0**.

Speed and quality are measured on a **34-texture suite** in `textures/` — two AmbientCG PBR material
sets (Rock064, WoodFloor004: Colour / Normal / Roughness / AO / Displacement at 1K / 2K / 4K), a
packed-materials atlas (256²–4096²), plus a colour and a normal map, and a procedural alpha card.

## Results across the suite

Apple M3, Chrome (WebGPU/Metal). Speed = GPU compute time per encode (batched, GPU kept saturated,
min of the samples, median across runs). Quality = PSNR via reference decoders (deterministic).
gputex always encodes RGBA; the pairing is vs spark's matching RGBA variant.

<!-- SUMMARY:START -->
Median across the suite (34 textures + a procedural alpha card; the card is N/A for BC1/BC5)

🟢 gputex ahead · ⚡️ spark ahead · tie (within 5%).

Speed = encode-time ratio; quality = PSNR gap (as ×-less-error).

**Bold** = decisive (>1.5×).

| format | Speed | Quality |
|---|---|---|
| **BC1** | **🟢 16×** | 🟢 1.14× |
| **BC5** | tie | tie |
| **BC7** | 🟢 1.35× | 🟢 1.14× |
| **ASTC** | 🟢 1.21× | **🟢 1.61×** |
| **ETC2** | **⚡️ 1.57×** | 🟢 1.27× |

Results vary by content and resolution: BC1's speed margin grows with resolution, spark leads BC7 quality on normal maps, and ASTC quality gaps are largest on grayscale.
<!-- SUMMARY:END -->

## Per-format summary

- **BC1** — gputex is faster on all 34 (7–89×, the margin grows with resolution) and higher quality
  on 30/34; spark leads quality on 4 displacement maps.
- **BC5** — the two are within a few tenths of a dB everywhere (median −0.09 dB): 32/34 quality ties.
  Speed is level — 14 ties, the other 20 split evenly (10 each).
- **BC7** — gputex is faster on all 34 (31 wins, 3 ties). It encodes mode 6 by default; quality leads
  on 19/34, with spark ahead on the 14 decorrelated normal / colour maps. The opt-in `adaptiveMode4`
  raises quality on colour / normal / packed content.
- **ASTC 4×4** — gputex is faster on the opaque textures (27 wins, 7 ties, 0 losses) and has the
  higher PSNR on all 34 (plus the alpha card), by the widest margin on grayscale.
- **ETC2** (RGB) — gputex has the higher PSNR (median +1.0 dB, ahead on 32/34, 2 ties); spark is
  ~1.6× faster on every texture.

## Low quality vs high quality mode (within each library)

<!-- MODES:START -->
Each library also lets you trade quality for size on the **same** format split — low quality (BC1 desktop / ETC2 mobile, 4 bpp) vs high (BC7 / ASTC, 8 bpp). This is each library measured against **itself**, not the rival. Output is always **2× smaller** in low mode; the encode-speed and quality effects are per-implementation. The **loses less** row calls out which library handles the downgrade better on each axis (smaller speed penalty, smaller PSNR drop):

**Desktop — BC1 (low) vs BC7 (high)**

| library | memory | encode speed (low vs high) | quality (low vs high) |
|---|---|---|---|
| gputex | 2× smaller | **2.7× slower** | −7.1 dB |
| spark | 2× smaller | 31.7× slower | **−6.7 dB** |
| **loses less →** | tie | 🟢 **gputex** | ⚡️ **spark** |

**Mobile — ETC2 (low) vs ASTC (high)**

| library | memory | encode speed (low vs high) | quality (low vs high) |
|---|---|---|---|
| gputex | 2× smaller | 1.8× slower | −8.3 dB |
| spark | 2× smaller | **1.3× faster** | **−7.8 dB** |
| **loses less →** | tie | ⚡️ **spark** | ⚡️ **spark** |

On this GPU, low mode always halves the output size. It does not encode faster — timing is roughly level or slower — and costs about 7–9 dB of PSNR. The **loses less** row marks which library gives up less on each axis.
<!-- MODES:END -->

## Full results

<!-- RESULTS:START -->
## ⚡ Speed — per texture (gputex vs spark)

🟢 gputex faster · ⚡️ spark faster · tie = within 5%. Cell = winner + ratio (faster ÷ slower per-encode time).

| texture | size | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|---|
| color | 1024² | **🟢 49×** | tie | 🟢 1.19× | 🟢 1.17× | **⚡️ 2.00×** |
| normal | 1024² | **🟢 63×** | 🟢 1.07× | 🟢 1.26× | 🟢 1.15× | ⚡️ 1.41× |
| alpha card | 512² | N/A | N/A | **🟢 1.52×** | tie | N/A |
| packed 256 | 256² | **🟢 8.39×** | 🟢 1.18× | 🟢 1.32× | 🟢 1.14× | ⚡️ 1.25× |
| packed 512 | 512² | **🟢 15×** | tie | 🟢 1.31× | 🟢 1.21× | ⚡️ 1.39× |
| packed 1024 | 1024² | **🟢 10×** | tie | 🟢 1.35× | 🟢 1.40× | ⚡️ 1.48× |
| packed 2048 | 2048² | **🟢 15×** | tie | 🟢 1.24× | 🟢 1.06× | ⚡️ 1.19× |
| packed 4096 | 4096² | **🟢 34×** | ⚡️ 1.10× | 🟢 1.07× | tie | **⚡️ 2.09×** |
| Rock064 1K AO | 1024² | **🟢 19×** | ⚡️ 1.07× | **🟢 2.40×** | **🟢 2.25×** | **⚡️ 1.54×** |
| Rock064 2K AO | 2048² | **🟢 13×** | tie | **🟢 1.77×** | **🟢 1.73×** | **⚡️ 2.97×** |
| Rock064 4K AO | 4096² | **🟢 25×** | ⚡️ 1.06× | **🟢 1.62×** | **🟢 1.64×** | **⚡️ 2.18×** |
| Rock064 1K Color | 1024² | **🟢 10×** | 🟢 1.14× | 🟢 1.28× | 🟢 1.25× | **⚡️ 1.87×** |
| Rock064 2K Color | 2048² | **🟢 13×** | 🟢 1.46× | 🟢 1.29× | 🟢 1.09× | ⚡️ 1.50× |
| Rock064 4K Color | 4096² | **🟢 12×** | 🟢 1.07× | 🟢 1.26× | tie | **⚡️ 1.65×** |
| Rock064 1K Displacement | 1024² | **🟢 23×** | ⚡️ 1.14× | **🟢 2.21×** | **🟢 2.41×** | **⚡️ 2.70×** |
| Rock064 2K Displacement | 2048² | **🟢 40×** | **⚡️ 1.70×** | **🟢 1.90×** | **🟢 1.93×** | **⚡️ 1.85×** |
| Rock064 4K Displacement | 4096² | **🟢 71×** | ⚡️ 1.24× | **🟢 1.75×** | **🟢 1.76×** | **⚡️ 3.00×** |
| Rock064 1K Normal | 1024² | **🟢 13×** | 🟢 1.34× | **🟢 1.77×** | tie | ⚡️ 1.10× |
| Rock064 2K Normal | 2048² | **🟢 14×** | tie | 🟢 1.26× | tie | **⚡️ 1.58×** |
| Rock064 4K Normal | 4096² | **🟢 13×** | 🟢 1.29× | 🟢 1.24× | tie | **⚡️ 1.58×** |
| Rock064 1K Roughness | 1024² | **🟢 14×** | ⚡️ 1.48× | **🟢 2.44×** | **🟢 2.54×** | ⚡️ 1.38× |
| Rock064 2K Roughness | 2048² | **🟢 15×** | 🟢 1.44× | **🟢 1.69×** | **🟢 1.72×** | ⚡️ 1.38× |
| Rock064 4K Roughness | 4096² | **🟢 17×** | tie | **🟢 1.52×** | **🟢 1.55×** | **⚡️ 1.86×** |
| WoodFloor004 1K Color | 1024² | **🟢 22×** | tie | tie | 🟢 1.19× | ⚡️ 1.41× |
| WoodFloor004 2K Color | 2048² | **🟢 15×** | tie | tie | 🟢 1.06× | **⚡️ 1.54×** |
| WoodFloor004 4K Color | 4096² | **🟢 32×** | ⚡️ 1.11× | tie | tie | **⚡️ 2.11×** |
| WoodFloor004 1K Displacement | 1024² | **🟢 20×** | tie | **🟢 2.19×** | **🟢 2.46×** | **⚡️ 1.54×** |
| WoodFloor004 2K Displacement | 2048² | **🟢 23×** | 🟢 1.15× | **🟢 1.80×** | **🟢 1.78×** | **⚡️ 3.19×** |
| WoodFloor004 4K Displacement | 4096² | **🟢 35×** | ⚡️ 1.15× | **🟢 1.68×** | **🟢 1.65×** | **⚡️ 2.86×** |
| WoodFloor004 1K Normal | 1024² | **🟢 15×** | tie | 🟢 1.31× | 🟢 1.20× | **⚡️ 1.60×** |
| WoodFloor004 2K Normal | 2048² | **🟢 18×** | 🟢 1.19× | 🟢 1.29× | 🟢 1.10× | **⚡️ 1.56×** |
| WoodFloor004 4K Normal | 4096² | **🟢 14×** | tie | 🟢 1.22× | tie | **⚡️ 1.56×** |
| WoodFloor004 1K Roughness | 1024² | **🟢 18×** | tie | **🟢 2.56×** | **🟢 4.02×** | ⚡️ 1.39× |
| WoodFloor004 2K Roughness | 2048² | **🟢 18×** | **⚡️ 2.11×** | **🟢 1.72×** | **🟢 1.74×** | ⚡️ 1.31× |
| WoodFloor004 4K Roughness | 4096² | **🟢 14×** | tie | **🟢 1.60×** | **🟢 1.60×** | **⚡️ 2.48×** |

## 🎨 Quality — per texture (gputex vs spark)

🟢 gputex higher PSNR · ⚡️ spark higher · tie = within 5% MSE. Ratio = how much more squared error (MSE) the loser carries = 10^(ΔdB/10).

| texture | size | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|---|
| color | 1024² | 🟢 1.08× | tie | **⚡️ 1.69×** | **🟢 1.50×** | 🟢 1.12× |
| normal | 1024² | ⚡️ 1.27× | tie | ⚡️ 1.18× | **🟢 2.28×** | 🟢 1.43× |
| alpha card | 512² | N/A | N/A | **🟢 1.52×** | **🟢 1.53×** | N/A |
| packed 256 | 256² | 🟢 1.33× | tie | ⚡️ 1.47× | 🟢 1.50× | 🟢 1.30× |
| packed 512 | 512² | 🟢 1.40× | tie | ⚡️ 1.28× | **🟢 1.61×** | 🟢 1.32× |
| packed 1024 | 1024² | 🟢 1.37× | tie | ⚡️ 1.12× | **🟢 1.67×** | 🟢 1.28× |
| packed 2048 | 2048² | 🟢 1.17× | ⚡️ 1.05× | tie | 🟢 1.36× | **🟢 1.61×** |
| packed 4096 | 4096² | 🟢 1.11× | tie | 🟢 1.26× | 🟢 1.32× | **🟢 1.54×** |
| Rock064 1K AO | 1024² | 🟢 1.24× | tie | 🟢 1.35× | **🟢 18.01×** | **🟢 1.70×** |
| Rock064 2K AO | 2048² | 🟢 1.22× | tie | 🟢 1.32× | **🟢 17.60×** | **🟢 1.60×** |
| Rock064 4K AO | 4096² | 🟢 1.21× | tie | 🟢 1.35× | **🟢 17.77×** | **🟢 1.51×** |
| Rock064 1K Color | 1024² | 🟢 1.19× | tie | ⚡️ 1.48× | 🟢 1.36× | 🟢 1.09× |
| Rock064 2K Color | 2048² | 🟢 1.17× | tie | ⚡️ 1.29× | 🟢 1.31× | tie |
| Rock064 4K Color | 4096² | 🟢 1.14× | tie | ⚡️ 1.10× | 🟢 1.25× | tie |
| Rock064 1K Displacement | 1024² | 🟢 1.16× | tie | **🟢 6.70×** | **🟢 52.54×** | 🟢 1.24× |
| Rock064 2K Displacement | 2048² | ⚡️ 1.08× | tie | **🟢 29.24×** | **🟢 111.32×** | 🟢 1.22× |
| Rock064 4K Displacement | 4096² | ⚡️ 1.49× | tie | **🟢 99.10×** | **🟢 194.45×** | 🟢 1.25× |
| Rock064 1K Normal | 1024² | 🟢 1.15× | tie | **⚡️ 1.86×** | 🟢 1.29× | 🟢 1.23× |
| Rock064 2K Normal | 2048² | 🟢 1.16× | tie | **⚡️ 2.12×** | 🟢 1.29× | 🟢 1.20× |
| Rock064 4K Normal | 4096² | 🟢 1.16× | tie | **⚡️ 2.30×** | 🟢 1.29× | 🟢 1.22× |
| Rock064 1K Roughness | 1024² | 🟢 1.06× | tie | 🟢 1.13× | **🟢 15.68×** | **🟢 1.62×** |
| Rock064 2K Roughness | 2048² | 🟢 1.05× | tie | 🟢 1.13× | **🟢 15.22×** | **🟢 1.55×** |
| Rock064 4K Roughness | 4096² | 🟢 1.05× | tie | 🟢 1.14× | **🟢 15.21×** | **🟢 1.53×** |
| WoodFloor004 1K Color | 1024² | 🟢 1.12× | tie | 🟢 1.23× | 🟢 1.12× | 🟢 1.10× |
| WoodFloor004 2K Color | 2048² | 🟢 1.16× | tie | 🟢 1.27× | 🟢 1.18× | 🟢 1.12× |
| WoodFloor004 4K Color | 4096² | 🟢 1.14× | tie | 🟢 1.33× | 🟢 1.33× | 🟢 1.13× |
| WoodFloor004 1K Displacement | 1024² | 🟢 1.11× | tie | **🟢 2.04×** | **🟢 16.73×** | **🟢 2.03×** |
| WoodFloor004 2K Displacement | 2048² | 🟢 1.06× | tie | **🟢 4.57×** | **🟢 39.93×** | 🟢 1.36× |
| WoodFloor004 4K Displacement | 4096² | ⚡️ 1.06× | tie | **🟢 15.23×** | **🟢 309.66×** | 🟢 1.19× |
| WoodFloor004 1K Normal | 1024² | 🟢 1.08× | tie | ⚡️ 1.28× | 🟢 1.12× | 🟢 1.09× |
| WoodFloor004 2K Normal | 2048² | 🟢 1.09× | tie | ⚡️ 1.22× | 🟢 1.13× | 🟢 1.18× |
| WoodFloor004 4K Normal | 4096² | 🟢 1.19× | tie | **⚡️ 1.62×** | 🟢 1.29× | 🟢 1.11× |
| WoodFloor004 1K Roughness | 1024² | 🟢 1.06× | ⚡️ 1.05× | 🟢 1.19× | **🟢 14.62×** | **🟢 1.99×** |
| WoodFloor004 2K Roughness | 2048² | 🟢 1.08× | tie | 🟢 1.49× | **🟢 16.42×** | **🟢 1.91×** |
| WoodFloor004 4K Roughness | 4096² | 🟢 1.15× | tie | **🟢 2.06×** | **🟢 24.58×** | **🟢 2.83×** |

> **BC7** uses `bc7full.js` (modes 4/5/6) to decode both libraries — its mode-4 and mode-6 paths match
> gputex's reference decoder bit-for-bit. **ASTC** uses the M3 hardware decoder; **BC1/BC5** gputex's reference.

## 🎨 BC7 mode 4 (opt-in) — gputex vs spark on the content that benefits most

gputex BC7 encodes mode 6 by default; `new BC7Encoder({ adaptiveMode4: true })` enables mode 4. On the decorrelated colour / normal / packed content that benefits, mode 4 raises PSNR for roughly 50% more encode time. With mode 4 enabled:

| texture | Speed | Quality |
|---|---|---|
| color | tie | tie |
| normal | 🟢 1.07× | 🟢 1.19× |
| packed 512 | ⚡️ 1.13× | 🟢 1.23× |
| packed 1024 | ⚡️ 1.18× | 🟢 1.36× |
| Rock064 2K Normal | ⚡️ 1.23× | ⚡️ 1.20× |
| Rock064 4K Normal | ⚡️ 1.25× | ⚡️ 1.25× |
| WoodFloor004 4K Normal | ⚡️ 1.27× | tie |

<!-- RESULTS:END -->

## How it works

This benchmark does **not** run either library's JavaScript. Both wrap their compute dispatch in
different work (gputex reads the result back to the CPU; spark copies it into a GPU texture; uploads
differ), so timing their public APIs would compare surrounding code, not shaders. Instead the harness
loads the **raw `.wgsl` files** from both projects and drives them through identical machinery:

- one shared `rgba8unorm` source texture per image, uploaded once, reused by every shader;
- each shader's **own** pipeline (`layout:'auto'`), bind group, `@workgroup_size`, thread→block
  mapping (gputex `8×8`, spark `16×8`); both libraries run their **`f16`** kernels (the M3 has
  `shader-f16`);
- a GPU **timestamp query** brackets only the compute pass. Each sample runs **many back-to-back
  dispatches in one pass** so the GPU stays saturated; the **min** is taken, then the **median across
  runs**.

A quality pass then computes PSNR with one decoder per format, applied to both libraries, on every
texture in `textures/` (scanned automatically) plus a procedural **alpha card**:

- **BC1 / BC5 / ETC2** — gputex's CPU reference decoder (`gputex/testing`, bundled into `refcodec.js`).
- **BC7** — `bc7full.js`, this repo's own software decoder for the LDR modes 4/5/6. spark emits modes
  4 & 6; gputex is mode 6 by default (mode 4 only via the opt-in variant). The decoder's mode-4 and
  mode-6 paths are **bit-exact** against gputex's reference decoder.
- **ASTC** — native M3 hardware decode, cross-checked against gputex's reference to 0.0001 dB.

Every shader produced full-diversity output; all cross-checks pass; 0 errors across the suite.

## Run it

```sh
npm install
# populate shaders/spark/ — see shaders/spark/README.md
npm run bench                    # scans textures/, opens Chrome (headed, real GPU), writes results.json
FORMAT=ETC2 npm run bench        # only ETC2 (comma list ok, e.g. FORMAT=BC7,ETC2) — fast iteration on one format
TEX_LIMIT=3 npm run bench        # only the first 3 textures — quick smoke test
npm run report                   # regenerates the generated tables in this README
npm run compare                  # opens the visual gputex-vs-spark quality tool (flip both on a plane)
npm run build:refcodec           # (optional) regenerate refcodec.js from latest gputex — needs bun
```

Requirements: Node ≥ 18, Google Chrome installed, a GPU with WebGPU + `timestamp-query` (and
`shader-f16` for both libraries' f16 kernels). `run.mjs` launches Chrome headed and with
`--enable-dawn-features=allow_unsafe_apis` / `--disable-dawn-features=timestamp_quantization` to get
a real GPU and full-precision timestamps. You can also open `bench.html` from any static WebGPU
server — it runs automatically and prints to the page (timestamp precision may be reduced).

## Caveats

- **Content- and GPU-dependent.** Results are Apple M3 + Metal on this texture set. Ratios move on
  other GPUs and other content; the winner already flips by content within this suite.
- **Pure-shader, not end-to-end.** Upload and readback/copy are excluded by design.
- **BC7 without hardware decode.** Scored via the `bc7full.js` software decoder (modes 4/5/6), which
  covers 100% of both libraries' output here (verified via the block mode histogram).

<!-- ENV:START -->
## Environment

```
GPU:        {"vendor":"apple","architecture":"metal-3","device":"","description":""}
features:   timestamp-query, shader-f16, texture-compression-astc, texture-compression-bc
shader-f16: true (both libraries run f16 kernels)
timing:     min of 25 batched samples (+10 warmup) per cell, median across 3 runs
            each sample = many back-to-back dispatches in one timestamped pass (GPU kept saturated)
quantized:  false
```

<!-- ENV:END -->

## Licensing

gputex shaders and its reference decoders are MIT (the decoders are bundled verbatim into the
committed `refcodec.js`); `bc7full.js` is this repo's own MIT decoder. **spark.js shaders are
proprietary** (covered by the [spark.js EULA](https://ludicon.com/sparkjs/eula.html)); they are used
here for a local performance comparison only and are **not** redistributed in this repository. The
`textures/` set is AmbientCG (CC0) plus the repo's own colour / normal / packed-materials assets.
