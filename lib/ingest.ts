/**
 * Ingest: a document goes in, text comes out, and the path it took is recorded.
 *
 * Two routes (FR-2, FR-3):
 *   text layer  pdf.js reads the embedded characters. Exact, instant, free.
 *   OCR          tesseract.js in a worker, on a bitmap rendered from the page.
 *
 * The choice is a density heuristic, not a file-type check. A "PDF" is just a
 * container; plenty of real ones are scans with no characters at all, and some
 * have a partial layer that is worse than nothing because it looks complete.
 */

/**
 * Below this many characters per page, the text layer is treated as absent.
 *
 * Tuned against the fixture corpus rather than picked. A scanned receipt yields
 * zero characters; the shortest genuine receipt in the set (a two-line coffee
 * bill) yields 80. Fifty is the line where "this PDF has characters" and "this
 * PDF has a usable amount of text" agree for every fixture, and OCR costs
 * seconds and loses accuracy, so the bar for falling back is set low
 * deliberately.
 */
export const DENSITY_THRESHOLD = 50

/**
 * Fraction of undecodable characters above which the layer is discarded even
 * if it is dense. Some generators emit a layer that is mostly correct and
 * silently mangled in places, which is worse than no layer because it looks
 * complete.
 */
export const REPLACEMENT_RATIO_LIMIT = 0.02

export interface TextLayerResult {
  text: string
  chars: number
  pages: number
  textLayerDense: boolean
  /** Characters the text layer failed to decode. Presence means distrust it. */
  replacementChars: number
}

interface PdfJsModule {
  getDocument: (options: Record<string, unknown>) => {
    promise: Promise<{
      numPages: number
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: TextItem[] }>
        getViewport: (options: { scale: number }) => { width: number; height: number }
        render: (options: Record<string, unknown>) => { promise: Promise<void> }
        cleanup: () => void
      }>
      destroy?: () => Promise<void>
    }>
  }
  GlobalWorkerOptions: { workerSrc: string }
}

interface TextItem {
  str: string
  transform: number[]
  width: number
  height: number
  hasEOL?: boolean
}

let pdfjsPromise: Promise<PdfJsModule> | null = null

/**
 * pdf.js ships a browser build and a Node-compatible one. The Node build is
 * used for the eval harness, which reads fixture PDFs straight off disk.
 */
async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const isBrowser = typeof window !== "undefined"
      // Named `pdfjs`, not `module`: `module` is the CommonJS global and
      // shadowing it breaks bundlers that probe for it.
      const pdfjs = isBrowser
        ? await import("pdfjs-dist/build/pdf.mjs")
        : await import("pdfjs-dist/legacy/build/pdf.mjs")

      if (isBrowser) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString()
      }

      return pdfjs as unknown as PdfJsModule
    })()
  }
  return pdfjsPromise
}

interface Positioned {
  text: string
  x: number
  y: number
  height: number
  eol: boolean
}

/**
 * Rebuilds reading order from glyph positions rather than trusting the order
 * pdf.js hands items back in. Two-column invoices come back interleaved
 * otherwise, and the extraction model reads that as nonsense.
 */
function assembleLines(items: TextItem[]): string {
  const positioned: Positioned[] = items.map((item) => ({
    text: item.str,
    x: item.transform[4],
    y: item.transform[5],
    height: item.height || Math.abs(item.transform[3]) || 10,
    eol: item.hasEOL ?? false,
  }))

  const tolerance = 3
  const lines: Positioned[][] = []

  for (const item of positioned) {
    const line = lines.find((candidate) => Math.abs(candidate[0].y - item.y) <= tolerance)
    if (line) line.push(item)
    else lines.push([item])
  }

  lines.sort((a, b) => b[0].y - a[0].y)

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x)

      let out = ""
      let cursorEnd: number | null = null
      let cursorHeight: number | null = null

      for (const item of line) {
        if (out === "") {
          out = item.text
        } else if (cursorEnd !== null && cursorHeight !== null) {
          // A gap wider than roughly one space is a column break, not a word
          // break. Preserving it is what keeps monospaced receipt tables legible.
          const gap = item.x - cursorEnd
          const spaces = gap > cursorHeight * 0.9 ? Math.max(1, Math.round(gap / (cursorHeight * 0.3))) : 1
          out += " ".repeat(spaces) + item.text
        } else {
          out += item.text
        }
        cursorEnd = item.x + item.text.length * item.height * 0.5
        cursorHeight = item.height
      }

      return out
    })
    .join("\n")
}

export async function extractTextLayer(data: Uint8Array): Promise<TextLayerResult> {
  const pdfjs = await loadPdfJs()

  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    verbosity: 0,
    useSystemFonts: true,
    disableFontFace: false,
  }).promise

  try {
    const pages: string[] = []

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = (content.items as TextItem[]).filter((item) => typeof item.str === "string")
      pages.push(assembleLines(items))
      page.cleanup()
    }

    const text = pages.join("\n\n")
    const chars = text.replace(/\s/g, "").length
    const replacementChars = (text.match(/\uFFFD/g) ?? []).length
    const perPage = chars / Math.max(1, doc.numPages)

    return {
      text,
      chars,
      pages: doc.numPages,
      textLayerDense:
        perPage >= DENSITY_THRESHOLD &&
        replacementChars / Math.max(1, chars) <= REPLACEMENT_RATIO_LIMIT,
      replacementChars,
    }
  } finally {
    await doc.destroy?.()
  }
}

/** Browser-only: renders a page to a bitmap for the OCR path. */
export async function renderPageToCanvas(
  data: Uint8Array,
  target: HTMLCanvasElement,
  scale = 2
): Promise<void> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise

  try {
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale })
    target.width = viewport.width
    target.height = viewport.height

    const context = target.getContext("2d")
    if (!context) throw new Error("2D canvas context unavailable")

    await page.render({ canvasContext: context, viewport, canvas: target }).promise
    page.cleanup()
  } finally {
    await doc.destroy?.()
  }
}

export interface IngestResult {
  text: string
  ocrUsed: boolean
  textLayer: boolean
  pages: number
  /** 0..1, how far the reader got through the work. */
  progress: (stage: "reading" | "rasterize" | "ocr" | "done") => void
}

let tesseractWorker: import("tesseract.js").Worker | null = null

/**
 * OCR via tesseract.js. The worker is created once and kept warm for the whole
 * batch: loading the language model per document would dominate the cost of the
 * scan.
 */
async function recognize(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js")

  if (!tesseractWorker) {
    tesseractWorker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text") onProgress?.(message.progress)
      },
    })
  }

  const { data } = await tesseractWorker.recognize(canvas)
  return data.text ?? ""
}

export async function releaseOcr(): Promise<void> {
  if (tesseractWorker) {
    await tesseractWorker.terminate()
    tesseractWorker = null
  }
}

export interface IngestOptions {
  onStage?: (stage: "reading" | "rasterize" | "ocr" | "done", ratio: number) => void
}

/**
 * Full ingest for one file. Returns the text and, just as importantly, which
 * route produced it — that provenance is shown on every row and is half of
 * what the accuracy study is measuring.
 */
export async function ingestFile(file: File, options: IngestOptions = {}): Promise<IngestResult> {
  const { onStage } = options
  onStage?.("reading", 0.1)

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

  const data = new Uint8Array(await file.arrayBuffer())

  // Images have no text layer by definition.
  if (!isPdf) {
    onStage?.("rasterize", 0.3)
    const text = await recognizeFileImage(data, onStage)
    return { text, ocrUsed: true, textLayer: false, pages: 1, progress: () => {} }
  }

  const layer = await extractTextLayer(data)

  if (layer.textLayerDense) {
    onStage?.("done", 1)
    return {
      text: layer.text,
      ocrUsed: false,
      textLayer: true,
      pages: layer.pages,
      progress: () => {},
    }
  }

  onStage?.("rasterize", 0.35)
  const canvas = await rasterizePdf(data)
  onStage?.("ocr", 0.45)
  const text = await recognize(canvas, (ratio) => onStage?.("ocr", 0.45 + ratio * 0.55))

  onStage?.("done", 1)
  return {
    text: text || layer.text,
    ocrUsed: true,
    textLayer: false,
    pages: layer.pages,
    progress: () => {},
  }
}

async function recognizeFileImage(data: Uint8Array, onStage?: IngestOptions["onStage"]) {
  const blob = new Blob([data as unknown as BlobPart])
  const bitmap = await createImageBitmap(blob)

  const canvas = document.createElement("canvas")
  // Upscaling roughly 1.5x is the single biggest win for a phone photo.
  const scale = Math.min(2, Math.max(1, 1600 / bitmap.width))
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext("2d")
  if (!context) throw new Error("2D canvas context unavailable")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  onStage?.("ocr", 0.5)
  return recognize(canvas, (ratio) => onStage?.("ocr", 0.5 + ratio * 0.5))
}

async function rasterizePdf(data: Uint8Array): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas")
  await renderPageToCanvas(data, canvas, 2)
  return canvas
}