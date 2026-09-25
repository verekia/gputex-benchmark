# gputex vs spark.js

A benchmark of the WebGPU texture-compression shaders in [gputex](https://github.com/verekia/gputex)
and [spark.js](https://github.com/Ludicon/spark.js). It covers the five formats both libraries
support: BC1, BC5, BC7, ASTC 4×4 and ETC2. It measures speed (GPU encode time) and quality (PSNR)
on 34 textures, from 256² to 4096²: PBR material maps (colour, normal, roughness, AO, displacement)
and a packed-materials atlas.

gputex 0.13.0 · Apple M3 · Chrome (WebGPU / Metal)

## Summary

<!-- SUMMARY:START -->
Median across the 34-texture suite. 🟢 gputex ahead · ⚡️ spark ahead · ⚪️ even = within 3%.

| format | Speed | Quality |
|---|---|---|
| **BC1** | **🟢 17×** | 🟢 1.17× |
| **BC5** | 🟢 1.45× | 🟢 1.04× |
| **BC7** | 🟢 1.27× | 🟢 1.43× |
| **ASTC** | 🟢 1.24× | **🟢 1.69×** |
| **ETC2** | 🟢 1.17× | 🟢 1.27× |
<!-- SUMMARY:END -->

## Full results

<!-- RESULTS:START -->
### Speed

How many times faster the winner encodes.

| texture | BC1 | BC5 | BC7 | ASTC | ETC2 |
|---|---|---|---|---|---|
| color 1K | **🟢 56×** | 🟢 1.36× | 🟢 1.30× | 🟢 1.32× | 🟢 1.04× |
| normal 1K | **🟢 72×** | 🟢 1.30× | 🟢 1.29× | 🟢 1.23× | 🟢 1.31× |
| alpha card 512 | N/A | N/A | 🟢 1.14× | 🟢 1.07× | N/A |
| packed 256 | **🟢 7.80×** | 🟢 1.32× | 🟢 1.18× | 🟢 1.11× | 🟢 1.20× |
| packed 512 | **🟢 12×** | 🟢 1.40× | 🟢 1.21× | 🟢 1.16× | 🟢 1.21× |
| packed 1K | **🟢 14×** | 🟢 1.43× | 🟢 1.25× | 🟢 1.19× | 🟢 1.24× |
| packed 2K | **🟢 23×** | 🟢 1.47× | 🟢 1.24× | 🟢 1.15× | 🟢 1.46× |
| packed 4K | **🟢 37×** | 🟢 1.39× | 🟢 1.21× | 🟢 1.15× | ⚪️ even |
| Rock064 1K AO | **🟢 23×** | 🟢 1.45× | **🟢 2.14×** | **🟢 2.20×** | 🟢 1.05× |
| Rock064 2K AO | **🟢 25×** | 🟢 1.44× | **🟢 2.17×** | **🟢 2.22×** | ⚪️ even |
| Rock064 4K AO | **🟢 25×** | 🟢 1.41× | **🟢 2.17×** | **🟢 2.25×** | ⚪️ even |
| Rock064 1K Color | **🟢 12×** | 🟢 1.46× | 🟢 1.24× | 🟢 1.24× | 🟢 1.21× |
| Rock064 2K Color | **🟢 12×** | 🟢 1.49× | 🟢 1.27× | 🟢 1.24× | 🟢 1.25× |
| Rock064 4K Color | **🟢 11×** | **🟢 1.55×** | 🟢 1.27× | 🟢 1.23× | 🟢 1.25× |
| Rock064 1K Displacement | **🟢 35×** | 🟢 1.29× | **🟢 2.18×** | **🟢 2.19×** | ⚡️ 1.25× |
| Rock064 2K Displacement | **🟢 57×** | 🟢 1.23× | **🟢 2.02×** | **🟢 2.15×** | ⚡️ 1.28× |
| Rock064 4K Displacement | **🟢 92×** | 🟢 1.23× | **🟢 2.17×** | **🟢 2.27×** | ⚡️ 1.41× |
| Rock064 1K Normal | **🟢 13×** | 🟢 1.45× | 🟢 1.23× | 🟢 1.18× | 🟢 1.20× |
| Rock064 2K Normal | **🟢 13×** | **🟢 1.53×** | 🟢 1.26× | 🟢 1.19× | 🟢 1.18× |
| Rock064 4K Normal | **🟢 12×** | **🟢 1.55×** | 🟢 1.24× | 🟢 1.20× | 🟢 1.19× |
| Rock064 1K Roughness | **🟢 14×** | 🟢 1.50× | **🟢 2.11×** | **🟢 2.17×** | 🟢 1.13× |
| Rock064 2K Roughness | **🟢 16×** | 🟢 1.49× | **🟢 2.20×** | **🟢 2.22×** | 🟢 1.13× |
| Rock064 4K Roughness | **🟢 17×** | **🟢 1.53×** | **🟢 2.15×** | **🟢 2.27×** | 🟢 1.13× |
| WoodFloor004 1K Color | **🟢 18×** | 🟢 1.45× | 🟢 1.15× | 🟢 1.15× | 🟢 1.25× |
| WoodFloor004 2K Color | **🟢 22×** | 🟢 1.46× | 🟢 1.17× | 🟢 1.17× | 🟢 1.32× |
| WoodFloor004 4K Color | **🟢 33×** | 🟢 1.40× | 🟢 1.18× | 🟢 1.17× | 🟢 1.16× |
| WoodFloor004 1K Displacement | **🟢 16×** | 🟢 1.50× | **🟢 2.14×** | **🟢 2.18×** | 🟢 1.12× |
| WoodFloor004 2K Displacement | **🟢 27×** | 🟢 1.44× | **🟢 2.18×** | **🟢 2.21×** | ⚡️ 1.29× |
| WoodFloor004 4K Displacement | **🟢 38×** | 🟢 1.33× | **🟢 2.19×** | **🟢 2.25×** | ⚡️ 1.27× |
| WoodFloor004 1K Normal | **🟢 15×** | 🟢 1.44× | 🟢 1.26× | 🟢 1.17× | 🟢 1.26× |
| WoodFloor004 2K Normal | **🟢 16×** | 🟢 1.47× | 🟢 1.27× | 🟢 1.20× | 🟢 1.27× |
| WoodFloor004 4K Normal | **🟢 13×** | **🟢 1.56×** | 🟢 1.23× | 🟢 1.23× | 🟢 1.21× |
| WoodFloor004 1K Roughness | **🟢 18×** | 🟢 1.50× | **🟢 2.14×** | **🟢 2.19×** | 🟢 1.14× |
| WoodFloor004 2K Roughness | **🟢 21×** | **🟢 1.52×** | **🟢 2.17×** | **🟢 2.24×** | 🟢 1.19× |
| WoodFloor004 4K Roughness | **🟢 14×** | 🟢 1.49× | **🟢 2.21×** | **🟢 2.26×** | ⚡️ 1.17× |

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
