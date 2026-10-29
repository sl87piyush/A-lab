import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  parseOCR,
  matchKeys,
  parseKeys,
  type OCRPage,
} from "../packages/shared/src/index.js";
import { normalizePages } from "../services/api/src/ocr.js";
const fixture = (name: string) =>
  normalizePages(
    JSON.parse(readFileSync(`fixtures/${name}.synthetic.json`, "utf8")),
  );
const parse = (text: string) => parseOCR("doc", [{ index: 0, markdown: text }]);
describe("OCR extraction and provenance", () => {
  it("groups RAS numeric options without treating options as questions", () => {
    const r = parseOCR("ras", fixture("ras"));
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].options.map((o) => o.label)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(r.questions[0].text).toBe(
      "The Tenth Five-year Plan will end in the year:",
    );
    expect(r.questions.every((q) => !q.key)).toBe(true);
  });
  it("preserves exact source wording and source numbers", () => {
    const r = parse("42. Which $\\alpha^2-\\beta$?\n(A) X\n(B) Y");
    expect(r.questions[0].number).toBe("42");
    expect(r.questions[0].text).toBe("Which $\\alpha^2-\\beta$?");
  });
  it("uses SDK block order for two columns and preserves mathematical content", () => {
    const r = parseOCR("jee", fixture("jee"));
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].options[0].text).toBe("$2$");
    expect(r.questions[0].section).toBe("Section A - Physics");
  });
  it("joins cross-page questions and associates multiple diagrams", () => {
    const r = parseOCR("jee", fixture("jee"));
    expect(r.questions[1].text).toContain("the equivalent resistance.");
    expect(r.questions[1].source.pages).toEqual([0, 1]);
    expect(r.questions[1].images).toHaveLength(2);
  });
  it("namespaces repeated img-0.jpeg across pages", () => {
    const r = parseOCR("jee", fixture("jee"));
    expect(r.questions[0].images[0].id).not.toBe(r.questions[1].images[0].id);
    expect(r.questions[0].images[0].uri).not.toBe(r.questions[1].images[0].uri);
  });
  it("removes literal image placeholders from displayed question text", () => {
    const r = parseOCR("jee", fixture("jee"));
    expect(r.questions.every((q) => !q.text.includes("!["))).toBe(true);
  });
  it("preserves promotional blocks for restoration", () => {
    const r = parseOCR("jee", fixture("jee"));
    expect(r.ignored.some((b) => b.text.includes("Telegram"))).toBe(true);
    expect(
      r.questions.every(
        (q) =>
          !q.text.includes("Telegram") &&
          q.options.every((o) => !o.text.includes("Telegram")),
      ),
    ).toBe(true);
  });
  it("flags missing images", () => {
    expect(
      parse(
        "1. See ![x](missing.jpg)\n(A) a\n(B) b",
      ).questions[0].warnings.join(" "),
    ).toContain("Missing diagram");
  });
  it("flags missing options and unsupported content rather than guessing", () => {
    expect(parse("1. Open question without a format").questions[0].status).toBe(
      "unsupported",
    );
    expect(parse("1. Q\n(A) One").questions[0].status).toBe("needs-review");
  });
  it("flags duplicate source numbers within a section", () => {
    const r = parse("1. Q\n(A) a\n(B) b\n1. R\n(A) a\n(B) b");
    expect(r.questions.every((q) => q.status === "needs-review")).toBe(true);
  });
  it("keeps separate section numbering", () => {
    const r = parse(
      "Section A\n1. Q\n(A) a\n(B) b\nSection B\n1. R\n(A) a\n(B) b",
    );
    expect(r.questions.every((q) => q.status === "ready")).toBe(true);
  });
  it("flags repeated options as a potentially merged question", () => {
    const r = parse("1. Q\n(A) a\n(B) b\n(A) c\n(B) d");
    expect(r.questions[0].warnings.join(" ")).toContain("merged");
  });
  it("recognizes explicitly numerical and multiple-select sections", () => {
    expect(
      parse("Section numerical\n1. Enter the value.").questions[0].type,
    ).toBe("numerical");
    expect(
      parse("Section multiple correct\n1. Choose\n(A) a\n(B) b").questions[0]
        .type,
    ).toBe("multiple");
  });
  it("does not score imported keys until confirmed", () => {
    const questions = parseOCR("ras", fixture("ras")).questions;
    const keys = parseKeys([{ index: 2, markdown: "1: 3\n2: 1\n99: 2" }]);
    const result = matchKeys(questions, keys);
    expect(result.questions[0].key?.confirmed).toBe(false);
    expect(result.warnings).toContain("Unmatched answer key Q99");
  });
  it("warns about ambiguous answer keys", () => {
    const qs = parse("1. Q\n(A) a\n(B) b\n1. Q\n(A) a\n(B) b").questions;
    expect(
      matchKeys(qs, [
        { number: "1", section: "General", values: ["A"], source: "key" },
      ]).warnings,
    ).toHaveLength(2);
  });
  it("handles empty output with a recovery warning", () => {
    expect(parse("").questions).toEqual([]);
    expect(parse("").warnings[0]).toContain("No readable questions");
  });
  it("automatically validates repository OCR JSON fixtures", () => {
    const files = readdirSync("fixtures").filter((f) => f.endsWith(".json"));
    for (const name of files) {
      const input = JSON.parse(readFileSync(`fixtures/${name}`, "utf8"));
      if (input.pages) {
        const pages = normalizePages(input) as OCRPage[];
        expect(() => parseOCR(name, pages)).not.toThrow();
      }
    }
  });
});
