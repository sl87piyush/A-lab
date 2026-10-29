import { validateQuestion, type Question } from "./index.ts";
export type OCRImage = {
  id: string;
  imageBase64?: string;
  image_base64?: string;
  uri?: string;
};
export type OCRBlock = {
  text?: string;
  content?: string;
  markdown?: string;
  type?: string;
  blockType?: string;
  bbox?: unknown;
};
export type OCRPage = {
  index: number;
  markdown: string;
  images?: OCRImage[];
  blocks?: OCRBlock[];
  header?: string | null;
  footer?: string | null;
  dimensions?: unknown;
};
export type Ignored = {
  id: string;
  page: number;
  text: string;
  reason: string;
};
export type Parsed = {
  questions: Question[];
  ignored: Ignored[];
  pages: OCRPage[];
  warnings: string[];
};
export function parseOCR(documentId: string, pages: OCRPage[]): Parsed {
  const questions: Question[] = [],
    ignored: Ignored[] = [],
    warnings: string[] = [];
  let current: Question | undefined,
    section = "General",
    inOptions = false;
  const imageMap = new Map<string, Question["images"][number]>();
  for (const p of pages)
    for (const im of p.images ?? []) {
      const raw = im.imageBase64 ?? im.image_base64;
      imageMap.set(`${p.index}:${im.id}`, {
        id: `${documentId}/page-${p.index}/${im.id}`,
        page: p.index,
        uri:
          im.uri ??
          (raw?.startsWith("data:")
            ? raw
            : raw
              ? `data:image/jpeg;base64,${raw}`
              : ""),
      });
    }
  const frequencies = new Map<string, number>();
  for (const p of pages) {
    for (const line of new Set(
      p.markdown
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    ))
      frequencies.set(line, (frequencies.get(line) ?? 0) + 1);
  }
  const finish = () => {
    if (current) {
      questions.push(validateQuestion(current));
      current = undefined;
    }
    inOptions = false;
  };
  for (const p of pages) {
    for (const [kind, txt] of [
      ["header", p.header],
      ["footer", p.footer],
    ] as const)
      if (txt)
        ignored.push({
          id: `ignored-${ignored.length}`,
          page: p.index,
          text: txt,
          reason: kind,
        });
    // OCR 4 blocks are already in reading order. Never sort them by y alone across columns.
    const blocks = p.blocks?.filter((b) =>
      (b.text ?? b.content ?? b.markdown)?.trim(),
    );
    const raw = blocks?.length
      ? blocks.map((b) => ({
          text: b.text ?? b.content ?? b.markdown ?? "",
          type: b.type ?? b.blockType,
          bounds: b.bbox,
        }))
      : [{ text: p.markdown, type: undefined, bounds: undefined }];
    for (const block of raw)
      for (const original of block.text.split("\n")) {
        const line = original.trim();
        if (!line) continue;
        const promotional =
          /(telegram|youtube|subscribe|join our|follow us|coaching|channel @)/i.test(
            line,
          ) &&
          !/^\d+[.)]\s/.test(line) &&
          !/^\(?[A-D1-4][).]\s/.test(line);
        const repeating =
          (frequencies.get(line) ?? 0) >= Math.max(2, pages.length * 0.7) &&
          line.length < 120 &&
          !/^\d+[.)]|^\(?[A-D1-4][).]/.test(line) &&
          !/\$/.test(line) &&
          !line.includes("![");
        if (
          promotional ||
          repeating ||
          /header|footer|watermark/.test(block.type ?? "") ||
          /^page\s+\d+(\s+of\s+\d+)?$/i.test(line)
        ) {
          ignored.push({
            id: `ignored-${ignored.length}`,
            page: p.index,
            text: original,
            reason: promotional
              ? "Possible promotion"
              : repeating
                ? "Repeated block"
                : (block.type ?? "Page number"),
          });
          continue;
        }
        if (
          /^(?:#{1,6}\s*)?(?:section|part|physics|chemistry|mathematics)\b/i.test(
            line,
          ) &&
          line.length < 100
        ) {
          section = line.replace(/^#+\s*/, "");
          continue;
        }
        const boundary = line.match(
          /^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[.)]\s+(.+)/i,
        );
        const option = line.match(
          /^(?:\(([A-Da-d1-9])\)|([A-Da-d])[.)])\s*(.*)$/,
        );
        if (boundary) {
          finish();
          current = {
            id: `${documentId}-q${questions.length + 1}`,
            number: boundary[1],
            section,
            text: boundary[2],
            options: [],
            type: "single",
            images: [],
            source: { documentId, pages: [p.index], bounds: block.bounds },
            warnings: [],
            status: "needs-review",
          };
          if (/multiple\s+(?:correct|select)|one or more/i.test(section))
            current.type = "multiple";
          if (/numerical|integer/i.test(section)) current.type = "numerical";
        } else if (option && current) {
          const label = (option[1] ?? option[2]).toUpperCase();
          if (current.options.some((o) => o.label === label))
            current.warnings.push(
              "Repeated option labels: check for merged questions",
            );
          current.options.push({ label, text: option[3] });
          inOptions = true;
        } else if (current) {
          if (!current.source.pages.includes(p.index))
            current.source.pages.push(p.index);
          if (inOptions && current.options.length)
            current.options[current.options.length - 1].text += "\n" + original;
          else current.text += "\n" + original;
        } else
          ignored.push({
            id: `ignored-${ignored.length}`,
            page: p.index,
            text: original,
            reason: "Unassigned source block",
          });
        if (current) {
          if (!current.source.pages.includes(p.index))
            current.source.pages.push(p.index);
          for (const m of line.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
            const im = imageMap.get(`${p.index}:${m[1]}`);
            if (im?.uri) {
              if (!current.images.some((x) => x.id === im.id))
                current.images.push(im);
            } else
              current.warnings.push(
                `Missing diagram: page ${p.index + 1}/${m[1]}`,
              );
          }
          current.text = current.text.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
          current.options = current.options.map((o) => ({
            ...o,
            text: o.text.replace(/!\[[^\]]*\]\([^)]+\)/g, ""),
          }));
        }
      }
  }
  finish();
  for (const q of questions) {
    if (
      questions.some(
        (other) =>
          other.id !== q.id &&
          other.section === q.section &&
          other.number === q.number,
      )
    ) {
      q.warnings.push("Duplicate source question number in section");
      q.status = "needs-review";
    }
    if (q.type === "single" && !q.options.length) {
      q.type = "unsupported";
      q.status = "unsupported";
      q.warnings.push("No reliable choice or numerical format detected");
    }
  }
  if (!questions.length)
    warnings.push(
      "No readable questions found. Check the source and page selection.",
    );
  return { questions, ignored, pages, warnings };
}
export type SourceKey = {
  number: string;
  section: string;
  values: string[];
  source: string;
};
export function parseKeys(pages: OCRPage[]): SourceKey[] {
  let section = "General";
  const out: SourceKey[] = [];
  for (const p of pages)
    for (const line of p.markdown.split("\n")) {
      if (/^\s*(section|part)\b/i.test(line)) {
        section = line.trim();
        continue;
      }
      for (const m of line.matchAll(
        /(?:^|[|;,\s])(\d{1,3})\s*[.):-]\s*([A-D1-4](?:\s*[+/]\s*[A-D1-4])?)(?=\s|$|[|;,])/g,
      ))
        out.push({
          number: m[1],
          section,
          values: m[2].split(/\s*[+/]\s*/),
          source: `Answer key page ${p.index + 1}`,
        });
    }
  return out;
}
export function matchKeys(questions: Question[], keys: SourceKey[]) {
  const warnings: string[] = [];
  const result = questions.map((q) => {
    const matches = keys.filter(
      (k) =>
        k.number === q.number &&
        (k.section === q.section || k.section === "General"),
    );
    const peers = questions.filter(
      (other) =>
        other.number === q.number &&
        (other.section === q.section ||
          matches.some((k) => k.section === "General")),
    );
    if (matches.length !== 1 || peers.length !== 1) {
      if (matches.length)
        warnings.push(`Ambiguous key for ${q.section} Q${q.number}`);
      return q;
    }
    return {
      ...q,
      key: {
        values: matches[0].values,
        confirmed: false,
        provenance: "source" as const,
        tolerance: 0,
        updatedAt: Date.now(),
        source: matches[0].source,
      },
    };
  });
  for (const k of keys)
    if (!questions.some((q) => q.number === k.number))
      warnings.push(`Unmatched answer key Q${k.number}`);
  return { questions: result, warnings };
}
