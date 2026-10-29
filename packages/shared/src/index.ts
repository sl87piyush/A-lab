import { z } from "zod";
export const KeySchema = z.object({
  values: z.array(z.string()),
  provenance: z.enum(["manual", "source", "demo"]),
  confirmed: z.boolean(),
  tolerance: z.number().min(0).default(0),
  updatedAt: z.number(),
  source: z.string().optional(),
});
export const QuestionSchema = z.object({
  id: z.string(),
  number: z.string(),
  section: z.string().default("General"),
  text: z.string(),
  options: z.array(z.object({ label: z.string(), text: z.string() })),
  type: z.enum(["single", "multiple", "numerical", "unsupported"]),
  images: z.array(
    z.object({ id: z.string(), uri: z.string(), page: z.number() }),
  ),
  source: z.object({
    documentId: z.string(),
    pages: z.array(z.number()),
    originalUri: z.string().optional(),
    bounds: z.unknown().optional(),
  }),
  warnings: z.array(z.string()),
  status: z.enum(["ready", "needs-review", "unsupported"]),
  key: KeySchema.optional(),
  explanation: z.string().optional(),
});
export type Question = z.infer<typeof QuestionSchema>;
export const SettingsSchema = z.object({
  title: z.string().min(1).max(120),
  minutes: z.number().min(1).max(600),
  correct: z.number().min(0).max(100),
  incorrect: z.number().min(-100).max(0),
  mode: z.enum(["timed", "practice"]),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const Mistakes = [
  "Concept gap",
  "Formula recall",
  "Formula application",
  "Calculation error",
  "Misread question",
  "Careless mistake",
  "Time pressure",
  "Guessing",
  "Other",
] as const;
export const ResponseSchema = z.object({
  answer: z.array(z.string()),
  marked: z.boolean(),
  visits: z.number(),
  activeMs: z.number(),
  changes: z.number(),
  mistake: z.enum(Mistakes).optional(),
});
export type Response = z.infer<typeof ResponseSchema>;
export const EventSchema = z.object({
  at: z.number(),
  type: z.enum([
    "start",
    "visit",
    "exit",
    "answer",
    "clear",
    "mark",
    "background",
    "foreground",
    "submit",
    "auto-submit",
    "mistake",
  ]),
  questionId: z.string().optional(),
  values: z.array(z.string()).optional(),
});
export type AttemptEvent = z.infer<typeof EventSchema>;
export const AttemptSchema = z.object({
  id: z.string(),
  parentId: z.string().optional(),
  questions: z.array(QuestionSchema),
  settings: SettingsSchema,
  startedAt: z.number(),
  deadline: z.number().nullable(),
  submittedAt: z.number().nullable(),
  current: z.number(),
  activeSince: z.number().nullable(),
  responses: z.record(z.string(), ResponseSchema),
  events: z.array(EventSchema),
});
export type Attempt = z.infer<typeof AttemptSchema>;
export const emptyResponse = (): Response => ({
  answer: [],
  marked: false,
  visits: 0,
  activeMs: 0,
  changes: 0,
});
export function startAttempt(
  id: string,
  questions: Question[],
  settings: Settings,
  now = Date.now(),
  parentId?: string,
): Attempt {
  if (
    !questions.length ||
    questions.some((q) => q.status !== "ready" || q.type === "unsupported")
  )
    throw Error("Only ready questions can enter a test.");
  const a: Attempt = {
    id,
    parentId,
    questions: JSON.parse(JSON.stringify(questions)),
    settings,
    startedAt: now,
    deadline: settings.mode === "timed" ? now + settings.minutes * 60000 : null,
    submittedAt: null,
    current: 0,
    activeSince: now,
    responses: Object.fromEntries(
      questions.map((q) => [q.id, emptyResponse()]),
    ),
    events: [{ type: "start", at: now }],
  };
  a.responses[questions[0].id].visits = 1;
  a.events.push({ type: "visit", at: now, questionId: questions[0].id });
  return a;
}
export type Action =
  | { type: "visit"; index: number }
  | { type: "answer"; values: string[] }
  | { type: "clear" }
  | { type: "mark" }
  | { type: "background" }
  | { type: "foreground" }
  | { type: "submit" }
  | { type: "tick" }
  | { type: "mistake"; questionId: string; reason: (typeof Mistakes)[number] };
export function transition(
  input: Attempt,
  action: Action,
  now = Date.now(),
): Attempt {
  if (input.submittedAt !== null && action.type !== "mistake") return input;
  const a = JSON.parse(JSON.stringify(input)) as Attempt;
  const q = a.questions[a.current];
  const r = a.responses[q.id];
  const flush = () => {
    if (a.activeSince !== null) {
      r.activeMs += Math.max(
        0,
        Math.min(now, a.deadline ?? now) - a.activeSince,
      );
      a.activeSince = null;
    }
  };
  const event = (type: AttemptEvent["type"], values?: string[]) =>
    a.events.push({ type, at: now, questionId: q.id, values });
  if (a.submittedAt === null && a.deadline !== null && now >= a.deadline) {
    flush();
    a.submittedAt = a.deadline;
    event("auto-submit");
    return a;
  }
  switch (action.type) {
    case "tick":
      flush();
      if (input.activeSince !== null) a.activeSince = now;
      break;
    case "visit":
      if (
        action.index < 0 ||
        action.index >= a.questions.length ||
        action.index === a.current
      )
        return input;
      flush();
      event("exit");
      a.current = action.index;
      a.responses[a.questions[action.index].id].visits++;
      a.activeSince = now;
      a.events.push({
        type: "visit",
        at: now,
        questionId: a.questions[action.index].id,
      });
      break;
    case "answer": {
      const values = [...new Set(action.values)].sort();
      if (q.type === "single" && values.length > 1)
        throw Error("Choose one answer.");
      if (
        q.type === "numerical" &&
        values.some((v) => !Number.isFinite(Number(v)) || v.trim() === "")
      )
        throw Error("Enter a valid number.");
      if (
        q.type !== "numerical" &&
        values.some((v) => !q.options.some((o) => o.label === v))
      )
        throw Error("Invalid option.");
      if (JSON.stringify(values) === JSON.stringify([...r.answer].sort()))
        return input;
      if (r.answer.length) r.changes++;
      r.answer = values;
      event("answer", values);
      break;
    }
    case "clear":
      if (r.answer.length) {
        r.changes++;
        r.answer = [];
        event("clear", []);
      }
      break;
    case "mark":
      r.marked = !r.marked;
      event("mark", [String(r.marked)]);
      break;
    case "background":
      flush();
      event("background");
      break;
    case "foreground":
      if (a.activeSince === null) {
        a.activeSince = now;
        event("foreground");
      }
      break;
    case "submit":
      flush();
      a.submittedAt = now;
      event("submit");
      break;
    case "mistake":
      a.responses[action.questionId].mistake = action.reason;
      a.events.push({
        type: "mistake",
        at: now,
        questionId: action.questionId,
        values: [action.reason],
      });
      break;
  }
  return a;
}
export function grade(
  q: Question,
  r: Response,
): "correct" | "incorrect" | "unattempted" | "ungraded" {
  if (!r.answer.length) return "unattempted";
  if (!q.key?.confirmed) return "ungraded";
  if (q.type === "numerical")
    return Math.abs(Number(r.answer[0]) - Number(q.key.values[0])) <=
      q.key.tolerance
      ? "correct"
      : "incorrect";
  return JSON.stringify([...r.answer].sort()) ===
    JSON.stringify([...q.key.values].sort())
    ? "correct"
    : "incorrect";
}
export function revisitTimes(a: Attempt) {
  const totals: Record<string, number> = {};
  const visits: Record<string, number> = {};
  let active: string | undefined, since: number | undefined;
  const close = (at: number) => {
    if (active && since !== undefined && (visits[active] ?? 0) > 1)
      totals[active] =
        (totals[active] ?? 0) +
        Math.max(0, Math.min(at, a.deadline ?? at) - since);
    since = undefined;
  };
  for (const e of a.events) {
    if (e.type === "visit") {
      close(e.at);
      active = e.questionId;
      if (active) visits[active] = (visits[active] ?? 0) + 1;
      since = e.at;
    } else if (e.type === "foreground") {
      active = e.questionId;
      since = e.at;
    } else if (["exit", "background", "submit", "auto-submit"].includes(e.type))
      close(e.at);
  }
  if (a.submittedAt !== null) close(a.submittedAt);
  return totals;
}
const roundedMarks = (value: number) => Number(value.toPrecision(15));
export function metrics(a: Attempt) {
  const revisit = revisitTimes(a);
  const rows = a.questions.map((q) => ({
    id: q.id,
    number: q.number,
    result: grade(q, a.responses[q.id]),
    revisitMs: revisit[q.id] ?? 0,
    changedCorrectToIncorrect: a.events
      .filter((e) => e.questionId === q.id && e.type === "answer")
      .some(
        (event, index, all) =>
          index > 0 &&
          grade(q, {
            ...a.responses[q.id],
            answer: all[index - 1].values ?? [],
          }) === "correct" &&
          grade(q, { ...a.responses[q.id], answer: event.values ?? [] }) ===
            "incorrect",
      ),
    ...a.responses[q.id],
  }));
  const count = (r: string) => rows.filter((x) => x.result === r).length;
  const correct = count("correct"),
    incorrect = count("incorrect");
  const attempted = rows.filter((r) => r.answer.length).length;
  const graded = a.questions.filter((q) => q.key?.confirmed).length;
  return {
    total: rows.length,
    attempted,
    correct,
    incorrect,
    unattempted: rows.length - attempted,
    graded,
    ungraded: count("ungraded"),
    score: graded
      ? roundedMarks(
          correct * a.settings.correct + incorrect * a.settings.incorrect,
        )
      : null,
    maxScore: roundedMarks(graded * a.settings.correct),
    negativeMarks: roundedMarks(incorrect * a.settings.incorrect),
    accuracy:
      correct + incorrect ? (correct / (correct + incorrect)) * 100 : null,
    attemptRate: (attempted / rows.length) * 100,
    elapsedMs: Math.max(0, (a.submittedAt ?? Date.now()) - a.startedAt),
    rows,
  };
}
export function observations(a: Attempt) {
  const m = metrics(a);
  const slow = [...m.rows].sort((x, y) => y.activeMs - x.activeMs);
  return [
    `${m.attempted} of ${m.total} questions attempted (${Math.round(m.attemptRate)}%).`,
    m.graded
      ? `${m.graded} questions have confirmed keys; ${m.correct} correct and ${m.incorrect} incorrect.`
      : "No confirmed answer key. Correctness and score are unavailable.",
    `${m.rows.filter((r) => r.visits > 1).length} questions revisited; ${m.rows.reduce((n, r) => n + r.changes, 0)} answer changes.`,
    slow.length
      ? `Question ${slow[0].number} received the most active time (${Math.round(slow[0].activeMs / 1000)} seconds).`
      : "No timing evidence.",
  ];
}
export function priorities(a: Attempt) {
  return metrics(a)
    .rows.map((r) => ({
      ...r,
      priority:
        (r.result === "incorrect" ? 3 : 0) +
        (r.result === "incorrect" && r.activeMs > 60000 ? 2 : 0) +
        (r.marked && !r.answer.length ? 3 : 0) +
        (r.visits > 1 && r.result === "incorrect" ? 2 : 0) +
        (r.mistake ? 2 : 0) +
        (r.changedCorrectToIncorrect ? 3 : 0),
      reasons: [
        ...(r.result === "incorrect" ? ["Incorrect answer"] : []),
        ...(r.changedCorrectToIncorrect
          ? ["Changed from correct to incorrect (confirmed key)"]
          : []),
        ...(r.result === "incorrect" && r.activeMs > 60000
          ? ["More than one minute active time"]
          : []),
        ...(r.marked && !r.answer.length ? ["Marked and unanswered"] : []),
        ...(r.mistake ? ["Student-reported mistake"] : []),
      ],
    }))
    .sort((x, y) => y.priority - x.priority);
}
export function validateQuestion(q: Question): Question {
  const warnings = q.warnings.filter((w) => !w.startsWith("Validation:"));
  if (!q.text.trim()) warnings.push("Validation: Missing question text");
  if (q.type === "unsupported")
    return { ...q, status: "unsupported", warnings };
  if (
    (q.type === "single" || q.type === "multiple") &&
    (q.options.length < 2 ||
      q.options.some((o) => !o.text.trim()) ||
      new Set(q.options.map((o) => o.label)).size !== q.options.length)
  )
    warnings.push("Validation: Missing or duplicate options");
  if (q.key?.confirmed) {
    const valid =
      q.type === "numerical"
        ? q.key.values.length === 1 &&
          Number.isFinite(Number(q.key.values[0])) &&
          q.key.values[0].trim() !== ""
        : q.key.values.length > 0 &&
          q.key.values.every((v) => q.options.some((o) => o.label === v)) &&
          (q.type !== "single" || q.key.values.length === 1);
    if (!valid)
      warnings.push("Validation: Answer key does not match question format");
  }
  return { ...q, warnings, status: warnings.length ? "needs-review" : "ready" };
}
export * from "./parser.ts";
export * from "./demo.ts";
