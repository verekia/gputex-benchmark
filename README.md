# gputex vs spark.js

A benchmark of the WebGPU texture-compression shaders in [gputex](https://github.com/verekia/gputex)
and [spark.js](https://github.com/Ludicon/spark.js). It covers the five formats both libraries
support: BC1, BC5, BC7, ASTC 4×4 and ETC2. It measures speed (GPU encode time) and quality (PSNR)
on 34 textures, from 256² to 4096²: PBR material maps (colour, normal, roughness, AO, displacement)
and a packed-materials atlas.

gputex 0.10.0 · Apple M3 · Chrome (WebGPU / Metal)

## Summary

<!-- SUMMARY:START -->
Median across the 34-texture suite. 🟢 gputex ahead · ⚡️ spark ahead · ⚪️ even = within 3%.

| format | Speed | Quality |
|---|---|---|
| **BC1** | **🟢 16×** | 🟢 1.17× |
| **BC5** | 🟢 1.38× | 🟢 1.04× |
| **BC7** | 🟢 1.28× | 🟢 1.19× |
| **ASTC** | 🟢 1.19× | **🟢 1.69×** |
| **ETC2** | ⚪️ even | 🟢 1.27× |
<!-- SUMMARY:END -->

## Full results

<!-- RESULTS:START -->
### Speed

How many times faster the winner encodes.

| texture | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|
| color 1K | **🟢 47×** | 🟢 1.32× | 🟢 1.18× | 🟢 1.27× | ⚡️ 1.13× |
| normal 1K | **🟢 64×** | 🟢 1.25× | 🟢 1.23× | 🟢 1.19× | 🟢 1.09× |
| alpha card 512 | N/A | N/A | 🟢 1.17× | 🟢 1.06× | N/A |
| packed 256 | **🟢 7.54×** | 🟢 1.29× | 🟢 1.22× | 🟢 1.08× | 🟢 1.08× |
| packed 512 | **🟢 11×** | 🟢 1.34× | 🟢 1.23× | 🟢 1.13× | 🟢 1.04× |
| packed 1K | **🟢 13×** | 🟢 1.34× | 🟢 1.27× | 🟢 1.15× | 🟢 1.04× |
| packed 2K | **🟢 22×** | 🟢 1.33× | 🟢 1.23× | 🟢 1.10× | 🟢 1.23× |
| packed 4K | **🟢 39×** | 🟢 1.29× | 🟢 1.06× | 🟢 1.11× | ⚡️ 1.15× |
| Rock064 1K AO | **🟢 21×** | 🟢 1.38× | **🟢 2.13×** | **🟢 2.18×** | ⚡️ 1.05× |
| Rock064 2K AO | **🟢 23×** | 🟢 1.34× | **🟢 2.06×** | **🟢 2.07×** | ⚡️ 1.10× |
| Rock064 4K AO | **🟢 24×** | 🟢 1.29× | **🟢 2.19×** | **🟢 2.16×** | ⚡️ 1.14× |
| Rock064 1K Color | **🟢 11×** | 🟢 1.40× | 🟢 1.28× | 🟢 1.18× | 🟢 1.04× |
| Rock064 2K Color | **🟢 11×** | 🟢 1.43× | 🟢 1.30× | 🟢 1.20× | 🟢 1.12× |
| Rock064 4K Color | **🟢 10×** | 🟢 1.42× | 🟢 1.28× | 🟢 1.18× | 🟢 1.05× |
| Rock064 1K Displacement | **🟢 35×** | 🟢 1.22× | **🟢 2.20×** | **🟢 2.19×** | ⚡️ 1.40× |
| Rock064 2K Displacement | **🟢 53×** | 🟢 1.17× | **🟢 2.12×** | **🟢 2.18×** | ⚡️ 1.43× |
| Rock064 4K Displacement | **🟢 87×** | 🟢 1.14× | **🟢 2.16×** | **🟢 2.13×** | **⚡️ 1.55×** |
| Rock064 1K Normal | **🟢 12×** | 🟢 1.39× | 🟢 1.25× | 🟢 1.14× | ⚪️ even |
| Rock064 2K Normal | **🟢 12×** | 🟢 1.46× | 🟢 1.26× | 🟢 1.16× | ⚪️ even |
| Rock064 4K Normal | **🟢 11×** | 🟢 1.38× | 🟢 1.27× | 🟢 1.17× | ⚪️ even |
| Rock064 1K Roughness | **🟢 13×** | 🟢 1.42× | **🟢 2.14×** | **🟢 2.16×** | ⚪️ even |
| Rock064 2K Roughness | **🟢 15×** | 🟢 1.44× | **🟢 2.14×** | **🟢 2.18×** | ⚪️ even |
| Rock064 4K Roughness | **🟢 15×** | 🟢 1.41× | **🟢 2.20×** | **🟢 2.16×** | ⚪️ even |
| WoodFloor004 1K Color | **🟢 17×** | 🟢 1.38× | ⚪️ even | 🟢 1.10× | 🟢 1.05× |
| WoodFloor004 2K Color | **🟢 20×** | 🟢 1.41× | ⚪️ even | 🟢 1.10× | 🟢 1.10× |
| WoodFloor004 4K Color | **🟢 33×** | 🟢 1.26× | ⚪️ even | 🟢 1.14× | ⚡️ 1.05× |
| WoodFloor004 1K Displacement | **🟢 16×** | 🟢 1.41× | **🟢 2.15×** | **🟢 2.17×** | ⚪️ even |
| WoodFloor004 2K Displacement | **🟢 24×** | 🟢 1.38× | **🟢 2.03×** | **🟢 2.10×** | ⚡️ 1.41× |
| WoodFloor004 4K Displacement | **🟢 34×** | 🟢 1.22× | **🟢 2.24×** | **🟢 2.23×** | ⚡️ 1.47× |
| WoodFloor004 1K Normal | **🟢 14×** | 🟢 1.37× | 🟢 1.28× | 🟢 1.13× | 🟢 1.04× |
| WoodFloor004 2K Normal | **🟢 14×** | 🟢 1.42× | 🟢 1.27× | 🟢 1.17× | 🟢 1.07× |
| WoodFloor004 4K Normal | **🟢 11×** | 🟢 1.41× | 🟢 1.24× | 🟢 1.18× | 🟢 1.03× |
| WoodFloor004 1K Roughness | **🟢 17×** | 🟢 1.42× | **🟢 2.12×** | **🟢 2.17×** | ⚪️ even |
| WoodFloor004 2K Roughness | **🟢 20×** | 🟢 1.43× | **🟢 2.15×** | **🟢 2.20×** | 🟢 1.06× |
| WoodFloor004 4K Roughness | **🟢 13×** | 🟢 1.40× | **🟢 2.14×** | **🟢 2.21×** | ⚡️ 1.30× |

### Quality

How many times more error (MSE) the loser has.

| texture | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|
| color 1K | 🟢 1.09× | 🟢 1.04× | **⚡️ 1.68×** | **🟢 1.52×** | 🟢 1.12× |
| normal 1K | 🟢 1.07× | 🟢 1.05× | ⚡️ 1.18× | **🟢 2.37×** | 🟢 1.43× |
| alpha card 512 | N/A | N/A | **🟢 1.52×** | **🟢 1.53×** | N/A |
| packed 256 | 🟢 1.33× | 🟢 1.03× | ⚡️ 1.47× | **🟢 1.57×** | 🟢 1.30× |
| packed 512 | 🟢 1.40× | ⚪️ even | ⚡️ 1.28× | **🟢 1.69×** | 🟢 1.32× |
| packed 1K | 🟢 1.37× | 🟢 1.03× | ⚡️ 1.12× | **🟢 1.77×** | 🟢 1.28× |
| packed 2K | 🟢 1.18× | 🟢 1.04× | ⚪️ even | **🟢 1.65×** | **🟢 1.61×** |
| packed 4K | 🟢 1.21× | 🟢 1.08× | 🟢 1.26× | **🟢 1.64×** | **🟢 1.54×** |
| Rock064 1K AO | 🟢 1.27× | 🟢 1.04× | 🟢 1.45× | **🟢 18.01×** | **🟢 1.70×** |
| Rock064 2K AO | 🟢 1.25× | 🟢 1.05× | 🟢 1.43× | **🟢 17.60×** | **🟢 1.60×** |
| Rock064 4K AO | 🟢 1.26× | 🟢 1.05× | 🟢 1.46× | **🟢 17.77×** | **🟢 1.51×** |
| Rock064 1K Color | 🟢 1.19× | ⚪️ even | ⚡️ 1.48× | **🟢 1.58×** | 🟢 1.11× |
| Rock064 2K Color | 🟢 1.17× | ⚪️ even | ⚡️ 1.29× | **🟢 1.57×** | 🟢 1.07× |
| Rock064 4K Color | 🟢 1.14× | ⚪️ even | ⚡️ 1.10× | **🟢 1.62×** | ⚪️ even |
| Rock064 1K Displacement | 🟢 1.34× | 🟢 1.27× | **🟢 6.85×** | **🟢 52.54×** | 🟢 1.24× |
| Rock064 2K Displacement | **🟢 1.54×** | **🟢 1.81×** | **🟢 29.96×** | **🟢 111.32×** | 🟢 1.22× |
| Rock064 4K Displacement | **🟢 1.86×** | **🟢 2.46×** | **🟢 104.95×** | **🟢 194.45×** | 🟢 1.25× |
| Rock064 1K Normal | 🟢 1.15× | ⚪️ even | **⚡️ 1.86×** | 🟢 1.33× | 🟢 1.23× |
| Rock064 2K Normal | 🟢 1.16× | ⚪️ even | **⚡️ 2.12×** | 🟢 1.33× | 🟢 1.20× |
| Rock064 4K Normal | 🟢 1.16× | ⚪️ even | **⚡️ 2.30×** | 🟢 1.33× | 🟢 1.22× |
| Rock064 1K Roughness | 🟢 1.06× | ⚪️ even | 🟢 1.18× | **🟢 15.68×** | **🟢 1.62×** |
| Rock064 2K Roughness | 🟢 1.06× | ⚪️ even | 🟢 1.18× | **🟢 15.22×** | **🟢 1.55×** |
| Rock064 4K Roughness | 🟢 1.06× | ⚪️ even | 🟢 1.19× | **🟢 15.21×** | **🟢 1.53×** |
| WoodFloor004 1K Color | 🟢 1.12× | 🟢 1.06× | 🟢 1.23× | 🟢 1.47× | 🟢 1.10× |
| WoodFloor004 2K Color | 🟢 1.17× | 🟢 1.09× | 🟢 1.27× | 🟢 1.47× | 🟢 1.12× |
| WoodFloor004 4K Color | 🟢 1.23× | 🟢 1.15× | 🟢 1.33× | **🟢 1.56×** | 🟢 1.13× |
| WoodFloor004 1K Displacement | 🟢 1.14× | 🟢 1.07× | **🟢 2.19×** | **🟢 16.73×** | **🟢 2.03×** |
| WoodFloor004 2K Displacement | 🟢 1.21× | 🟢 1.20× | **🟢 4.85×** | **🟢 39.93×** | 🟢 1.36× |
| WoodFloor004 4K Displacement | 🟢 1.33× | **🟢 1.65×** | **🟢 14.84×** | **🟢 309.66×** | 🟢 1.19× |
| WoodFloor004 1K Normal | 🟢 1.08× | 🟢 1.03× | ⚡️ 1.28× | 🟢 1.24× | 🟢 1.09× |
| WoodFloor004 2K Normal | 🟢 1.09× | 🟢 1.04× | ⚡️ 1.22× | 🟢 1.23× | 🟢 1.18× |
| WoodFloor004 4K Normal | 🟢 1.19× | 🟢 1.04× | **⚡️ 1.62×** | 🟢 1.35× | 🟢 1.11× |
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
