// Generates the app icons with no image dependencies: raw RGBA pixels piped
// through zlib into a minimal PNG. Run with `npm run icons` after changing
// the mark or the palette.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const BG = [11, 13, 16]
const BAR = [110, 168, 254]
const TIP = [242, 181, 68]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixel) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size)
      const o = y * (stride + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Three ascending bars — a power-law curve, which is the whole job.
const BARS = [
  { x: 0.16, w: 0.16, h: 0.26, color: BAR },
  { x: 0.38, w: 0.16, h: 0.46, color: BAR },
  { x: 0.6, w: 0.16, h: 0.72, color: TIP },
]

function pixel(x, y, size) {
  const u = x / size
  const v = y / size
  for (const bar of BARS) {
    const top = 0.84 - bar.h
    if (u >= bar.x && u <= bar.x + bar.w && v >= top && v <= 0.84) {
      return [...bar.color, 255]
    }
  }
  return [...BG, 255]
}

mkdirSync(OUT, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), png(size, pixel))
  console.log(`wrote public/icon-${size}.png`)
}
