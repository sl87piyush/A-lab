import * as SQLite from "expo-sqlite";
import { Directory, File, Paths } from "expo-file-system";
import type {
  Attempt,
  Question,
  Parsed,
  Settings,
  SourceKey,
} from "@attemply/shared";
export type Source = {
  id: string;
  uri: string;
  originalUri: string;
  name: string;
  mime: string;
  width?: number;
  height?: number;
  serverId?: string;
  pageCount?: number;
  thumbnails?: string[];
  selected: number[];
};
export type Pending = {
  id: string;
  sourceId: string;
  purpose: "questions" | "key";
  state: string;
  error?: string;
};
export type Data = {
  questions: Question[];
  ignored: Parsed["ignored"];
  sources: Source[];
  attempts: Attempt[];
  pending: Pending[];
  debug: unknown;
  keys: SourceKey[];
  keyRevisions: Record<string, NonNullable<Question["key"]>[]>;
  reports: Record<string, unknown>;
  draftTitle: string;
  settings: Settings;
};
export const initialData: Data = {
  questions: [],
  ignored: [],
  sources: [],
  attempts: [],
  pending: [],
  debug: null,
  keys: [],
  keyRevisions: {},
  reports: {},
  draftTitle: "My question set",
  settings: {
    title: "My practice test",
    minutes: 20,
    correct: 4,
    incorrect: -1,
    mode: "timed",
  },
};
export const fileRoot = new Directory(Paths.document, "attemply");
let db: SQLite.SQLiteDatabase;
export async function openData(): Promise<Data> {
  fileRoot.create({ idempotent: true, intermediates: true });
  db = await SQLite.openDatabaseAsync("attemply.db");
  await db.execAsync("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  const version = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  if ((version?.user_version ?? 0) < 1)
    await db.withTransactionAsync(async () => {
      await db.execAsync(
        "CREATE TABLE IF NOT EXISTS state (id TEXT PRIMARY KEY, payload TEXT NOT NULL, saved_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, payload TEXT NOT NULL, saved_at INTEGER NOT NULL); PRAGMA user_version=1;",
      );
    });
  const row = await db.getFirstAsync<{ payload: string; saved_at: number }>(
    "SELECT payload,saved_at FROM state WHERE id='main'",
  );
  const attempts = await db.getAllAsync<{ payload: string; saved_at: number }>(
    "SELECT payload,saved_at FROM attempts ORDER BY saved_at DESC",
  );
  const state: Data = row
    ? { ...initialData, ...JSON.parse(row.payload) }
    : (JSON.parse(JSON.stringify(initialData)) as Data);
  state.attempts = attempts.map((r) => {
    const a = JSON.parse(r.payload) as Attempt; // Downtime is never active reading time.
    if (a.activeSince !== null) {
      a.responses[a.questions[a.current].id].activeMs += Math.max(
        0,
        Math.min(r.saved_at, a.deadline ?? r.saved_at) - a.activeSince,
      );
      a.activeSince = null;
      a.events.push({
        type: "background",
        at: Math.min(r.saved_at, a.deadline ?? r.saved_at),
        questionId: a.questions[a.current].id,
      });
    }
    return a;
  });
  return state;
}
let tail = Promise.resolve();
let savedMetadata: Omit<Data, "attempts"> | undefined;
const savedAttempts = new Map<string, Attempt>();
export function saveData(data: Data) {
  const next = tail
    .catch(() => {})
    .then(async () => {
      const { attempts, ...metadata } = data;
      const changed =
        !savedMetadata ||
        Object.keys(metadata).some(
          (key) =>
            metadata[key as keyof typeof metadata] !==
            savedMetadata![key as keyof typeof metadata],
        );
      const dirty = attempts.filter(
        (attempt) => savedAttempts.get(attempt.id) !== attempt,
      );
      const saved = Date.now();
      await db.withTransactionAsync(async () => {
        if (changed)
          await db.runAsync(
            "INSERT OR REPLACE INTO state (id,payload,saved_at) VALUES ('main',?,?)",
            JSON.stringify(metadata),
            saved,
          );
        for (const attempt of dirty)
          await db.runAsync(
            "INSERT OR REPLACE INTO attempts (id,payload,saved_at) VALUES (?,?,?)",
            attempt.id,
            JSON.stringify(attempt),
            saved,
          );
      });
      savedMetadata = metadata;
      for (const attempt of dirty) savedAttempts.set(attempt.id, attempt);
    });
  tail = next;
  return next;
}
export async function eraseData() {
  await tail.catch(() => {});
  savedMetadata = undefined;
  savedAttempts.clear();
  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM state; DELETE FROM attempts;");
  });
  if (fileRoot.exists) fileRoot.delete();
  fileRoot.create({ intermediates: true, idempotent: true });
}
export function persistFile(uri: string, name: string) {
  const ext =
    name
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]/gi, "") || "bin";
  const out = new File(fileRoot, `${uid()}.${ext}`);
  new File(uri).copy(out);
  return out.uri;
}
export function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
