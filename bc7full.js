// bc7full.js — a small BC7 software decoder covering modes 1, 4, 5 and 6. That
// covers every block either library produces here: gputex emits mode 6 (and
// mode 1 is decoded too, kept as a cheap safety net), spark emits modes 4 and 6.
// The other modes (0/2/3/7) are NOT decoded — decodeBC7Full throws on them, and
// the caller checks the mode histogram so a stray mode can never be mis-scored.
//
// Bit layout follows the D3D11 BC7 spec (LSB-first over the 128-bit little-
// endian block), matching gputex's own reference decoders in refcodec.js — the
// two are cross-checked at run time (must agree bit-for-bit on gputex's output).
// Interpolation is the standard interp8: (a*(64-w)+b*w+32)>>6.
//
// Returns Float64Array(64): 16 pixels × [r,g,b,a] in [0,1].

const W2 = [0, 21, 43, 64]                                  // 2-bit index weights
const W3 = [0, 9, 18, 27, 37, 46, 55, 64]                   // 3-bit index weights
const W4 = [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64] // 4-bit

const interp8 = (a, b, w) => ((64 - w) * a + w * b + 32) >> 6
const ex5 = v => (v << 3) | (v >> 2)   // 5-bit → 8-bit
const ex6 = v => (v << 2) | (v >> 4)   // 6-bit → 8-bit
const ex7 = v => (v << 1) | (v >> 6)   // 7-bit → 8-bit

// Mode 1/3/7 two-subset partition patterns as 16-bit masks (bit k = subset of
// pixel k), and the second subset's anchor pixel per partition. Verbatim from
// gputex's bc7_ref.ts (cross-checked there against bc7enc's bc7decomp.cpp).
const BC7_PARTITION2 = [
  0xcccc, 0x8888, 0xeeee, 0xecc8, 0xc880, 0xfeec, 0xfec8, 0xec80,
  0xc800, 0xffec, 0xfe80, 0xe800, 0xffe8, 0xff00, 0xfff0, 0xf000,
  0xf710, 0x008e, 0x7100, 0x08ce, 0x008c, 0x7310, 0x3100, 0x8cce,
  0x088c, 0x3110, 0x6666, 0x366c, 0x17e8, 0x0ff0, 0x718e, 0x399c,
  0xaaaa, 0xf0f0, 0x5a5a, 0x33cc, 0x3c3c, 0x55aa, 0x9696, 0xa55a,
  0x73ce, 0x13c8, 0x324c, 0x3bdc, 0x6996, 0xc33c, 0x9966, 0x0660,
  0x0272, 0x04e4, 0x4e40, 0x2720, 0xc936, 0x936c, 0x39c6, 0x639c,
  0x9336, 0x9cc6, 0x817e, 0xe718, 0xccf0, 0x0fcc, 0x7744, 0xee22,
]
const BC7_ANCHOR2 = [
  15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
  15, 2, 8, 2, 2, 8, 8, 15, 2, 8, 2, 2, 8, 8, 2, 2,
  15, 15, 6, 8, 2, 8, 15, 15, 2, 8, 2, 2, 2, 15, 15, 6,
  6, 2, 6, 8, 15, 15, 2, 2, 15, 15, 15, 15, 15, 2, 2, 15,
]

// LSB-first bit reader over the 16-byte block (BigInt, matches BitReader128).
function reader(block) {
  let bits = 0n
  for (let i = 0; i < 16; i++) bits |= BigInt(block[i]) << BigInt(i * 8)
  let pos = 0n
  return n => { const v = Number((bits >> pos) & ((1n << BigInt(n)) - 1n)); pos += BigInt(n); return v }
}

function bc7Mode(block) {
  for (let m = 0; m < 8; m++) if ((block[0] >> m) & 1) return m
  return 8 // byte0 === 0 → invalid
}

// Apply BC7 rotation: swap the alpha channel with R/G/B (1/2/3), 0 = none.
function rotate(px, rot) {
  if (rot === 0) return
  const c = rot - 1 // 1→R(0) 2→G(1) 3→B(2)
  const t = px[3]; px[3] = px[c]; px[c] = t
}

// Mode 1: 2 subsets, 6-bit RGB endpoints + one shared p-bit per subset, 3-bit
// indices, no alpha (decodes to 255). Endpoints are channel-major (R×4, G×4,
// B×4); two anchor pixels (pixel 0 and BC7_ANCHOR2[part]) read one fewer bit.
function decodeMode1(r) {
  r(2) // mode
  const part = r(6)
  const ep = [[], [], [], []] // ep[e] = [R,G,B] for endpoint e (0,1 = subset0; 2,3 = subset1)
  for (let c = 0; c < 3; c++) for (let e = 0; e < 4; e++) ep[e].push(r(6))
  const p0 = r(1), p1 = r(1)
  const pb = [p0, p0, p1, p1]
  const e8 = ep.map((rgb, e) => rgb.map(v6 => { const v7 = (v6 << 1) | pb[e]; return (v7 << 1) | (v7 >> 6) }))
  const pal = [0, 1].map(s => {
    const lo = e8[s * 2], hi = e8[s * 2 + 1]
    return W3.map(w => [interp8(lo[0], hi[0], w), interp8(lo[1], hi[1], w), interp8(lo[2], hi[2], w)])
  })
  const anchor2 = BC7_ANCHOR2[part], mask = BC7_PARTITION2[part]
  const out = new Float64Array(64)
  for (let k = 0; k < 16; k++) {
    const w = r(k === 0 || k === anchor2 ? 2 : 3)
    const rgb = pal[(mask >> k) & 1][w]
    out[k * 4] = rgb[0] / 255; out[k * 4 + 1] = rgb[1] / 255; out[k * 4 + 2] = rgb[2] / 255; out[k * 4 + 3] = 1
  }
  return out
}

function decodeMode6(r) {
  r(7) // mode
  const R0 = r(7), R1 = r(7), G0 = r(7), G1 = r(7), B0 = r(7), B1 = r(7), A0 = r(7), A1 = r(7)
  const p0 = r(1), p1 = r(1)
  const e0 = [(R0 << 1) | p0, (G0 << 1) | p0, (B0 << 1) | p0, (A0 << 1) | p0]
  const e1 = [(R1 << 1) | p1, (G1 << 1) | p1, (B1 << 1) | p1, (A1 << 1) | p1]
  const out = new Float64Array(64)
  for (let i = 0; i < 16; i++) {
    const w = W4[r(i === 0 ? 3 : 4)] // pixel 0 is the anchor (MSB implicit 0)
    for (let c = 0; c < 4; c++) out[i * 4 + c] = interp8(e0[c], e1[c], w) / 255
  }
  return out
}

function decodeMode5(r) {
  r(6) // mode
  const rot = r(2)
  const R0 = r(7), R1 = r(7), G0 = r(7), G1 = r(7), B0 = r(7), B1 = r(7)
  const A0 = r(8), A1 = r(8)
  const e0 = [ex7(R0), ex7(G0), ex7(B0), A0]
  const e1 = [ex7(R1), ex7(G1), ex7(B1), A1]
  const ci = [], ai = []
  for (let i = 0; i < 16; i++) ci.push(r(i === 0 ? 1 : 2)) // color indices (2-bit)
  for (let i = 0; i < 16; i++) ai.push(r(i === 0 ? 1 : 2)) // alpha indices (2-bit)
  const out = new Float64Array(64)
  for (let i = 0; i < 16; i++) {
    const cw = W2[ci[i]], aw = W2[ai[i]]
    const px = [interp8(e0[0], e1[0], cw), interp8(e0[1], e1[1], cw), interp8(e0[2], e1[2], cw), interp8(e0[3], e1[3], aw)]
    rotate(px, rot)
    for (let c = 0; c < 4; c++) out[i * 4 + c] = px[c] / 255
  }
  return out
}

function decodeMode4(r) {
  r(5) // mode
  const rot = r(2)
  const idxMode = r(1)
  const R0 = r(5), R1 = r(5), G0 = r(5), G1 = r(5), B0 = r(5), B1 = r(5)
  const A0 = r(6), A1 = r(6)
  const e0 = [ex5(R0), ex5(G0), ex5(B0), ex6(A0)]
  const e1 = [ex5(R1), ex5(G1), ex5(B1), ex6(A1)]
  const i2 = [], i3 = []
  for (let i = 0; i < 16; i++) i2.push(r(i === 0 ? 1 : 2)) // primary 2-bit indices
  for (let i = 0; i < 16; i++) i3.push(r(i === 0 ? 2 : 3)) // secondary 3-bit indices
  const out = new Float64Array(64)
  for (let i = 0; i < 16; i++) {
    // idxMode 0: color=2-bit, alpha=3-bit; idxMode 1: swapped.
    const cw = idxMode ? W3[i3[i]] : W2[i2[i]]
    const aw = idxMode ? W2[i2[i]] : W3[i3[i]]
    const px = [interp8(e0[0], e1[0], cw), interp8(e0[1], e1[1], cw), interp8(e0[2], e1[2], cw), interp8(e0[3], e1[3], aw)]
    rotate(px, rot)
    for (let c = 0; c < 4; c++) out[i * 4 + c] = px[c] / 255
  }
  return out
}

export function bc7SupportedMode(m) { return m === 1 || m === 4 || m === 5 || m === 6 }

export function decodeBC7Full(block) {
  const m = bc7Mode(block)
  const r = reader(block)
  if (m === 6) return decodeMode6(r)
  if (m === 1) return decodeMode1(r)
  if (m === 5) return decodeMode5(r)
  if (m === 4) return decodeMode4(r)
  throw new Error(`decodeBC7Full: mode ${m} not supported (only 1/4/5/6)`)
}
