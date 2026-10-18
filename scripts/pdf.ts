/**
 * A minimal PDF writer: text-layer pages and image-only pages.
 *
 * Deliberately hand-rolled rather than pulling a PDF library. The fixture set
 * needs exactly two shapes — a page with a real text layer and a page with
 * none at all — and a dependency that renders either would be larger than the
 * 200 lines this is.
 */

import { deflateSync } from "node:zlib"

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

class PdfBuilder {
  private chunks: Buffer[] = []
  private offsets: number[] = []
  private length = 0

  private push(data: Buffer | string) {
    const buffer = typeof data === "string" ? Buffer.from(data, "latin1") : data
    this.chunks.push(buffer)
    this.length += buffer.length
  }

  /** `num` is the 1-based object number; index it before adding more objects. */
  addObject(num: number, body: string | Buffer) {
    while (this.offsets.length < num - 1) this.offsets.push(0)
    this.offsets[num - 1] = this.length
    this.push(`${num} 0 obj\n`)
    this.push(body)
    this.push("\nendobj\n")
  }

  build(rootRef = 1): Buffer {
    const header = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    const xrefOffset = header.length + this.length

    let table = `xref\n0 ${this.offsets.length + 1}\n0000000000 65535 f \n`
    for (const offset of this.offsets) {
      table += `${String(offset).padStart(10, "0")} 00000 n \n`
    }
    table += `trailer\n<< /Size ${this.offsets.length + 1} /Root ${rootRef} 0 R >>\n`
    table += `startxref\n${xrefOffset}\n%%EOF\n`

    return Buffer.concat([Buffer.from(header, "latin1"), ...this.chunks, Buffer.from(table, "latin1")])
  }

  rawLength(): number {
    return this.length
  }
}

/** Wraps long lines so a receipt never runs off the page. */
function wrap(text: string, maxChars: number): string[] {
  const out: string[] = []
  for (const line of text.split("\n")) {
    if (line.length <= maxChars) {
      out.push(line)
      continue
    }
    let remaining = line
    while (remaining.length > maxChars) {
      out.push(remaining.slice(0, maxChars))
      remaining = remaining.slice(maxChars)
    }
    out.push(remaining)
  }
  return out
}

/** A page whose characters are real text: pdf.js will find them. */
export function textLayerPdf(text: string, options: { fontSize?: number; title?: string } = {}): Buffer {
  const fontSize = options.fontSize ?? 8.5
  // Courier is 0.6em wide, so this is the widest line that fits A4.
  const maxChars = Math.floor((A4_WIDTH - 72) / (fontSize * 0.6))
  const lines = wrap(text, maxChars)
  const leading = fontSize * 1.35
  const usableHeight = A4_HEIGHT - 96
  const maxLines = Math.floor(usableHeight / leading)

  const shown = lines.slice(0, maxLines)

  let stream = "BT\n/F1 9 Tf\n14 TL\n1 0 0 1 36 810 Tm\n"
  shown.forEach((line, index) => {
    // Alternate text shading so the page is not uniformly flat.
    const gray = index % 7 === 6 ? "0.25" : "0.05"
    stream += `${gray} g\n(${escapePdfText(line)}) Tj\nT*\n`
  })
  stream += "ET\n"

  const streamBuffer = Buffer.from(stream, "latin1")

  const pdf = new PdfBuilder()
  pdf.addObject(1, "<< /Type /Catalog /Pages 2 0 R >>")
  pdf.addObject(
    2,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`
  )
  pdf.addObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] ` +
      `/Resources << /Font << /F1 4 0 R >> /ProcSet [/PDF /Text] >> /Contents 5 0 R >>`
  )
  pdf.addObject(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>")
  pdf.addObject(
    5,
    Buffer.concat([
      Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, "latin1"),
      streamBuffer,
      Buffer.from("\nendstream", "latin1"),
    ])
  )

  return pdf.build()
}

/** A page whose only content is a bitmap. pdf.js finds no text layer at all. */
export function imageOnlyPdf(
  image: { width: number; height: number; pixels: Buffer }
): Buffer {
  // Fit the image to the page while preserving aspect ratio.
  const maxW = A4_WIDTH - 36
  const maxH = A4_HEIGHT - 36
  const scale = Math.min(maxW / image.width, maxH / image.height)
  const drawW = Math.round(image.width * scale)
  const drawH = Math.round(image.height * scale)
  const offsetX = (A4_WIDTH - drawW) / 2
  const offsetY = (A4_HEIGHT - drawH) / 2

  const stream = `q\n${drawW} 0 0 ${drawH} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm\n/Im0 Do\nQ\n`
  const streamBuffer = Buffer.from(stream, "latin1")

  const pdf = new PdfBuilder()
  pdf.addObject(1, "<< /Type /Catalog /Pages 2 0 R >>")
  pdf.addObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  pdf.addObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] ` +
      `/Resources << /XObject << /Im0 6 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`
  )
  pdf.addObject(
    4,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  )
  pdf.addObject(
    5,
    Buffer.concat([
      Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, "latin1"),
      streamBuffer,
      Buffer.from("\nendstream", "latin1"),
    ])
  )
  // Compressed grayscale bytes. deflateSync is deterministic.
  const compressed = deflateSync(image.pixels)
  pdf.addObject(
    6,
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
          `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
        "latin1"
      ),
      compressed,
      Buffer.from("\nendstream", "latin1"),
    ])
  )

  return pdf.build()
}