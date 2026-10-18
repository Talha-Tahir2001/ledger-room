/**
 * A dependency-free rasteriser: 5x7 bitmap font -> grayscale -> PNG.
 *
 * This exists so the fixture set can contain genuine image-only documents
 * without pulling in a native canvas binding. Real thermal and dot-matrix
 * receipts are near-always upper case, so the renderer is upper case only and
 * the scorer is case-insensitive.
 */
import { deflateSync } from "node:zlib"

/** 5 wide, 7 tall. "1" is ink. */
const GLYPHS: Record<string, string> = {
  " ": "00000/00000/00000/00000/00000/00000/00000",
  A: "01110/10001/10001/11111/10001/10001/10001",
  B: "11110/10001/10001/11110/10001/10001/11110",
  C: "01110/10001/10000/10000/10000/10001/01110",
  D: "11110/10001/10001/10001/10001/10001/11110",
  E: "11111/10000/10000/11110/10000/10000/11111",
  F: "11111/10000/10000/11110/10000/10000/10000",
  G: "01110/10001/10000/10111/10001/10001/01111",
  H: "10001/10001/10001/11111/10001/10001/10001",
  I: "11111/00100/00100/00100/00100/00100/11111",
  J: "00111/00010/00010/00010/00010/10010/01100",
  K: "10001/10010/10100/11000/10100/10010/10001",
  L: "10000/10000/10000/10000/10000/10000/11111",
  M: "10001/11011/10101/10101/10001/10001/10001",
  N: "10001/11001/10101/10011/10001/10001/10001",
  O: "01110/10001/10001/10001/10001/10001/01110",
  P: "11110/10001/10001/11110/10000/10000/10000",
  Q: "01110/10001/10001/10001/10101/10010/01101",
  R: "11110/10001/10001/11110/10100/10010/10001",
  S: "01111/10000/10000/01110/00001/00001/11110",
  T: "11111/00100/00100/00100/00100/00100/00100",
  U: "10001/10001/10001/10001/10001/10001/01110",
  V: "10001/10001/10001/10001/10001/01010/00100",
  W: "10001/10001/10001/10101/10101/11011/10001",
  X: "10001/10001/01010/00100/01010/10001/10001",
  Y: "10001/10001/01010/00100/00100/00100/00100",
  Z: "11111/00001/00010/00100/01000/10000/11111",
  "0": "01110/10001/10011/10101/11001/10001/01110",
  "1": "00100/01100/00100/00100/00100/00100/01110",
  "2": "01110/10001/00001/00110/01000/10000/11111",
  "3": "11110/00001/00001/01110/00001/00001/11110",
  "4": "00010/00110/01010/10010/11111/00010/00010",
  "5": "11111/10000/11110/00001/00001/10001/01110",
  "6": "00110/01000/10000/11110/10001/10001/01110",
  "7": "11111/00001/00010/00100/01000/01000/01000",
  "8": "01110/10001/10001/01110/10001/10001/01110",
  "9": "01110/10001/10001/01111/00001/00010/01100",
  ".": "00000/00000/00000/00000/00000/01100/01100",
  ",": "00000/00000/00000/00000/01100/01100/11000",
  ":": "00000/01100/01100/00000/01100/01100/00000",
  ";": "00000/01100/01100/00000/01100/01100/11000",
  "-": "00000/00000/00000/11111/00000/00000/00000",
  "_": "00000/00000/00000/00000/00000/00000/11111",
  "/": "00001/00010/00010/00100/01000/01000/10000",
  "\\": "10000/01000/01000/00100/00010/00010/00001",
  "(": "00010/00100/01000/01000/01000/00100/00010",
  ")": "01000/00100/00010/00010/00010/00100/01000",
  "[": "01110/01000/01000/01000/01000/01000/01110",
  "]": "01110/00010/00010/00010/00010/00010/01110",
  "!": "00100/00100/00100/00100/00100/00000/00100",
  "?": "01110/10001/00001/00110/00100/00000/00100",
  "#": "01010/01010/11111/01010/11111/01010/01010",
  "+": "00000/00100/00100/11111/00100/00100/00000",
  "=": "00000/00000/11111/00000/11111/00000/00000",
  "*": "00000/10101/01110/11111/01110/10101/00000",
  "@": "01110/10001/10111/10101/10111/10000/01110",
  "&": "01100/10010/10100/01000/10101/10010/01101",
  "%": "11001/11010/00010/00100/01000/01011/10011",
  $: "00100/01111/10100/01110/00101/11110/00100",
  "'": "00100/00100/00000/00000/00000/00000/00000",
  '"': "01010/01010/00000/00000/00000/00000/00000",
  "<": "00010/00100/01000/10000/01000/00100/00010",
  ">": "01000/00100/00010/00001/00010/00100/01000",
  "|": "00100/00100/00100/00100/00100/00100/00100",
  "~": "00000/00000/01101/10110/00000/00000/00000",
  "^": "00100/01010/10001/00000/00000/00000/00000",
  "{": "00010/00100/00100/01000/00100/00100/00010",
  "}": "01000/00100/00100/00010/00100/00100/01000",
}

export interface RasterOptions {
  /** Device pixels per font pixel. */
  scale?: number
  /** Extra pixels between characters. */
  tracking?: number
  /** Extra pixels between lines. */
  leading?: number
  /** Ink value 0..255. 0 is black. */
  ink?: number
  /** Paper value 0..255. */
  paper?: number
  margin?: number
}

export interface Raster {
  width: number
  height: number
  /** Row-major grayscale, one byte per pixel. */
  pixels: Buffer
}

const GLYPH_W = 5
const GLYPH_H = 7

function glyphFor(char: string): string {
  const upper = char.toUpperCase()
  // A glyph that does not exist renders as a filled box, so a missing
  // character is visible in the fixture instead of silently blank.
  return GLYPHS[upper] ?? "11111/10001/10001/10001/10001/10001/11111"
}

/** Renders text to a grayscale bitmap. Lines longer than `wrap` are broken. */
export function rasterize(text: string, options: RasterOptions = {}): Raster {
  const scale = options.scale ?? 3
  const tracking = options.tracking ?? scale
  const leading = options.leading ?? scale * 3
  const ink = options.ink ?? 0
  const paper = options.paper ?? 255
  const margin = options.margin ?? 12 * scale

  const lines = text.split("\n")
  const maxCols = lines.reduce((max, line) => Math.max(max, line.length), 0)

  const charW = GLYPH_W * scale + tracking
  const lineH = GLYPH_H * scale + leading

  const width = maxCols * charW + margin * 2
  const height = lines.length * lineH + margin * 2

  const pixels = Buffer.alloc(width * height, paper)

  const put = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    pixels[y * width + x] = ink
  }

  lines.forEach((line, row) => {
    const y0 = margin + row * lineH
    for (let col = 0; col < line.length; col++) {
      const glyph = glyphFor(line[col]).split("/")
      const x0 = margin + col * charW
      for (let gy = 0; gy < GLYPH_H; gy++) {
        for (let gx = 0; gx < GLYPH_W; gx++) {
          if (glyph[gy][gx] !== "1") continue
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              put(x0 + gx * scale + sx, y0 + gy * scale + sy)
            }
          }
        }
      }
    }
  })

  return { width, height, pixels }
}

/** Rotates by whole degrees, replicating edge pixels. Enough to look scanned. */
export function rotate(source: Raster, degrees: number): Raster {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const cx = source.width / 2
  const cy = source.height / 2

  const out = Buffer.alloc(source.width * source.height, 255)

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const dx = x - cx
      const dy = y - cy
      const sx = Math.round(cx + dx * cos + dy * sin)
      const sy = Math.round(cy - dx * sin + dy * cos)
      out[y * source.width + x] =
        sx < 0 || sy < 0 || sx >= source.width || sy >= source.height
          ? 255
          : source.pixels[sy * source.width + sx]
    }
  }

  return { width: source.width, height: source.height, pixels: out }
}

// --- PNG -------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = -1
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

export function encodePng(raster: Raster): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(raster.width, 0)
  ihdr.writeUInt32BE(raster.height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // colour type: grayscale
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((raster.width + 1) * raster.height)
  for (let y = 0; y < raster.height; y++) {
    raw[y * (raster.width + 1)] = 0
    raster.pixels.copy(
      raw,
      y * (raster.width + 1) + 1,
      y * raster.width,
      (y + 1) * raster.width
    )
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}