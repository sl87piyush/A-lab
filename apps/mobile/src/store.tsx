import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { transition, type Action, type Attempt } from "@attemply/shared";
import {
  initialData,
  openData,
  saveData,
  eraseData,
  type Data,
} from "./storage";
type Store = {
  data: Data;
  ready: boolean;
  error: string | null;
  update: (fn: (d: Data) => Data) => Promise<void>;
  act: (id: string, action: Action) => Promise<void>;
  effective: (a: Attempt) => Attempt;
  clear: () => Promise<void>;
  retry: () => void;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(initialData);
  const ref = useRef(data);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryId, setRetry] = useState(0);
  useEffect(() => {
    openData()
      .then((d) => {
        d.attempts = d.attempts.map((a) =>
          a.deadline !== null &&
          Date.now() >= a.deadline &&
          a.submittedAt === null
            ? transition(a, { type: "tick" })
            : a,
        );
        ref.current = d;
        setData(d);
        setReady(true);
        setError(null);
      })
      .catch(() =>
        setError(
          "Local database could not open. Free device space and retry. Your saved files have not been deleted.",
        ),
      );
  }, [retryId]);
  async function update(fn: (d: Data) => Data) {
    const next = fn(ref.current);
    ref.current = next;
    setData(next);
    try {
      await saveData(next);
      setError(null);
    } catch {
      setError(
        "Could not save locally. Free device storage and retry saving before leaving.",
      );
      throw Error("Local save failed.");
    }
  }
  async function act(id: string, action: Action) {
    return update((d) => ({
      ...d,
      attempts: d.attempts.map((a) =>
        a.id === id ? transition(a, action) : a,
      ),
    }));
  }
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (!ready) return;
      const now = Date.now();
      void update((d) => ({
        ...d,
        attempts: d.attempts.map((a) =>
          a.submittedAt === null
            ? transition(
                a,
                { type: state === "active" ? "tick" : "background" },
                now,
              )
            : a,
        ),
      })).catch(() => {});
    });
    const deadlineTimer = setInterval(() => {
      if (!ready) return;
      const now = Date.now();
      if (
        !ref.current.attempts.some(
          (attempt) =>
            attempt.submittedAt === null &&
            attempt.deadline !== null &&
            now >= attempt.deadline,
        )
      )
        return;
      void update((d) => ({
        ...d,
        attempts: d.attempts.map((attempt) =>
          attempt.submittedAt === null &&
          attempt.deadline !== null &&
          now >= attempt.deadline
            ? transition(attempt, { type: "tick" }, now)
            : attempt,
        ),
      })).catch(() => {});
    }, 1000);
    return () => {
      sub.remove();
      clearInterval(deadlineTimer);
    };
  }, [ready]);
  const effective = (a: Attempt) => ({
    ...a,
    questions: a.questions.map((q) => {
      const revisions = data.keyRevisions[q.id];
      return revisions?.length
        ? { ...q, key: revisions[revisions.length - 1] }
        : q;
    }),
  });
  return (
    <Context.Provider
      value={{
        data,
        ready,
        error,
        update,
        act,
        effective,
        clear: async () => {
          await eraseData();
          ref.current = JSON.parse(JSON.stringify(initialData)) as Data;
          setData(ref.current);
        },
        retry: () => {
          if (ready)
            void saveData(ref.current)
              .then(() => setError(null))
              .catch(() => {});
          else setRetry((x) => x + 1);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw Error("Missing app store");
  return value;
}
