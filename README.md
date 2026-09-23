# gputex vs spark.js — WebGPU texture-compression benchmark

A head-to-head benchmark of the **WebGPU texture-compression compute shaders** shipped by
[gputex](https://github.com/verekia/gputex) and
[spark.js](https://github.com/Ludicon/spark.js), for the five block formats both projects
implement: **BC1, BC5, BC7, ASTC 4×4, ETC2** (RGB). Measured against **gputex 0.8.0**.

Speed and quality are measured on a **34-texture suite** in `textures/` — two AmbientCG PBR material
sets (Rock064, WoodFloor004: Colour / Normal / Roughness / AO / Displacement at 1K / 2K / 4K), a
packed-materials atlas (256²–4096²), plus a colour and a normal map, and a procedural alpha card.

## Results across the suite

Apple M3, Chrome (WebGPU/Metal). Speed = GPU compute time per encode (batched, GPU kept saturated,
the libraries interleaved and compared as a median of paired ratios, median across 3 runs). Quality =
PSNR via reference decoders (deterministic).
gputex always encodes RGBA; the pairing is vs spark's matching RGBA variant.

<!-- SUMMARY:START -->
Median across the suite (34 textures + a procedural alpha card; the card is N/A for BC1/BC5)

🟢 gputex ahead · ⚡️ spark ahead · tie (within 5%).

Speed = encode-time ratio; quality = PSNR gap (as ×-less-error).

**Bold** = decisive (>1.5×).

| format | Speed | Quality |
|---|---|---|
| **BC1** | **🟢 16×** | 🟢 1.17× |
| **BC5** | tie | tie |
| **BC7** | 🟢 1.26× | 🟢 1.14× |
| **ASTC** | 🟢 1.20× | **🟢 1.69×** |
| **ETC2** | tie | 🟢 1.27× |

Results vary by content and resolution: BC1's speed margin grows with resolution, spark leads BC7 quality on normal maps, ASTC quality gaps are largest on grayscale, and ETC2 speed splits by content (spark ahead on grayscale maps, gputex on colour / normal).
<!-- SUMMARY:END -->

## Per-format summary

- **BC1** — gputex is faster on all 34 (8–111×, the margin grows with resolution) and higher quality
  on all 34 — its near-flat-block path now also wins the 4 displacement maps spark used to lead.
- **BC5** — the two are within a few tenths of a dB everywhere (median −0.09 dB): 32/34 quality ties.
  Speed is level on 25; spark is 5–24% faster on the other 9 (4 of them displacement maps). (gputex's
  library feeds BC5 a two-channel `rg8` source, halving its reads; here every shader gets the same
  `rgba8` source.)
- **BC7** — gputex is faster or level everywhere (32 wins, 3 ties). It encodes mode 6 by default;
  quality leads on 20/35, with spark ahead on the 14 decorrelated normal / colour maps. The opt-in
  `adaptiveMode4` raises quality on colour / normal / packed content.
- **ASTC 4×4** — gputex is faster on all 34 textures plus the alpha card (1.06–2.2×) and has the
  higher PSNR on all of them, by the widest margin on grayscale.
- **ETC2** (RGB) — gputex has the higher PSNR (median +1.0 dB, ahead on 33/34, 1 tie). Speed is level
  overall (median 1.02×) but splits by content: gputex is faster on 10 colour / normal / packed
  textures (up to 1.2×), spark on 12 — the grayscale AO / roughness / displacement maps, by up to
  1.9× — and 12 tie.

## Low quality vs high quality mode (within each library)

<!-- MODES:START -->
Each library also lets you trade quality for size on the **same** format split — low quality (BC1 desktop / ETC2 mobile, 4 bpp) vs high (BC7 / ASTC, 8 bpp). This is each library measured against **itself**, not the rival. Output is always **2× smaller** in low mode; the encode-speed and quality effects are per-implementation. The **loses less** row calls out which library handles the downgrade better on each axis (smaller speed penalty, smaller PSNR drop):

**Desktop — BC1 (low) vs BC7 (high)**

| library | memory | encode speed (low vs high) | quality (low vs high) |
|---|---|---|---|
| gputex | 2× smaller | **1.6× slower** | −7.1 dB |
| spark | 2× smaller | 24.1× slower | **−6.7 dB** |
| **loses less →** | tie | 🟢 **gputex** | ⚡️ **spark** |

**Mobile — ETC2 (low) vs ASTC (high)**

| library | memory | encode speed (low vs high) | quality (low vs high) |
|---|---|---|---|
| gputex | 2× smaller | 1.1× faster | −9.4 dB |
| spark | 2× smaller | **1.4× faster** | **−7.8 dB** |
| **loses less →** | tie | ⚡️ **spark** | ⚡️ **spark** |

Low mode always halves the output size and costs 6.7–9.4 dB of PSNR (median per library and track). Whether it encodes faster depends on the implementation — see the speed column. The **loses less** row marks which library gives up less on each axis.
<!-- MODES:END -->

## Full results

<!-- RESULTS:START -->
## ⚡ Speed — per texture (gputex vs spark)

🟢 gputex faster · ⚡️ spark faster · tie = within 5%. Cell = winner + ratio (faster ÷ slower per-encode time).

| texture | size | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|---|
| color | 1024² | **🟢 51×** | ⚡️ 1.05× | 🟢 1.17× | 🟢 1.27× | ⚡️ 1.19× |
| normal | 1024² | **🟢 68×** | ⚡️ 1.07× | 🟢 1.19× | 🟢 1.20× | 🟢 1.08× |
| alpha card | 512² | N/A | N/A | 🟢 1.16× | 🟢 1.06× | N/A |
| packed 256 | 256² | **🟢 8.03×** | tie | 🟢 1.24× | 🟢 1.09× | 🟢 1.11× |
| packed 512 | 512² | **🟢 11×** | tie | 🟢 1.23× | 🟢 1.14× | 🟢 1.07× |
| packed 1024 | 1024² | **🟢 14×** | tie | 🟢 1.26× | 🟢 1.15× | 🟢 1.07× |
| packed 2048 | 2048² | **🟢 23×** | tie | 🟢 1.22× | 🟢 1.12× | 🟢 1.20× |
| packed 4096 | 4096² | **🟢 40×** | ⚡️ 1.11× | 🟢 1.06× | 🟢 1.10× | ⚡️ 1.20× |
| Rock064 1K AO | 1024² | **🟢 23×** | tie | **🟢 2.18×** | **🟢 2.14×** | ⚡️ 1.11× |
| Rock064 2K AO | 2048² | **🟢 23×** | tie | **🟢 1.77×** | **🟢 1.96×** | ⚡️ 1.16× |
| Rock064 4K AO | 4096² | **🟢 28×** | ⚡️ 1.07× | **🟢 1.59×** | **🟢 1.61×** | ⚡️ 1.23× |
| Rock064 1K Color | 1024² | **🟢 13×** | tie | 🟢 1.28× | 🟢 1.18× | tie |
| Rock064 2K Color | 2048² | **🟢 12×** | tie | 🟢 1.24× | 🟢 1.20× | 🟢 1.08× |
| Rock064 4K Color | 4096² | **🟢 13×** | tie | 🟢 1.25× | 🟢 1.15× | tie |
| Rock064 1K Displacement | 1024² | **🟢 36×** | ⚡️ 1.15× | **🟢 2.23×** | **🟢 2.22×** | **⚡️ 1.55×** |
| Rock064 2K Displacement | 2048² | **🟢 59×** | ⚡️ 1.21× | **🟢 1.99×** | **🟢 2.06×** | **⚡️ 1.74×** |
| Rock064 4K Displacement | 4096² | **🟢 111×** | ⚡️ 1.24× | **🟢 1.85×** | **🟢 2.06×** | **⚡️ 1.88×** |
| Rock064 1K Normal | 1024² | **🟢 14×** | tie | 🟢 1.25× | 🟢 1.13× | tie |
| Rock064 2K Normal | 2048² | **🟢 13×** | tie | 🟢 1.24× | 🟢 1.15× | tie |
| Rock064 4K Normal | 4096² | **🟢 14×** | tie | 🟢 1.23× | 🟢 1.12× | tie |
| Rock064 1K Roughness | 1024² | **🟢 15×** | tie | **🟢 2.17×** | **🟢 2.18×** | tie |
| Rock064 2K Roughness | 2048² | **🟢 14×** | tie | **🟢 1.66×** | **🟢 1.65×** | tie |
| Rock064 4K Roughness | 4096² | **🟢 16×** | tie | **🟢 2.05×** | **🟢 2.06×** | tie |
| WoodFloor004 1K Color | 1024² | **🟢 18×** | tie | tie | 🟢 1.09× | 🟢 1.05× |
| WoodFloor004 2K Color | 2048² | **🟢 20×** | tie | tie | 🟢 1.11× | 🟢 1.08× |
| WoodFloor004 4K Color | 4096² | **🟢 32×** | ⚡️ 1.09× | tie | 🟢 1.11× | ⚡️ 1.08× |
| WoodFloor004 1K Displacement | 1024² | **🟢 15×** | tie | **🟢 2.20×** | **🟢 2.19×** | tie |
| WoodFloor004 2K Displacement | 2048² | **🟢 24×** | tie | **🟢 2.07×** | **🟢 2.06×** | **⚡️ 1.60×** |
| WoodFloor004 4K Displacement | 4096² | **🟢 36×** | ⚡️ 1.16× | **🟢 2.08×** | **🟢 2.17×** | **⚡️ 1.67×** |
| WoodFloor004 1K Normal | 1024² | **🟢 15×** | tie | 🟢 1.26× | 🟢 1.12× | 🟢 1.07× |
| WoodFloor004 2K Normal | 2048² | **🟢 14×** | tie | 🟢 1.28× | 🟢 1.17× | 🟢 1.08× |
| WoodFloor004 4K Normal | 4096² | **🟢 13×** | tie | 🟢 1.21× | 🟢 1.19× | tie |
| WoodFloor004 1K Roughness | 1024² | **🟢 17×** | tie | **🟢 2.20×** | **🟢 2.16×** | tie |
| WoodFloor004 2K Roughness | 2048² | **🟢 19×** | tie | **🟢 2.07×** | **🟢 2.05×** | tie |
| WoodFloor004 4K Roughness | 4096² | **🟢 13×** | tie | **🟢 2.02×** | **🟢 2.15×** | ⚡️ 1.38× |

## 🎨 Quality — per texture (gputex vs spark)

🟢 gputex higher PSNR · ⚡️ spark higher · tie = within 5% MSE. Ratio = how much more squared error (MSE) the loser carries = 10^(ΔdB/10).

| texture | size | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|---|
| color | 1024² | 🟢 1.09× | tie | **⚡️ 1.69×** | **🟢 1.52×** | 🟢 1.12× |
| normal | 1024² | 🟢 1.07× | tie | ⚡️ 1.18× | **🟢 2.37×** | 🟢 1.43× |
| alpha card | 512² | N/A | N/A | **🟢 1.52×** | **🟢 1.53×** | N/A |
| packed 256 | 256² | 🟢 1.33× | tie | ⚡️ 1.47× | **🟢 1.57×** | 🟢 1.30× |
| packed 512 | 512² | 🟢 1.40× | tie | ⚡️ 1.28× | **🟢 1.69×** | 🟢 1.32× |
| packed 1024 | 1024² | 🟢 1.37× | tie | ⚡️ 1.12× | **🟢 1.77×** | 🟢 1.28× |
| packed 2048 | 2048² | 🟢 1.18× | ⚡️ 1.05× | tie | **🟢 1.65×** | **🟢 1.61×** |
| packed 4096 | 4096² | 🟢 1.21× | tie | 🟢 1.26× | **🟢 1.64×** | **🟢 1.54×** |
| Rock064 1K AO | 1024² | 🟢 1.27× | tie | 🟢 1.35× | **🟢 18.01×** | **🟢 1.70×** |
| Rock064 2K AO | 2048² | 🟢 1.25× | tie | 🟢 1.32× | **🟢 17.60×** | **🟢 1.60×** |
| Rock064 4K AO | 4096² | 🟢 1.26× | tie | 🟢 1.35× | **🟢 17.77×** | **🟢 1.51×** |
| Rock064 1K Color | 1024² | 🟢 1.19× | tie | ⚡️ 1.48× | **🟢 1.58×** | 🟢 1.11× |
| Rock064 2K Color | 2048² | 🟢 1.17× | tie | ⚡️ 1.29× | **🟢 1.57×** | 🟢 1.07× |
| Rock064 4K Color | 4096² | 🟢 1.14× | tie | ⚡️ 1.10× | **🟢 1.62×** | tie |
| Rock064 1K Displacement | 1024² | 🟢 1.34× | tie | **🟢 6.70×** | **🟢 52.54×** | 🟢 1.24× |
| Rock064 2K Displacement | 2048² | **🟢 1.54×** | tie | **🟢 29.24×** | **🟢 111.32×** | 🟢 1.22× |
| Rock064 4K Displacement | 4096² | **🟢 1.86×** | tie | **🟢 99.10×** | **🟢 194.45×** | 🟢 1.25× |
| Rock064 1K Normal | 1024² | 🟢 1.15× | tie | **⚡️ 1.86×** | 🟢 1.33× | 🟢 1.23× |
| Rock064 2K Normal | 2048² | 🟢 1.16× | tie | **⚡️ 2.12×** | 🟢 1.33× | 🟢 1.20× |
| Rock064 4K Normal | 4096² | 🟢 1.16× | tie | **⚡️ 2.30×** | 🟢 1.33× | 🟢 1.22× |
| Rock064 1K Roughness | 1024² | 🟢 1.06× | tie | 🟢 1.13× | **🟢 15.68×** | **🟢 1.62×** |
| Rock064 2K Roughness | 2048² | 🟢 1.06× | tie | 🟢 1.13× | **🟢 15.22×** | **🟢 1.55×** |
| Rock064 4K Roughness | 4096² | 🟢 1.06× | tie | 🟢 1.14× | **🟢 15.21×** | **🟢 1.53×** |
| WoodFloor004 1K Color | 1024² | 🟢 1.12× | tie | 🟢 1.23× | 🟢 1.47× | 🟢 1.10× |
| WoodFloor004 2K Color | 2048² | 🟢 1.17× | tie | 🟢 1.27× | 🟢 1.47× | 🟢 1.12× |
| WoodFloor004 4K Color | 4096² | 🟢 1.23× | tie | 🟢 1.33× | **🟢 1.56×** | 🟢 1.13× |
| WoodFloor004 1K Displacement | 1024² | 🟢 1.14× | tie | **🟢 2.04×** | **🟢 16.73×** | **🟢 2.03×** |
| WoodFloor004 2K Displacement | 2048² | 🟢 1.21× | tie | **🟢 4.57×** | **🟢 39.93×** | 🟢 1.36× |
| WoodFloor004 4K Displacement | 4096² | 🟢 1.33× | tie | **🟢 15.23×** | **🟢 309.66×** | 🟢 1.19× |
| WoodFloor004 1K Normal | 1024² | 🟢 1.08× | tie | ⚡️ 1.28× | 🟢 1.24× | 🟢 1.09× |
| WoodFloor004 2K Normal | 2048² | 🟢 1.09× | tie | ⚡️ 1.22× | 🟢 1.23× | 🟢 1.18× |
| WoodFloor004 4K Normal | 4096² | 🟢 1.19× | tie | **⚡️ 1.62×** | 🟢 1.35× | 🟢 1.11× |
| WoodFloor004 1K Roughness | 1024² | 🟢 1.07× | ⚡️ 1.05× | 🟢 1.19× | **🟢 14.62×** | **🟢 1.99×** |
| WoodFloor004 2K Roughness | 2048² | 🟢 1.10× | tie | 🟢 1.49× | **🟢 16.42×** | **🟢 1.91×** |
| WoodFloor004 4K Roughness | 4096² | 🟢 1.15× | tie | **🟢 2.06×** | **🟢 24.58×** | **🟢 2.83×** |

> **BC7** uses `bc7full.js` (modes 4/5/6) to decode both libraries — its mode-4 and mode-6 paths match
> gputex's reference decoder bit-for-bit. **ASTC** uses the M3 hardware decoder; **BC1/BC5** gputex's reference.

## 🎨 BC7 mode 4 (opt-in) — gputex vs spark on the content that benefits most

gputex BC7 encodes mode 6 by default; `new BC7Encoder({ adaptiveMode4: true })` enables mode 4. On the decorrelated colour / normal / packed content that benefits, mode 4 raises PSNR for roughly 50% more encode time. With mode 4 enabled:

| texture | Speed | Quality |
|---|---|---|
| color | tie | tie |
| normal | tie | 🟢 1.19× |
| packed 512 | ⚡️ 1.20× | 🟢 1.23× |
| packed 1024 | ⚡️ 1.19× | 🟢 1.36× |
| Rock064 2K Normal | ⚡️ 1.25× | ⚡️ 1.20× |
| Rock064 4K Normal | ⚡️ 1.25× | ⚡️ 1.25× |
| WoodFloor004 4K Normal | ⚡️ 1.28× | tie |

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
  dispatches in one pass** (~10 ms) so the GPU stays saturated;
- the shaders competing on a texture × format are timed **interleaved** — one sample each per round,
  in a fresh (seeded) random order, 25 rounds, every sample preceded by an untimed ~2 ms **washout**
  of the same shader — and compared by the **median of their per-round time ratios**, so GPU clock
  swings hit both sides of every ratio equally. Each cell is the **median across 3 runs** (fresh
  browser each).

Why the pairing: the M3's GPU clock oscillates on a millisecond timescale under sustained load (it is
a fanless MacBook Air). With 2.5 ms samples, one shader's own samples spread ~50%, and two
effectively identical shaders (gputex BC5/BC7/ETC2 before and after a one-uniform-add change) timed
up to 25% apart by their best sample; with 10 ms samples and paired ratios the same A/A check stays
within 5% on every cell (median 0.3%). Why the random order and washout: a sample also inherits
state from the one before it. With a fixed rotation, one entry followed spark's heavy BC1 4K
dispatches (~28 ms each) twice as often as another, and once the machine was hot two copies of the
same gputex BC1 shader measured up to 9% apart at 4096²; with both fixes they agree within 0.5%.

A quality pass then computes PSNR with one decoder per format, applied to both libraries, on every
texture in `textures/` (scanned automatically) plus a procedural **alpha card**:

- **BC1 / BC5 / ETC2** — gputex's CPU reference decoder (`gputex/testing`, bundled into `refcodec.js`).
- **BC7** — `bc7full.js`, this repo's own software decoder for the LDR modes 4/5/6. spark emits modes
  4 & 6; gputex is mode 6 by default (mode 4 only via the opt-in variant). The decoder's mode-4 and
  mode-6 paths are **bit-exact** against gputex's reference decoder.
- **ASTC** — native M3 hardware decode. gputex's blocks are also decoded with its reference decoder
  and compared value by value: they agree to within 1 LSB everywhere (0.6% of values differ by
  exactly 1, a last-bit rounding difference in the hardware path; a mis-encoded block would be off by
  many levels).

Every shader produced full-diversity output; all cross-checks pass; 0 errors across the suite.

## Run it

```sh
npm install
# populate shaders/spark/ — see shaders/spark/README.md
npm run bench                    # scans textures/, opens Chrome (headed, real GPU), writes results.json
FORMAT=ETC2 npm run bench        # only ETC2 (comma list ok, e.g. FORMAT=BC7,ETC2) — fast iteration on one format
TEX_LIMIT=3 npm run bench        # only the first 3 textures — quick smoke test
TEX_MATCH=4K npm run bench       # only textures whose name matches the regex
RUNS=3 npm run bench             # 3 fresh-browser runs, per-cell median (how the README numbers are made)
npm run report                   # regenerates the generated tables in this README
npm run compare                  # opens the visual gputex-vs-spark quality tool (flip both on a plane)
npm run build:refcodec           # (optional) regenerate refcodec.js from latest gputex — needs bun
```

To judge a gputex shader update against the release it replaces, put the previous
`*_fast_f16.wgsl` files in `shaders/gputex-prev/` (gitignored). Every format then also times that
baseline, interleaved with the current shaders and spark, and `npm run report` prints the
new-vs-previous delta per format to the console (the README tables stay gputex vs spark).

Requirements: Node ≥ 18, Google Chrome installed, a GPU with WebGPU + `timestamp-query` (and
`shader-f16` for both libraries' f16 kernels). `run.mjs` launches Chrome headed and with
`--enable-dawn-features=allow_unsafe_apis` / `--disable-dawn-features=timestamp_quantization` to get
a real GPU and full-precision timestamps. You can also open `bench.html` from any static WebGPU
server — it runs automatically and prints to the page (timestamp precision may be reduced).

## Caveats

- **Content- and GPU-dependent.** Results are Apple M3 + Metal on this texture set. Ratios move on
  other GPUs and other content; the winner already flips by content within this suite.
- **Pure-shader, not end-to-end.** Upload and readback/copy are excluded by design.
- **Thermal state moves some ratios.** Where a bandwidth-bound shader meets an ALU-bound one — BC1,
  and gputex's grayscale fast paths vs spark's full search on AO / roughness / displacement maps —
  the per-run ratio shifts by up to ~30–50% between runs as the fanless M3 throttles, while two
  copies of the same shader still agree within 2.4%. Each cell is the median of 3 runs; treat
  those cells' exact ratios as ±30%.
- **BC7 without hardware decode.** Scored via the `bc7full.js` software decoder (modes 4/5/6), which
  covers 100% of both libraries' output here (verified via the block mode histogram).

<!-- ENV:START -->
## Environment

```
GPU:        {"vendor":"apple","architecture":"metal-3","device":"","description":""}
features:   timestamp-query, shader-f16, texture-compression-astc, texture-compression-bc
shader-f16: true (both libraries run f16 kernels)
timing:     median paired ratio over 25 batched samples (+10 warmup) per cell, median across 3 runs
            each sample = many back-to-back dispatches in one timestamped pass (GPU kept saturated, ~10 ms)
            the libraries' samples interleaved per texture × format, random order + washout each round
quantized:  false
```

<!-- ENV:END -->

## Licensing

gputex shaders and its reference decoders are MIT (the decoders are bundled verbatim into the
committed `refcodec.js`); `bc7full.js` is this repo's own MIT decoder. **spark.js shaders are
proprietary** (covered by the [spark.js EULA](https://ludicon.com/sparkjs/eula.html)); they are used
here for a local performance comparison only and are **not** redistributed in this repository. The
`textures/` set is AmbientCG (CC0) plus the repo's own colour / normal / packed-materials assets.
