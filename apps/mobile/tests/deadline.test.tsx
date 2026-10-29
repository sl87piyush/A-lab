import React from "react";
import { Text } from "react-native";
import { render, act, waitFor } from "@testing-library/react-native";
import { Provider, useStore } from "../src/store";
import { initialData, openData, saveData } from "../src/storage";
import { demoQuestions, startAttempt } from "@attemply/shared";
jest.mock("../src/storage", () => ({
  ...jest.requireActual("../src/storage"),
  openData: jest.fn(),
  saveData: jest.fn(async () => {}),
}));
function HomeProbe() {
  const store = useStore();
  return (
    <Text>
      {store.ready
        ? store.data.attempts[0].submittedAt === null
          ? "incomplete"
          : "submitted"
        : "opening"}
    </Text>
  );
}
it("submits an expired attempt while Home is visible, without mounting the CBT screen", async () => {
  jest.useFakeTimers();
  try {
    const startedAt = Date.now() - 59000;
    const attempt = startAttempt(
      "deadline-at-home",
      demoQuestions,
      {
        title: "Deadline",
        minutes: 1,
        correct: 4,
        incorrect: -1,
        mode: "timed",
      },
      startedAt,
    );
    attempt.activeSince = null;
    (openData as jest.Mock).mockResolvedValue({
      ...initialData,
      attempts: [attempt],
    });
    const screen = await render(
      <Provider>
        <HomeProbe />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText("incomplete")).toBeTruthy());
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByText("submitted")).toBeTruthy();
    const calls = (saveData as jest.Mock).mock.calls;
    expect(calls.at(-1)[0].attempts[0].submittedAt).toBe(attempt.deadline);
    expect(calls.at(-1)[0].attempts[0].events.at(-1).type).toBe("auto-submit");
  } finally {
    jest.useRealTimers();
  }
});
