import { it, expect, vi, afterAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  demoQuestions,
  startAttempt,
  transition,
} from "../packages/shared/src/index.js";
const storage = vi.hoisted(() => ({ path: "", databases: [] as any[] }));
vi.mock("expo-file-system", () => ({
  Directory: class {
    exists = true;
    create() {}
    delete() {}
  },
  File: class {},
  Paths: { document: "/mock-documents" },
}));
vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => {
    const db = new DatabaseSync(storage.path);
    storage.databases.push(db);
    return {
      execAsync: async (sql: string) => db.exec(sql),
      getFirstAsync: async (sql: string, ...params: any[]) =>
        db.prepare(sql).get(...params),
      getAllAsync: async (sql: string, ...params: any[]) =>
        db.prepare(sql).all(...params),
      runAsync: async (sql: string, ...params: any[]) =>
        db.prepare(sql).run(...params),
      withTransactionAsync: async (fn: () => Promise<void>) => {
        db.exec("BEGIN");
        try {
          await fn();
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    };
  },
}));
import { openData, saveData, eraseData } from "../apps/mobile/src/storage.js";
const dir = mkdtempSync(join(tmpdir(), "attemply-sqlite-"));
storage.path = join(dir, "test.db");
afterAll(() => {
  storage.databases.forEach((db) => db.close());
  rmSync(dir, { recursive: true, force: true });
});
it("migrates SQLite, saves responses/events and recovers without counting closed-app time", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(5000);
  const d = await openData();
  const a = transition(
    startAttempt(
      "saved",
      demoQuestions,
      {
        title: "Persistent",
        minutes: 1,
        correct: 4,
        incorrect: -1,
        mode: "timed",
      },
      1000,
    ),
    { type: "answer", values: ["B"] },
    2000,
  );
  d.attempts = [a];
  await saveData(d);
  clock.mockReturnValue(20000);
  const reopened = await openData();
  expect(reopened.attempts[0].responses["demo-1"].answer).toEqual(["B"]);
  expect(reopened.attempts[0].responses["demo-1"].activeMs).toBe(4000);
  expect(reopened.attempts[0].activeSince).toBeNull();
  expect(reopened.attempts[0].deadline).toBe(61000);
  expect(reopened.attempts[0].events.slice(0, -1)).toEqual(a.events);
  expect(reopened.attempts[0].events.at(-1)?.type).toBe("background");
  await saveData(reopened);
  const again = await openData();
  expect(again.attempts[0].responses["demo-1"].activeMs).toBe(4000);
  await eraseData();
  expect((await openData()).attempts).toHaveLength(0);
  clock.mockRestore();
});
