# spark.js shaders (not committed)

The spark.js `.wgsl` shaders are **proprietary** — their use is covered by the
[spark.js EULA](https://ludicon.com/sparkjs/eula.html). They are therefore **gitignored**
and not redistributed in this repo. The benchmark reads them locally.

To run the benchmark, place these files here (from
[Ludicon/spark.js `src/shaders/`](https://github.com/Ludicon/spark.js/tree/main/src/shaders)):

```
spark_bc1_rgb.wgsl
spark_bc5_rg.wgsl
spark_bc7_rgb.wgsl
spark_bc7_rgba.wgsl
spark_astc_rgb.wgsl
spark_astc_rgba.wgsl
spark_etc2_rgb.wgsl
```

e.g.:

```sh
git clone --depth 1 https://github.com/Ludicon/spark.js /tmp/spark
cp /tmp/spark/src/shaders/spark_{bc1_rgb,bc5_rg,bc7_rgb,bc7_rgba,astc_rgb,astc_rgba,etc2_rgb}.wgsl .
```
