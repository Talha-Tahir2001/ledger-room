/**
 * pdf.js ships its own types for the bare `pdfjs-dist` specifier but not for
 * the deep build paths this project imports, which is how it is loaded in the
 * browser (worker + Turbopack friendly URL) and in Node for the eval harness.
 */
declare module "pdfjs-dist/build/pdf.mjs" {
  export interface TextItem {
    str: string
    transform: number[]
    width: number
    height: number
    hasEOL?: boolean
  }

  export interface RenderTask {
    promise: Promise<void>
    cancel(): void
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<{ items: TextItem[] }>
    getViewport(options: { scale: number }): { width: number; height: number }
    render(options: Record<string, unknown>): RenderTask
    cleanup(): void
  }

  export interface PDFDocumentProxy {
    numPages: number
    getPage(pageNumber: number): Promise<PDFPageProxy>
    destroy(): Promise<void>
  }

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>
  }

  export const GlobalWorkerOptions: { workerSrc: string }

  export function getDocument(options: Record<string, unknown>): PDFDocumentLoadingTask
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export * from "pdfjs-dist/build/pdf.mjs"
  export { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf.mjs"
}

declare module "tesseract.js" {
  export interface RecognizeResult {
    data: { text: string }
  }

  export interface Worker {
    recognize(image: HTMLCanvasElement | Blob): Promise<RecognizeResult>
    terminate(): Promise<void>
  }

  export interface LoggerMessage {
    status: string
    progress: number
  }

  export function createWorker(
    lang?: string,
    oem?: number,
    options?: { logger?: (message: LoggerMessage) => void }
  ): Promise<Worker>
}