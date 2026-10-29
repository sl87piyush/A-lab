import { describe, it, expect } from "vitest";
import {
  startAttempt,
  transition,
  metrics,
  grade,
  observations,
  priorities,
  demoQuestions,
  validateQuestion,
  type Settings,
} from "../packages/shared/src/index.js";
const settings: Settings = {
  title: "Test",
  minutes: 1,
  correct: 4,
  incorrect: -1,
  mode: "timed",
};
const start = () => startAttempt("a", demoQuestions, settings, 1000);
describe("durable CBT state machine", () => {
  it("starts with one visit and no answers", () => {
    const a = start();
    expect(a.responses["demo-1"].visits).toBe(1);
    expect(a.deadline).toBe(61000);
    expect(metrics(a).attempted).toBe(0);
  });
  it("answers and changes without losing selections on navigation", () => {
    let a = transition(start(), { type: "answer", values: ["A"] }, 2000);
    a = transition(a, { type: "answer", values: ["B"] }, 3000);
    a = transition(a, { type: "visit", index: 1 }, 4000);
    a = transition(a, { type: "visit", index: 0 }, 5000);
    expect(a.responses["demo-1"].answer).toEqual(["B"]);
    expect(a.responses["demo-1"].changes).toBe(1);
    expect(a.responses["demo-1"].visits).toBe(2);
  });
  it("clears and marks independently", () => {
    let a = transition(start(), { type: "answer", values: ["B"] }, 2000);
    a = transition(a, { type: "mark" }, 2500);
    a = transition(a, { type: "clear" }, 3000);
    expect(a.responses["demo-1"]).toMatchObject({
      answer: [],
      marked: true,
      changes: 1,
    });
  });
  it("does not count identical selections as a change", () => {
    const a = transition(start(), { type: "answer", values: ["B"] }, 2000);
    expect(transition(a, { type: "answer", values: ["B"] }, 3000)).toBe(a);
  });
  it("rejects impossible options and multiple selections in a single-choice question", () => {
    expect(() =>
      transition(start(), { type: "answer", values: ["Z"] }, 2000),
    ).toThrow();
    expect(() =>
      transition(start(), { type: "answer", values: ["A", "B"] }, 2000),
    ).toThrow();
  });
  it("excludes background time and does not double-count ticks", () => {
    let a = transition(start(), { type: "tick" }, 3000);
    a = transition(a, { type: "background" }, 4000);
    a = transition(a, { type: "foreground" }, 10000);
    a = transition(a, { type: "tick" }, 12000);
    a = transition(a, { type: "tick" }, 12000);
    a = transition(a, { type: "submit" }, 13000);
    expect(a.responses["demo-1"].activeMs).toBe(6000);
  });
  it("tracks navigation active time and review flags", () => {
    let a = transition(start(), { type: "visit", index: 1 }, 4000);
    a = transition(a, { type: "mark" }, 5000);
    a = transition(a, { type: "submit" }, 7000);
    expect(a.responses["demo-1"].activeMs).toBe(3000);
    expect(a.responses["demo-2"].activeMs).toBe(3000);
    expect(a.responses["demo-2"].marked).toBe(true);
  });
  it("survives JSON restart while retaining deadline and answers", () => {
    const a = transition(start(), { type: "answer", values: ["B"] }, 2000);
    const resumed = JSON.parse(JSON.stringify(a));
    expect(resumed.deadline).toBe(61000);
    expect(resumed.responses["demo-1"].answer).toEqual(["B"]);
  });
  it("auto-submits at the deadline on resume and caps active time", () => {
    const a = transition(start(), { type: "foreground" }, 90000);
    expect(a.submittedAt).toBe(61000);
    expect(a.responses["demo-1"].activeMs).toBe(60000);
    expect(a.events.at(-1)?.type).toBe("auto-submit");
  });
  it("prevents duplicate submission and post-submission changes", () => {
    const a = transition(start(), { type: "submit" }, 4000);
    expect(transition(a, { type: "submit" }, 5000)).toBe(a);
    expect(transition(a, { type: "answer", values: ["B"] }, 6000)).toBe(a);
  });
  it("calculates negative marking, accuracy and attempt rate", () => {
    let a = transition(start(), { type: "answer", values: ["B"] }, 2000);
    a = transition(a, { type: "visit", index: 1 }, 3000);
    a = transition(a, { type: "answer", values: ["A"] }, 4000);
    a = transition(a, { type: "submit" }, 5000);
    expect(metrics(a)).toMatchObject({
      score: 3,
      correct: 1,
      incorrect: 1,
      accuracy: 50,
      attemptRate: 25,
      negativeMarks: -1,
    });
  });
  it("reports ungraded rather than invented correctness", () => {
    const qs = demoQuestions.map(({ key: _key, ...q }) => q);
    let a = startAttempt("u", qs, settings, 1000);
    a = transition(a, { type: "answer", values: ["B"] }, 2000);
    expect(metrics(a)).toMatchObject({
      score: null,
      accuracy: null,
      graded: 0,
      ungraded: 1,
    });
    expect(observations(a).join(" ")).toContain("No confirmed");
  });
  it("computes partial-key maximum marks correctly", () => {
    const qs = demoQuestions.map((q, i) => (i ? { ...q, key: undefined } : q));
    const a = startAttempt("p", qs, settings, 1000);
    expect(metrics(a).maxScore).toBe(4);
  });
  it("grades multiple-select by exact set and supports numerical tolerance", () => {
    const a = start();
    const r = { ...a.responses["demo-6"], answer: ["C", "A"] };
    expect(grade(demoQuestions[5], r)).toBe("correct");
    const q = {
      ...demoQuestions[6],
      key: { ...demoQuestions[6].key!, tolerance: 0.01 },
    };
    expect(grade(q, { ...r, answer: ["1.005"] })).toBe("correct");
    expect(grade(q, { ...r, answer: ["1.1"] })).toBe("incorrect");
  });
  it("rejects malformed numerical responses", () => {
    let a = transition(start(), { type: "visit", index: 6 }, 2000);
    expect(() =>
      transition(a, { type: "answer", values: ["NaN"] }, 3000),
    ).toThrow();
    a = transition(a, { type: "answer", values: ["1"] }, 3000);
    expect(a.responses["demo-7"].answer).toEqual(["1"]);
  });
  it("reattempts do not overwrite their parent", () => {
    const a = transition(start(), { type: "answer", values: ["B"] }, 2000);
    const b = startAttempt("b", [demoQuestions[0]], settings, 4000, a.id);
    expect(b.parentId).toBe(a.id);
    expect(b.responses["demo-1"].answer).toEqual([]);
    expect(a.responses["demo-1"].answer).toEqual(["B"]);
  });
  it("does not invent mistake reasons", () => {
    const a = start();
    expect(
      Object.values(a.responses).every((r) => r.mistake === undefined),
    ).toBe(true);
    expect(observations(a).join(" ")).not.toMatch(
      /careless|concept gap|guessing/i,
    );
  });
  it("records student mistake tags after submission", () => {
    let a = transition(start(), { type: "submit" }, 3000);
    a = transition(
      a,
      { type: "mistake", questionId: "demo-1", reason: "Calculation error" },
      4000,
    );
    expect(a.responses["demo-1"].mistake).toBe("Calculation error");
    expect(priorities(a)[0].reasons).toContain("Student-reported mistake");
  });
  it("practice has no deadline", () => {
    let a = startAttempt(
      "p",
      demoQuestions,
      { ...settings, mode: "practice" },
      1000,
    );
    a = transition(a, { type: "tick" }, 999999);
    expect(a.submittedAt).toBeNull();
  });
  it("does not allow malformed questions into a test", () => {
    expect(() =>
      startAttempt(
        "x",
        [{ ...demoQuestions[0], status: "needs-review" }],
        settings,
      ),
    ).toThrow();
    expect(validateQuestion({ ...demoQuestions[0], options: [] }).status).toBe(
      "needs-review",
    );
  });
  it("rejects an answer key incompatible with the question type", () => {
    expect(
      validateQuestion({
        ...demoQuestions[0],
        key: { ...demoQuestions[0].key!, values: ["A", "B"] },
      }).status,
    ).toBe("needs-review");
  });
  it("measures revisit active time without counting background intervals", () => {
    let a = transition(start(), { type: "visit", index: 1 }, 2000);
    a = transition(a, { type: "visit", index: 0 }, 4000);
    a = transition(a, { type: "background" }, 6000);
    a = transition(a, { type: "foreground" }, 10000);
    a = transition(a, { type: "submit" }, 13000);
    expect(metrics(a).rows[0].revisitMs).toBe(5000);
  });
  it("prioritizes a recorded correct-to-incorrect answer change", () => {
    let a = transition(start(), { type: "answer", values: ["B"] }, 2000);
    a = transition(a, { type: "answer", values: ["A"] }, 3000);
    a = transition(a, { type: "submit" }, 4000);
    expect(metrics(a).rows[0].changedCorrectToIncorrect).toBe(true);
    expect(priorities(a)[0].reasons.join(" ")).toContain(
      "Changed from correct",
    );
  });
  it("supports the +1/0 marking scheme", () => {
    let a = startAttempt(
      "one-zero",
      demoQuestions,
      { ...settings, correct: 1, incorrect: 0 },
      1000,
    );
    a = transition(a, { type: "answer", values: ["B"] }, 2000);
    a = transition(a, { type: "visit", index: 1 }, 3000);
    a = transition(a, { type: "answer", values: ["A"] }, 4000);
    a = transition(a, { type: "submit" }, 5000);
    expect(metrics(a)).toMatchObject({
      score: 1,
      maxScore: 8,
      negativeMarks: 0,
      correct: 1,
      incorrect: 1,
    });
  });
  it("does not expose binary floating-point noise in custom decimal marks", () => {
    const questions = demoQuestions.slice(0, 3);
    let a = startAttempt(
      "decimal",
      questions,
      { ...settings, correct: 0.1, incorrect: -0.2 },
      1000,
    );
    questions.forEach((q, i) => {
      a = transition(a, { type: "visit", index: i }, 2000 + i * 1000);
      a = transition(
        a,
        { type: "answer", values: q.key!.values },
        2100 + i * 1000,
      );
    });
    a = transition(a, { type: "submit" }, 6000);
    expect(metrics(a)).toMatchObject({ score: 0.3, maxScore: 0.3 });
  });
});
