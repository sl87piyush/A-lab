import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import {
  Home,
  Configure,
  AttemptScreen,
  ResultScreen,
  ReviewScreen,
  ImportScreen,
} from "../src/screens";
import { demoQuestions, startAttempt, transition } from "@attemply/shared";
import { initialData } from "../src/storage";
import { useStore } from "../src/store";
import { router } from "expo-router";
import { upload, downloadThumbnail, request } from "../src/api";
jest.mock("../src/api", () => ({
  ...jest.requireActual("../src/api"),
  upload: jest.fn(),
  downloadThumbnail: jest.fn(),
  request: jest.fn(),
}));
jest.mock("../src/store", () => ({ useStore: jest.fn() }));
const initial = () =>
  startAttempt("test-attempt", demoQuestions, {
    title: "Sample CBT",
    minutes: 20,
    correct: 4,
    incorrect: -1,
    mode: "timed",
  });
function setup(attempt = initial()) {
  const store = {
    data: { ...initialData, questions: demoQuestions, attempts: [attempt] },
    update: jest.fn(async (fn: any) => {
      store.data = fn(store.data);
    }),
    act: jest.fn(async () => {}),
    effective: (a: any) => a,
  };
  (useStore as jest.Mock).mockImplementation(() => store);
  return store;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
it("offers offline demo and real document entry points on Home", async () => {
  setup();
  const screen = await render(<Home />);
  expect(screen.getByText("Scan questions")).toBeTruthy();
  expect(screen.getByText("Upload PDF")).toBeTruthy();
  await fireEvent.press(screen.getByText("Try demo CBT →"));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/configure"));
});
it("starts a real attempt from native configuration", async () => {
  const store = setup();
  const screen = await render(<Configure />);
  await fireEvent.press(screen.getByText("Start timed test →"));
  await waitFor(() => expect(store.update).toHaveBeenCalled());
  expect(store.data.attempts).toHaveLength(2);
  expect(store.data.attempts[0].questions).toHaveLength(8);
});
it("selects, clears and marks through CBT controls without displaying the answer key", async () => {
  const store = setup();
  const screen = await render(<AttemptScreen />);
  await fireEvent.press(screen.getByLabelText("Option B: 18 km/h"));
  await waitFor(() =>
    expect(store.act).toHaveBeenCalledWith("test-attempt", {
      type: "answer",
      values: ["B"],
    }),
  );
  await fireEvent.press(screen.getByText("Mark for review"));
  await waitFor(() =>
    expect(store.act).toHaveBeenCalledWith("test-attempt", { type: "mark" }),
  );
  await fireEvent.press(screen.getByText("Clear response"));
  await waitFor(() =>
    expect(store.act).toHaveBeenCalledWith("test-attempt", { type: "clear" }),
  );
  expect(screen.queryByText(/Confirmed key:/)).toBeNull();
});
it("renders computed results and exposes review and analysis", async () => {
  let a = initial();
  a = transition(a, { type: "answer", values: ["B"] });
  a = transition(a, { type: "submit" });
  setup(a);
  const screen = await render(<ResultScreen />);
  expect(screen.getByText("Explore your analysis →")).toBeTruthy();
  expect(screen.getByText("Review questions & mistakes")).toBeTruthy();
  expect(screen.getByText("13%")).toBeTruthy();
});
it("records only user-selected mistake reasons", async () => {
  const a = transition(initial(), { type: "submit" });
  const store = setup(a);
  const screen = await render(<ReviewScreen />);
  await fireEvent.press(screen.getByText("Calculation error"));
  await waitFor(() =>
    expect(store.act).toHaveBeenCalledWith("test-attempt", {
      type: "mistake",
      questionId: "demo-1",
      reason: "Calculation error",
    }),
  );
});
it("offers a recovery path when camera permission is denied", async () => {
  setup();
  const screen = await render(<ImportScreen />);
  await fireEvent.press(screen.getByText("Camera"));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      "Camera access needed",
      expect.any(String),
      expect.any(Array),
    ),
  );
});

it("keeps saved attempts beyond the twentieth accessible in history", async () => {
  const base = transition(initial(), { type: "submit" });
  const store = setup(base);
  store.data.attempts = Array.from({ length: 25 }, (_, i) => ({
    ...base,
    id: "history-" + i,
    settings: { ...base.settings, title: "Saved exam " + (i + 1) },
  }));
  const screen = await render(<Home />);
  expect(screen.getByText("Saved exam 25")).toBeTruthy();
});
it("re-prepares an expired server document from its preserved local file", async () => {
  const store = setup();
  const source = {
    id: "source",
    name: "paper.pdf",
    uri: "file://permanent/paper.pdf",
    originalUri: "file://permanent/paper.pdf",
    mime: "application/pdf",
    serverId: "old-server-id",
    pageCount: 1,
    selected: [0],
  };
  store.data.sources = [source];
  (upload as jest.Mock).mockResolvedValue({
    id: "fresh-server-id",
    pageCount: 1,
  });
  (downloadThumbnail as jest.Mock).mockResolvedValue(
    "file://permanent/new-thumb.jpg",
  );
  const screen = await render(<ImportScreen />);
  await fireEvent.press(screen.getByText("Prepare source again"));
  await waitFor(() =>
    expect(store.data.sources[0].serverId).toBe("fresh-server-id"),
  );
  expect(upload).toHaveBeenCalledWith(source);
  expect(store.data.sources[0].originalUri).toBe(source.originalUri);
});
it("protects original sources referenced by submitted attempts from accidental removal", async () => {
  const attempt = transition(initial(), { type: "submit" });
  const store = setup(attempt);
  store.data.sources = [
    {
      id: "sample-original",
      name: "sample.png",
      uri: "file://permanent/sample.png",
      originalUri: "file://permanent/sample.png",
      mime: "image/png",
      selected: [0],
    },
  ];
  const screen = await render(<ImportScreen />);
  await fireEvent.press(screen.getByText("Remove"));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      "Something needs attention",
      expect.stringContaining("linked to saved questions"),
    ),
  );
  expect(store.data.sources).toHaveLength(1);
});

it("replaces the old draft after re-extraction without duplicating the preserved source", async () => {
  const store = setup();
  const originalUri = "file://permanent/source.png";
  store.data.questions = [
    {
      ...demoQuestions[0],
      id: "old",
      source: { documentId: "old-server", pages: [0], originalUri },
    },
  ];
  store.data.sources = [
    {
      id: "local-source",
      name: "source.png",
      mime: "image/png",
      uri: originalUri,
      originalUri,
      serverId: "new-server",
      selected: [0],
    },
  ];
  store.data.pending = [
    {
      id: "job",
      sourceId: "local-source",
      purpose: "questions",
      state: "queued",
    },
  ];
  const next = {
    ...demoQuestions[0],
    id: "new",
    source: { documentId: "new-server", pages: [0] },
  };
  (request as jest.Mock).mockImplementation(async (path: string) =>
    path.endsWith("/status")
      ? { state: "complete" }
      : {
          result: { questions: [next], ignored: [], pages: [], warnings: [] },
          keys: [],
        },
  );
  await render(<ImportScreen />);
  await waitFor(() =>
    expect(store.data.questions.map((q) => q.id)).toEqual(["new"]),
  );
  expect(store.data.questions[0].source.originalUri).toBe(originalUri);
  expect(store.data.attempts).toHaveLength(1);
});
