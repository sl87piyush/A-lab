import type { Question } from "./index.ts";
const data: [string, string[], string, string?][] = [
  [
    "A cyclist travels 36 km in 2 hours. What is the average speed?",
    ["12 km/h", "18 km/h", "24 km/h", "36 km/h"],
    "B",
    "Average speed = distance ÷ time = 36 ÷ 2 = 18 km/h.",
  ],
  [
    "Solve $2x + 5 = 17$.",
    ["4", "5", "6", "7"],
    "C",
    "Subtract 5, then divide by 2.",
  ],
  [
    "Which gas do green plants absorb during photosynthesis?",
    ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"],
    "C",
  ],
  [
    "A body of mass $2\\,kg$ accelerates at $3\\,m/s^2$. Find the net force.",
    ["1.5 N", "5 N", "6 N", "9 N"],
    "C",
    "$F=ma=6\\,N$.",
  ],
  [
    "The diagram shows a right triangle with legs 3 and 4. What is its hypotenuse?",
    ["4", "5", "6", "7"],
    "B",
    "Use the Pythagorean theorem: $c=\\sqrt{3^2+4^2}=5$.",
  ],
  ["Select every prime number below.", ["2", "9", "11", "15"], "A,C"],
  ["Enter the value of $\\frac{3}{4} + \\frac{1}{4}$.", [], "1"],
  [
    "A fair six-sided die is rolled once. What is the probability of a 6?",
    ["$1/2$", "$1/3$", "$1/6$", "$5/6$"],
    "C",
  ],
];
export const demoQuestions: Question[] = data.map(
  ([text, options, answer, explanation], i) => ({
    id: `demo-${i + 1}`,
    number: String(i + 1),
    section: i < 4 ? "Foundations" : "Reasoning",
    text,
    options: options.map((text, j) => ({ label: "ABCD"[j], text })),
    type: i === 5 ? "multiple" : i === 6 ? "numerical" : "single",
    images:
      i === 4 ? [{ id: "demo-triangle", uri: "demo:triangle", page: 0 }] : [],
    source: { documentId: "sample-original", pages: [0] },
    warnings: [],
    status: "ready",
    key: {
      values: answer.split(","),
      provenance: "demo",
      confirmed: true,
      tolerance: 0,
      updatedAt: 0,
    },
    explanation,
  }),
);
