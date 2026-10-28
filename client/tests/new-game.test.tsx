import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Home from "@/app/page";
import ActiveGame from "@/components/active-game";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const fetchMock = vi.fn();
const session = { _id: "session-1", players: { X: { name: "Arvin" }, O: { name: "Sam" } } };
beforeEach(() => {
  navigation.push.mockReset();
  navigation.replace.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({
    ...session, status: "active", rounds: [{ result: null }],
    statistics: { X: { wins: 0, losses: 0, draws: 0 }, O: { wins: 0, losses: 0, draws: 0 } },
    currentRound: { number: 1, board: Array(9).fill(null), currentPlayer: "X", status: "in_progress" },
  }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function openForm() {
  render(<Home />);
  await screen.findByText("No completed sessions yet.");
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));
}

function fillNames(x = "Arvin", o = "Sam") {
  fireEvent.change(screen.getByLabelText("Player X name"), { target: { value: x } });
  fireEvent.change(screen.getByLabelText("Player O name"), { target: { value: o } });
}

test("opens the name form and cancels without creating a session", async () => {
  await openForm();
  expect(screen.getByRole("form", { name: "New game" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([["", "Sam"], ["Arvin", ""], ["   ", "Sam"]])("rejects blank names (%s, %s)", async (x, o) => {
  await openForm();
  fillNames(x, o);
  fireEvent.submit(screen.getByRole("form", { name: "New game" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter both player names.");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("submits trimmed names once and navigates to the created session URL", async () => {
  let resolveRequest!: (value: unknown) => void;
  fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));
  await openForm();
  fillNames(" Arvin ", " Sam ");
  const form = screen.getByRole("form", { name: "New game" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(screen.getByRole("button", { name: "Creating game…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenLastCalledWith("/api/sessions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players: { X: { name: "Arvin" }, O: { name: "Sam" } } }),
  });
  await act(async () => resolveRequest({ ok: true, json: async () => session }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/game/session-1"));
  // Keep the form locked until Next.js finishes navigating to the game page.
  expect(screen.getByRole("button", { name: "Creating game…" })).toBeDisabled();
  fireEvent.submit(form);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(navigation.push).toHaveBeenCalledTimes(1);
});

test("Stop returns to the home URL after saving completion", async () => {
  const statistics = { X: { wins: 1, losses: 0, draws: 0 }, O: { wins: 0, losses: 1, draws: 0 } };
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({
      ...session, status: "active", statistics, rounds: [{ result: "X" }],
      currentRound: { number: 1, board: ["X", "X", "X", "O", "O", null, null, null, null], currentPlayer: null, status: "finished" },
    }) })
    .mockResolvedValueOnce({ ok: true });
  render(<ActiveGame sessionId="session-1" />);
  fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
  expect(fetchMock).toHaveBeenLastCalledWith("/api/sessions/session-1/complete", expect.objectContaining({ method: "POST" }));
});

test.each(["http", "network"])("preserves names and allows retry after a %s error", async (failure) => {
  if (failure === "http") fetchMock.mockResolvedValueOnce({ ok: false });
  else fetchMock.mockRejectedValueOnce(new Error("Network failed"));
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => session });
  await openForm();
  fillNames();
  fireEvent.submit(screen.getByRole("form", { name: "New game" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create game. Please try again.");
  expect(navigation.push).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Player X name")).toHaveValue("Arvin");
  expect(screen.getByLabelText("Player O name")).toHaveValue("Sam");
  fireEvent.submit(screen.getByRole("form", { name: "New game" }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/game/session-1"));
});
