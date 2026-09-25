# gputex vs spark.js

A benchmark of the WebGPU texture-compression shaders in [gputex](https://github.com/verekia/gputex)
and [spark.js](https://github.com/Ludicon/spark.js). It covers the five formats both libraries
support: BC1, BC5, BC7, ASTC 4×4 and ETC2. It measures speed (GPU encode time) and quality (PSNR)
on 34 textures, from 256² to 4096²: PBR material maps (colour, normal, roughness, AO, displacement)
and a packed-materials atlas.

gputex 0.12.0 · Apple M3 · Chrome (WebGPU / Metal)

## Summary

<!-- SUMMARY:START -->
Median across the 34-texture suite. 🟢 gputex ahead · ⚡️ spark ahead · ⚪️ even = within 3%.

| format | Speed | Quality |
|---|---|---|
| **BC1** | **🟢 16×** | 🟢 1.17× |
| **BC5** | 🟢 1.38× | 🟢 1.04× |
| **BC7** | 🟢 1.28× | 🟢 1.43× |
| **ASTC** | 🟢 1.19× | **🟢 1.69×** |
| **ETC2** | 🟢 1.06× | 🟢 1.27× |
<!-- SUMMARY:END -->

## Full results

<!-- RESULTS:START -->
### Speed

How many times faster the winner encodes.

| texture | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|
| color 1K | **🟢 51×** | 🟢 1.31× | 🟢 1.30× | 🟢 1.28× | ⚡️ 1.05× |
| normal 1K | **🟢 68×** | 🟢 1.25× | 🟢 1.29× | 🟢 1.19× | 🟢 1.18× |
| alpha card 512 | N/A | N/A | 🟢 1.14× | 🟢 1.06× | N/A |
| packed 256 | **🟢 7.41×** | 🟢 1.29× | 🟢 1.18× | 🟢 1.08× | 🟢 1.11× |
| packed 512 | **🟢 12×** | 🟢 1.31× | 🟢 1.20× | 🟢 1.13× | 🟢 1.09× |
| packed 1K | **🟢 14×** | 🟢 1.33× | 🟢 1.24× | 🟢 1.14× | 🟢 1.12× |
| packed 2K | **🟢 23×** | 🟢 1.12× | 🟢 1.23× | 🟢 1.12× | 🟢 1.33× |
| packed 4K | **🟢 39×** | 🟢 1.05× | 🟢 1.17× | 🟢 1.11× | ⚡️ 1.04× |
| Rock064 1K AO | **🟢 22×** | 🟢 1.36× | **🟢 2.17×** | **🟢 2.18×** | ⚡️ 1.04× |
| Rock064 2K AO | **🟢 22×** | 🟢 1.38× | **🟢 2.11×** | **🟢 2.11×** | ⚡️ 1.08× |
| Rock064 4K AO | **🟢 24×** | 🟢 1.33× | **🟢 2.13×** | **🟢 2.10×** | ⚡️ 1.12× |
| Rock064 1K Color | **🟢 13×** | 🟢 1.37× | 🟢 1.25× | 🟢 1.18× | 🟢 1.13× |
| Rock064 2K Color | **🟢 11×** | 🟢 1.39× | 🟢 1.26× | 🟢 1.19× | 🟢 1.14× |
| Rock064 4K Color | **🟢 10×** | 🟢 1.40× | 🟢 1.28× | 🟢 1.18× | 🟢 1.13× |
| Rock064 1K Displacement | **🟢 35×** | 🟢 1.23× | **🟢 2.18×** | **🟢 2.19×** | ⚡️ 1.36× |
| Rock064 2K Displacement | **🟢 52×** | 🟢 1.17× | **🟢 2.09×** | **🟢 2.07×** | ⚡️ 1.40× |
| Rock064 4K Displacement | **🟢 86×** | 🟢 1.12× | **🟢 2.16×** | **🟢 2.16×** | **⚡️ 1.51×** |
| Rock064 1K Normal | **🟢 12×** | 🟢 1.39× | 🟢 1.24× | 🟢 1.13× | 🟢 1.10× |
| Rock064 2K Normal | **🟢 12×** | 🟢 1.41× | 🟢 1.24× | 🟢 1.17× | 🟢 1.08× |
| Rock064 4K Normal | **🟢 12×** | 🟢 1.39× | 🟢 1.25× | 🟢 1.16× | 🟢 1.07× |
| Rock064 1K Roughness | **🟢 13×** | 🟢 1.41× | **🟢 2.13×** | **🟢 2.15×** | 🟢 1.03× |
| Rock064 2K Roughness | **🟢 14×** | 🟢 1.46× | **🟢 2.11×** | **🟢 2.12×** | 🟢 1.04× |
| Rock064 4K Roughness | **🟢 15×** | 🟢 1.40× | **🟢 2.09×** | **🟢 2.15×** | 🟢 1.04× |
| WoodFloor004 1K Color | **🟢 16×** | 🟢 1.39× | 🟢 1.15× | 🟢 1.10× | 🟢 1.13× |
| WoodFloor004 2K Color | **🟢 20×** | 🟢 1.38× | 🟢 1.17× | 🟢 1.13× | 🟢 1.19× |
| WoodFloor004 4K Color | **🟢 32×** | 🟢 1.28× | 🟢 1.19× | 🟢 1.14× | 🟢 1.05× |
| WoodFloor004 1K Displacement | **🟢 15×** | 🟢 1.42× | **🟢 2.12×** | **🟢 2.16×** | ⚪️ even |
| WoodFloor004 2K Displacement | **🟢 24×** | 🟢 1.39× | **🟢 2.10×** | **🟢 2.09×** | ⚡️ 1.41× |
| WoodFloor004 4K Displacement | **🟢 35×** | 🟢 1.23× | **🟢 2.18×** | **🟢 2.14×** | ⚡️ 1.39× |
| WoodFloor004 1K Normal | **🟢 14×** | 🟢 1.37× | 🟢 1.25× | 🟢 1.13× | 🟢 1.14× |
| WoodFloor004 2K Normal | **🟢 14×** | 🟢 1.41× | 🟢 1.27× | 🟢 1.13× | 🟢 1.15× |
| WoodFloor004 4K Normal | **🟢 12×** | 🟢 1.39× | 🟢 1.24× | 🟢 1.18× | 🟢 1.12× |
| WoodFloor004 1K Roughness | **🟢 16×** | 🟢 1.42× | **🟢 2.13×** | **🟢 2.16×** | 🟢 1.04× |
| WoodFloor004 2K Roughness | **🟢 20×** | 🟢 1.44× | **🟢 2.07×** | **🟢 2.13×** | 🟢 1.09× |
| WoodFloor004 4K Roughness | **🟢 13×** | 🟢 1.38× | **🟢 2.11×** | **🟢 2.14×** | ⚡️ 1.26× |

### Quality

How many times more error (MSE) the loser has.

| texture | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|
| color 1K | 🟢 1.09× | 🟢 1.04× | **🟢 1.51×** | **🟢 1.52×** | 🟢 1.12× |
| normal 1K | 🟢 1.07× | 🟢 1.05× | **🟢 1.86×** | **🟢 2.37×** | 🟢 1.43× |
| alpha card 512 | N/A | N/A | **🟢 3.65×** | **🟢 1.53×** | N/A |
| packed 256 | 🟢 1.33× | 🟢 1.03× | **🟢 1.87×** | **🟢 1.57×** | 🟢 1.30× |
| packed 512 | 🟢 1.40× | ⚪️ even | **🟢 2.14×** | **🟢 1.69×** | 🟢 1.32× |
| packed 1K | 🟢 1.37× | 🟢 1.03× | **🟢 2.24×** | **🟢 1.77×** | 🟢 1.28× |
| packed 2K | 🟢 1.18× | 🟢 1.04× | 🟢 1.29× | **🟢 1.65×** | **🟢 1.61×** |
| packed 4K | 🟢 1.21× | 🟢 1.08× | 🟢 1.34× | **🟢 1.64×** | **🟢 1.54×** |
| Rock064 1K AO | 🟢 1.27× | 🟢 1.04× | 🟢 1.45× | **🟢 18.01×** | **🟢 1.70×** |
| Rock064 2K AO | 🟢 1.25× | 🟢 1.05× | 🟢 1.43× | **🟢 17.60×** | **🟢 1.60×** |
| Rock064 4K AO | 🟢 1.26× | 🟢 1.05× | 🟢 1.46× | **🟢 17.77×** | **🟢 1.51×** |
| Rock064 1K Color | 🟢 1.19× | ⚪️ even | 🟢 1.12× | **🟢 1.58×** | 🟢 1.11× |
| Rock064 2K Color | 🟢 1.17× | ⚪️ even | 🟢 1.14× | **🟢 1.57×** | 🟢 1.07× |
| Rock064 4K Color | 🟢 1.14× | ⚪️ even | 🟢 1.18× | **🟢 1.62×** | ⚪️ even |
| Rock064 1K Displacement | 🟢 1.34× | 🟢 1.27× | **🟢 6.85×** | **🟢 52.54×** | 🟢 1.24× |
| Rock064 2K Displacement | **🟢 1.54×** | **🟢 1.81×** | **🟢 29.96×** | **🟢 111.32×** | 🟢 1.22× |
| Rock064 4K Displacement | **🟢 1.86×** | **🟢 2.46×** | **🟢 104.95×** | **🟢 194.45×** | 🟢 1.25× |
| Rock064 1K Normal | 🟢 1.15× | ⚪️ even | 🟢 1.26× | 🟢 1.33× | 🟢 1.23× |
| Rock064 2K Normal | 🟢 1.16× | ⚪️ even | 🟢 1.23× | 🟢 1.33× | 🟢 1.20× |
| Rock064 4K Normal | 🟢 1.16× | ⚪️ even | 🟢 1.21× | 🟢 1.33× | 🟢 1.22× |
| Rock064 1K Roughness | 🟢 1.06× | ⚪️ even | 🟢 1.18× | **🟢 15.68×** | **🟢 1.62×** |
| Rock064 2K Roughness | 🟢 1.06× | ⚪️ even | 🟢 1.18× | **🟢 15.22×** | **🟢 1.55×** |
| Rock064 4K Roughness | 🟢 1.06× | ⚪️ even | 🟢 1.19× | **🟢 15.21×** | **🟢 1.53×** |
| WoodFloor004 1K Color | 🟢 1.12× | 🟢 1.06× | 🟢 1.23× | 🟢 1.47× | 🟢 1.10× |
| WoodFloor004 2K Color | 🟢 1.17× | 🟢 1.09× | 🟢 1.26× | 🟢 1.47× | 🟢 1.12× |
| WoodFloor004 4K Color | 🟢 1.23× | 🟢 1.15× | 🟢 1.32× | **🟢 1.56×** | 🟢 1.13× |
| WoodFloor004 1K Displacement | 🟢 1.14× | 🟢 1.07× | **🟢 2.19×** | **🟢 16.73×** | **🟢 2.03×** |
| WoodFloor004 2K Displacement | 🟢 1.21× | 🟢 1.20× | **🟢 4.85×** | **🟢 39.93×** | 🟢 1.36× |
| WoodFloor004 4K Displacement | 🟢 1.33× | **🟢 1.65×** | **🟢 14.84×** | **🟢 309.66×** | 🟢 1.19× |
| WoodFloor004 1K Normal | 🟢 1.08× | 🟢 1.03× | 🟢 1.38× | 🟢 1.24× | 🟢 1.09× |
| WoodFloor004 2K Normal | 🟢 1.09× | 🟢 1.04× | 🟢 1.40× | 🟢 1.23× | 🟢 1.18× |
| WoodFloor004 4K Normal | 🟢 1.19× | 🟢 1.04× | **🟢 1.73×** | 🟢 1.35× | 🟢 1.11× |
| WoodFloor004 1K Roughness | 🟢 1.07× | 🟢 1.04× | 🟢 1.37× | **🟢 14.62×** | **🟢 1.99×** |
| WoodFloor004 2K Roughness | 🟢 1.10× | 🟢 1.06× | **🟢 1.72×** | **🟢 16.42×** | **🟢 1.91×** |
| WoodFloor004 4K Roughness | 🟢 1.15× | 🟢 1.03× | **🟢 2.22×** | **🟢 24.58×** | **🟢 2.83×** |

<!-- RESULTS:END -->

## Run it

```sh
npm install
# add the spark.js shaders to shaders/spark/ (see shaders/spark/README.md)
npm run bench    # runs the benchmark in Chrome, writes results.json
npm run report   # updates the tables in this README
npm run compare  # visual side-by-side quality comparison
```

Requires Node 18+, Google Chrome, and a GPU with WebGPU.

## License

MIT. The spark.js shaders are proprietary ([EULA](https://ludicon.com/sparkjs/eula.html)). They are
used locally for comparison only and are not included in this repository. Textures are from
AmbientCG (CC0), plus a few of this repo's own.
