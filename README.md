# gputex vs spark.js

A benchmark of the WebGPU texture-compression shaders in [gputex](https://github.com/verekia/gputex)
and [spark.js](https://github.com/Ludicon/spark.js). It covers the seven formats both libraries
support: BC1, BC4, BC5, BC7, ASTC 4×4, ETC2 and EAC R11. It measures speed (GPU encode time) and
quality (PSNR) on 34 textures, from 256² to 4096²: PBR material maps (colour, normal, roughness, AO,
displacement) and a packed-materials atlas. The one-channel formats (BC4, EAC R11) encode and are
scored on the R channel.

gputex 0.16.0 · Apple M3 · Chrome 157 (WebGPU / Metal)

## Summary

<!-- SUMMARY:START -->
Median across the 34-texture suite. 🟢 gputex ahead · ⚡️ spark ahead · ⚪️ even = within 3%.

| format | Speed | Quality |
|---|---|---|
| **BC1** | **🟢 19×** | 🟢 1.17× |
| **BC4** | 🟢 1.35× | 🟢 1.04× |
| **BC5** | 🟢 1.41× | 🟢 1.04× |
| **BC7** | 🟢 1.28× | 🟢 1.43× |
| **ASTC** | 🟢 1.32× | **🟢 1.69×** |
| **ETC2** | 🟢 1.19× | 🟢 1.27× |
| **EAC R11** | 🟢 1.12× | **🟢 2.42×** |

ASTC: like `compressTexture`, gputex runs its opaque-source kernel on the 31 files that cannot carry alpha (JPEG, RGB PNG) and its general kernel on the RGBA files (color 1K, normal 1K and packed 1K) and the alpha card.
<!-- SUMMARY:END -->

## Full results

<!-- RESULTS:START -->
### Speed

How many times faster the winner encodes.

| texture | BC1 | BC4 | BC5 | BC7 | ASTC | ETC2 | EAC R11 |
|---|---|---|---|---|---|---|---|
| color 1K | **🟢 56×** | 🟢 1.36× | 🟢 1.36× | 🟢 1.31× | 🟢 1.32× | 🟢 1.06× | 🟢 1.13× |
| normal 1K | **🟢 74×** | 🟢 1.39× | 🟢 1.32× | 🟢 1.28× | 🟢 1.21× | 🟢 1.31× | 🟢 1.12× |
| alpha card 512 | N/A | N/A | N/A | 🟢 1.16× | 🟢 1.06× | N/A | N/A |
| packed 256 | **🟢 7.70×** | 🟢 1.21× | 🟢 1.34× | 🟢 1.21× | 🟢 1.20× | 🟢 1.23× | 🟢 1.10× |
| packed 512 | **🟢 14×** | 🟢 1.34× | 🟢 1.40× | 🟢 1.20× | 🟢 1.26× | 🟢 1.21× | 🟢 1.08× |
| packed 1K | **🟢 16×** | 🟢 1.23× | 🟢 1.40× | 🟢 1.23× | 🟢 1.17× | 🟢 1.27× | 🟢 1.12× |
| packed 2K | **🟢 26×** | ⚪️ even | 🟢 1.09× | 🟢 1.23× | 🟢 1.24× | 🟢 1.31× | 🟢 1.04× |
| packed 4K | **🟢 43×** | ⚪️ even | 🟢 1.05× | 🟢 1.17× | 🟢 1.26× | ⚪️ even | 🟢 1.10× |
| Rock064 1K AO | **🟢 23×** | 🟢 1.41× | 🟢 1.41× | **🟢 2.15×** | **🟢 2.43×** | 🟢 1.10× | 🟢 1.13× |
| Rock064 2K AO | **🟢 26×** | 🟢 1.42× | 🟢 1.37× | **🟢 1.68×** | **🟢 1.97×** | 🟢 1.06× | 🟢 1.12× |
| Rock064 4K AO | **🟢 28×** | 🟢 1.38× | 🟢 1.45× | **🟢 2.11×** | **🟢 2.29×** | ⚪️ even | 🟢 1.12× |
| Rock064 1K Color | **🟢 15×** | ⚪️ even | 🟢 1.39× | 🟢 1.25× | 🟢 1.32× | 🟢 1.26× | 🟢 1.11× |
| Rock064 2K Color | **🟢 15×** | 🟢 1.03× | ⚪️ even | 🟢 1.25× | 🟢 1.22× | 🟢 1.06× | ⚪️ even |
| Rock064 4K Color | **🟢 14×** | 🟢 1.14× | 🟢 1.42× | 🟢 1.26× | 🟢 1.35× | 🟢 1.26× | ⚪️ even |
| Rock064 1K Displacement | **🟢 40×** | 🟢 1.26× | 🟢 1.27× | **🟢 2.23×** | **🟢 2.49×** | ⚡️ 1.21× | 🟢 1.13× |
| Rock064 2K Displacement | **🟢 72×** | 🟢 1.24× | 🟢 1.19× | **🟢 1.85×** | **🟢 2.13×** | ⚡️ 1.22× | 🟢 1.13× |
| Rock064 4K Displacement | **🟢 104×** | 🟢 1.24× | 🟢 1.25× | **🟢 1.90×** | **🟢 2.59×** | ⚡️ 1.31× | 🟢 1.12× |
| Rock064 1K Normal | **🟢 16×** | 🟢 1.10× | 🟢 1.41× | 🟢 1.23× | 🟢 1.27× | 🟢 1.22× | 🟢 1.11× |
| Rock064 2K Normal | **🟢 16×** | 🟢 1.07× | ⚪️ even | 🟢 1.23× | 🟢 1.29× | 🟢 1.18× | ⚪️ even |
| Rock064 4K Normal | **🟢 16×** | 🟢 1.12× | 🟢 1.41× | 🟢 1.25× | 🟢 1.30× | 🟢 1.17× | ⚪️ even |
| Rock064 1K Roughness | **🟢 16×** | 🟢 1.47× | 🟢 1.47× | **🟢 2.11×** | **🟢 2.45×** | 🟢 1.19× | 🟢 1.13× |
| Rock064 2K Roughness | **🟢 16×** | **🟢 1.50×** | 🟢 1.42× | **🟢 1.81×** | **🟢 2.14×** | 🟢 1.19× | 🟢 1.12× |
| Rock064 4K Roughness | **🟢 17×** | **🟢 1.59×** | **🟢 1.51×** | **🟢 1.87×** | **🟢 2.08×** | 🟢 1.18× | 🟢 1.13× |
| WoodFloor004 1K Color | **🟢 21×** | 🟢 1.41× | 🟢 1.42× | 🟢 1.16× | 🟢 1.23× | 🟢 1.25× | 🟢 1.12× |
| WoodFloor004 2K Color | **🟢 24×** | 🟢 1.37× | 🟢 1.16× | 🟢 1.15× | 🟢 1.24× | 🟢 1.31× | 🟢 1.10× |
| WoodFloor004 4K Color | **🟢 36×** | 🟢 1.39× | 🟢 1.33× | 🟢 1.19× | 🟢 1.31× | 🟢 1.15× | 🟢 1.14× |
| WoodFloor004 1K Displacement | **🟢 18×** | 🟢 1.43× | 🟢 1.46× | **🟢 2.16×** | **🟢 2.47×** | 🟢 1.17× | 🟢 1.13× |
| WoodFloor004 2K Displacement | **🟢 28×** | 🟢 1.43× | 🟢 1.43× | **🟢 1.78×** | **🟢 2.22×** | ⚡️ 1.24× | 🟢 1.14× |
| WoodFloor004 4K Displacement | **🟢 39×** | 🟢 1.32× | 🟢 1.34× | **🟢 1.88×** | **🟢 2.54×** | ⚡️ 1.21× | 🟢 1.14× |
| WoodFloor004 1K Normal | **🟢 16×** | 🟢 1.32× | 🟢 1.43× | 🟢 1.26× | 🟢 1.25× | 🟢 1.30× | 🟢 1.11× |
| WoodFloor004 2K Normal | **🟢 16×** | 🟢 1.12× | 🟢 1.41× | 🟢 1.28× | 🟢 1.26× | 🟢 1.32× | 🟢 1.13× |
| WoodFloor004 4K Normal | **🟢 15×** | 🟢 1.38× | **🟢 1.52×** | 🟢 1.23× | 🟢 1.35× | 🟢 1.27× | 🟢 1.13× |
| WoodFloor004 1K Roughness | **🟢 20×** | 🟢 1.46× | 🟢 1.47× | **🟢 2.12×** | **🟢 2.47×** | 🟢 1.19× | 🟢 1.13× |
| WoodFloor004 2K Roughness | **🟢 21×** | 🟢 1.48× | 🟢 1.50× | **🟢 2.02×** | **🟢 2.32×** | 🟢 1.21× | 🟢 1.13× |
| WoodFloor004 4K Roughness | **🟢 15×** | 🟢 1.48× | **🟢 1.52×** | **🟢 1.94×** | **🟢 2.47×** | ⚡️ 1.09× | 🟢 1.13× |

### Quality

How many times more error (MSE) the loser has.

| texture | BC1 | BC4 | BC5 | BC7 | ASTC | ETC2 | EAC R11 |
|---|---|---|---|---|---|---|---|
| color 1K | 🟢 1.09× | 🟢 1.05× | 🟢 1.04× | **🟢 1.51×** | **🟢 1.52×** | 🟢 1.12× | **🟢 2.25×** |
| normal 1K | 🟢 1.07× | **🟢 2.44×** | 🟢 1.05× | **🟢 1.86×** | **🟢 2.37×** | 🟢 1.43× | **🟢 9.22×** |
| alpha card 512 | N/A | N/A | N/A | **🟢 3.65×** | **🟢 1.53×** | N/A | N/A |
| packed 256 | 🟢 1.33× | 🟢 1.03× | 🟢 1.03× | **🟢 1.87×** | **🟢 1.57×** | 🟢 1.30× | **🟢 1.83×** |
| packed 512 | 🟢 1.40× | 🟢 1.03× | ⚪️ even | **🟢 2.14×** | **🟢 1.69×** | 🟢 1.32× | **🟢 1.99×** |
| packed 1K | 🟢 1.37× | ⚪️ even | 🟢 1.03× | **🟢 2.24×** | **🟢 1.77×** | 🟢 1.28× | **🟢 2.34×** |
| packed 2K | 🟢 1.18× | 🟢 1.05× | 🟢 1.04× | 🟢 1.29× | **🟢 1.65×** | **🟢 1.61×** | **🟢 2.21×** |
| packed 4K | 🟢 1.21× | 🟢 1.09× | 🟢 1.08× | 🟢 1.34× | **🟢 1.64×** | **🟢 1.54×** | **🟢 1.97×** |
| Rock064 1K AO | 🟢 1.27× | 🟢 1.04× | 🟢 1.04× | 🟢 1.45× | **🟢 18.01×** | **🟢 1.70×** | **🟢 2.52×** |
| Rock064 2K AO | 🟢 1.25× | 🟢 1.05× | 🟢 1.05× | 🟢 1.43× | **🟢 17.60×** | **🟢 1.60×** | **🟢 2.29×** |
| Rock064 4K AO | 🟢 1.26× | 🟢 1.05× | 🟢 1.05× | 🟢 1.46× | **🟢 17.77×** | **🟢 1.51×** | **🟢 2.20×** |
| Rock064 1K Color | 🟢 1.19× | ⚪️ even | ⚪️ even | 🟢 1.12× | **🟢 1.58×** | 🟢 1.11× | **🟢 2.54×** |
| Rock064 2K Color | 🟢 1.17× | ⚪️ even | ⚪️ even | 🟢 1.14× | **🟢 1.57×** | 🟢 1.07× | **🟢 2.49×** |
| Rock064 4K Color | 🟢 1.14× | ⚪️ even | ⚪️ even | 🟢 1.18× | **🟢 1.62×** | ⚪️ even | **🟢 2.33×** |
| Rock064 1K Displacement | 🟢 1.34× | 🟢 1.29× | 🟢 1.27× | **🟢 6.85×** | **🟢 52.54×** | 🟢 1.24× | **🟢 1.99×** |
| Rock064 2K Displacement | **🟢 1.54×** | **🟢 1.93×** | **🟢 1.81×** | **🟢 29.96×** | **🟢 111.32×** | 🟢 1.22× | **🟢 2.13×** |
| Rock064 4K Displacement | **🟢 1.86×** | **🟢 3.08×** | **🟢 2.46×** | **🟢 104.95×** | **🟢 194.45×** | 🟢 1.25× | **🟢 2.61×** |
| Rock064 1K Normal | 🟢 1.15× | 🟢 1.04× | ⚪️ even | 🟢 1.26× | 🟢 1.34× | 🟢 1.23× | **🟢 2.27×** |
| Rock064 2K Normal | 🟢 1.16× | 🟢 1.03× | ⚪️ even | 🟢 1.23× | 🟢 1.34× | 🟢 1.20× | **🟢 2.06×** |
| Rock064 4K Normal | 🟢 1.16× | 🟢 1.03× | ⚪️ even | 🟢 1.21× | 🟢 1.34× | 🟢 1.22× | **🟢 1.88×** |
| Rock064 1K Roughness | 🟢 1.06× | 🟢 1.04× | ⚪️ even | 🟢 1.18× | **🟢 15.68×** | **🟢 1.62×** | **🟢 2.71×** |
| Rock064 2K Roughness | 🟢 1.06× | 🟢 1.04× | ⚪️ even | 🟢 1.18× | **🟢 15.22×** | **🟢 1.55×** | **🟢 2.78×** |
| Rock064 4K Roughness | 🟢 1.06× | 🟢 1.04× | ⚪️ even | 🟢 1.19× | **🟢 15.21×** | **🟢 1.53×** | **🟢 2.94×** |
| WoodFloor004 1K Color | 🟢 1.12× | 🟢 1.08× | 🟢 1.06× | 🟢 1.23× | 🟢 1.47× | 🟢 1.10× | **🟢 3.53×** |
| WoodFloor004 2K Color | 🟢 1.17× | 🟢 1.09× | 🟢 1.09× | 🟢 1.26× | 🟢 1.47× | 🟢 1.12× | **🟢 2.62×** |
| WoodFloor004 4K Color | 🟢 1.23× | 🟢 1.17× | 🟢 1.15× | 🟢 1.32× | **🟢 1.56×** | 🟢 1.13× | **🟢 2.30×** |
| WoodFloor004 1K Displacement | 🟢 1.14× | 🟢 1.07× | 🟢 1.07× | **🟢 2.19×** | **🟢 16.73×** | **🟢 2.03×** | **🟢 5.88×** |
| WoodFloor004 2K Displacement | 🟢 1.21× | 🟢 1.21× | 🟢 1.20× | **🟢 4.85×** | **🟢 39.93×** | 🟢 1.36× | **🟢 4.22×** |
| WoodFloor004 4K Displacement | 🟢 1.33× | **🟢 1.65×** | **🟢 1.65×** | **🟢 14.84×** | **🟢 309.66×** | 🟢 1.19× | **🟢 1.95×** |
| WoodFloor004 1K Normal | 🟢 1.08× | 🟢 1.03× | 🟢 1.03× | 🟢 1.38× | 🟢 1.24× | 🟢 1.09× | **🟢 2.93×** |
| WoodFloor004 2K Normal | 🟢 1.09× | 🟢 1.04× | 🟢 1.04× | 🟢 1.40× | 🟢 1.23× | 🟢 1.18× | **🟢 3.30×** |
| WoodFloor004 4K Normal | 🟢 1.19× | 🟢 1.03× | 🟢 1.04× | **🟢 1.73×** | 🟢 1.36× | 🟢 1.11× | **🟢 2.64×** |
| WoodFloor004 1K Roughness | 🟢 1.07× | 🟢 1.05× | 🟢 1.04× | 🟢 1.37× | **🟢 14.62×** | **🟢 1.99×** | **🟢 3.30×** |
| WoodFloor004 2K Roughness | 🟢 1.10× | 🟢 1.07× | 🟢 1.06× | **🟢 1.72×** | **🟢 16.42×** | **🟢 1.91×** | **🟢 2.56×** |
| WoodFloor004 4K Roughness | 🟢 1.15× | 🟢 1.04× | 🟢 1.03× | **🟢 2.22×** | **🟢 24.58×** | **🟢 2.83×** | **🟢 2.09×** |

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
