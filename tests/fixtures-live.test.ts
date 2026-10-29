import { it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { runOCR, normalizePages } from "../services/api/src/ocr.js";
import { decodeExport } from "../services/api/src/exports.js";
import { parseOCR } from "../packages/shared/src/index.js";
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? walk(join(dir, item.name)) : [join(dir, item.name)],
  );
}
const files = walk("fixtures"),
  pdfs = files.filter((name) => name.toLowerCase().endsWith(".pdf")),
  zips = files.filter((name) => name.toLowerCase().endsWith(".zip")),
  markdown = files.filter((name) =>
    /pages\/page-\d+\/markdown\.md$/.test(name),
  );
it.skipIf(!pdfs.length || !process.env.MISTRAL_API_KEY)(
  "extracts user PDFs with real Mistral (requires credentials and fixtures)",
  async () => {
    for (const name of pdfs) {
      const bytes = readFileSync(name);
      const pdf = await PDFDocument.load(bytes);
      const result = await runOCR(
        name,
        bytes,
        "application/pdf",
        Array.from({ length: Math.min(20, pdf.getPageCount()) }, (_, i) => i),
      );
      expect(result.raw.pages.length).toBeGreaterThan(0);
      expect(result.parsed.questions.length).toBeGreaterThan(0);
    }
  },
  240000,
);
it.skipIf(!zips.length)(
  "automatically parses user OCR export ZIP fixtures without OCR spending",
  () => {
    for (const name of zips)
      expect(() =>
        parseOCR(name, normalizePages(decodeExport(readFileSync(name)))),
      ).not.toThrow();
  },
);
it.skipIf(!markdown.length)(
  "automatically parses user unpacked OCR export fixtures",
  () => {
    for (const name of markdown) {
      const prefix = name.slice(0, name.lastIndexOf("/") + 1);
      const pages = [
        {
          index: Number(name.match(/page-(\d+)/)![1]) - 1,
          markdown: readFileSync(name, "utf8"),
          images: files
            .filter(
              (file) => file.startsWith(prefix) && /\.(png|jpe?g)$/i.test(file),
            )
            .map((file) => ({
              id: file.slice(prefix.length),
              imageBase64: `data:image/${/png$/i.test(file) ? "png" : "jpeg"};base64,${readFileSync(file).toString("base64")}`,
            })),
        },
      ];
      expect(() => parseOCR(name, pages)).not.toThrow();
    }
  },
);
