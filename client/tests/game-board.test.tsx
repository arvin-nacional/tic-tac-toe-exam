import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import GameBoard from "@/components/game-board";

const initial = {
  _id: "game-1", status: "active",
  players: { X: { name: "Arvin" }, O: { name: "Sam" } },
  rounds: [{ moves: [], result: null }],
  statistics: { X: { wins: 0, losses: 0, draws: 0 }, O: { wins: 0, losses: 0, draws: 0 } },
  currentRound: { number: 1, board: Array(9).fill(null), currentPlayer: "X", status: "in_progress" },
};
const fetchMock = vi.fn();
const ok = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

test("loads the server board and identifies the current player", async () => {
  let resolve!: (value: unknown) => void;
  fetchMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  render(<GameBoard sessionId="game-1" />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading game");
  await act(async () => resolve(ok(initial)));
  expect(screen.getByRole("heading", { name: "Arvin vs Sam" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Arvin's turn (X)");
  expect(screen.getAllByRole("button", { name: /Row \d, column \d: empty/ })).toHaveLength(9);
  expect(fetchMock).toHaveBeenCalledWith("/api/sessions/game-1", expect.objectContaining({ cache: "no-store" }));
});

const finished = {
  ...initial, rounds: [{ moves: [], result: "X" }],
  currentRound: { ...initial.currentRound, status: "finished", currentPlayer: null },
  statistics: { X: { wins: 2, losses: 1, draws: 1 }, O: { wins: 1, losses: 2, draws: 1 } },
};

test("shows server scores but no Continue or Stop during an active round", async () => {
  fetchMock.mockResolvedValueOnce(ok(initial));
  render(<GameBoard sessionId="game-1" />);
  const scores = await screen.findByRole("table", { name: "Session scores" });
  expect(within(scores).getByRole("row", { name: "Arvin (X) 0 0 0" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
});

test("Continue submits once and loads a new round without resetting scores", async () => {
  let resolve!: (value: unknown) => void;
  fetchMock.mockResolvedValueOnce(ok(finished))
    .mockReturnValueOnce(new Promise((done) => { resolve = done; }))
    .mockResolvedValueOnce(ok({ ...initial, statistics: finished.statistics,
      rounds: [...finished.rounds, { result: null }], currentRound: { ...initial.currentRound, number: 2 },
    }));
  render(<GameBoard sessionId="game-1" />);
  const button = await screen.findByRole("button", { name: "Continue" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenLastCalledWith("/api/sessions/game-1/rounds", expect.objectContaining({ method: "POST" }));
  await act(async () => resolve(ok({})));
  expect(await screen.findByText("Round 2")).toBeInTheDocument();
  expect(screen.getByRole("row", { name: "Arvin (X) 2 1 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Row 1, column 1: empty" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
});

test("Stop waits for confirmation and returns to history exactly once", async () => {
  const onStopped = vi.fn();
  let resolve!: (value: unknown) => void;
  fetchMock.mockResolvedValueOnce(ok(finished)).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  render(<GameBoard sessionId="game-1" onStopped={onStopped} />);
  const button = await screen.findByRole("button", { name: "Stop" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(onStopped).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(fetchMock).toHaveBeenLastCalledWith("/api/sessions/game-1/complete", expect.objectContaining({ method: "POST" }));
  await act(async () => resolve(ok({})));
  expect(onStopped).toHaveBeenCalledTimes(1);
});

test.each(["Continue", "Stop"])("failed %s locks actions until a read refresh, without automatic resend", async (action) => {
  const onStopped = vi.fn();
  fetchMock.mockResolvedValueOnce(ok(finished)).mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(ok({ ...finished, status: "completed" }));
  render(<GameBoard sessionId="game-1" onStopped={onStopped} />);
  fireEvent.click(await screen.findByRole("button", { name: action }));
  await screen.findByRole("alert");
  expect(onStopped).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh game" }));
  fireEvent.click(await screen.findByRole("button", { name: "Return to history" }));
  expect(onStopped).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

test("sends one move, locks the board while pending, and displays refreshed server state", async () => {
  fetchMock.mockResolvedValueOnce(ok(initial));
  let resolve!: (value: unknown) => void;
  fetchMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  fetchMock.mockResolvedValueOnce(ok({ ...initial, currentRound: {
    ...initial.currentRound, board: [null, null, null, null, "X", null, null, null, null], currentPlayer: "O",
  } }));
  render(<GameBoard sessionId="game-1" />);
  const center = await screen.findByRole("button", { name: "Row 2, column 2: empty" });
  fireEvent.click(center);
  fireEvent.click(center);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenLastCalledWith("/api/sessions/game-1/moves", expect.objectContaining({
    method: "POST", body: JSON.stringify({ player: "X", cellIndex: 4 }),
  }));
  for (const cell of screen.getAllByRole("button", { name: /Row/ })) expect(cell).toBeDisabled();
  expect(center).toHaveTextContent("");
  await act(async () => resolve(ok({})));
  expect(await screen.findByRole("button", { name: "Row 2, column 2: X" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Sam's turn (O)");
  expect(screen.getByRole("button", { name: "Row 1, column 1: empty" })).toBeEnabled();
});

test.each(["http", "network"])("locks stale state after a %s move failure and refreshes without resending", async (failure) => {
  fetchMock.mockResolvedValueOnce(ok(initial));
  if (failure === "http") fetchMock.mockResolvedValueOnce({ ok: false });
  else fetchMock.mockRejectedValueOnce(new Error("Offline"));
  fetchMock.mockResolvedValueOnce(ok(initial));
  render(<GameBoard sessionId="game-1" />);
  fireEvent.click(await screen.findByRole("button", { name: "Row 1, column 1: empty" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to update game. Refresh to check the latest state.");
  expect(screen.getByRole("button", { name: "Row 1, column 1: empty" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh game" }));
  expect(await screen.findByRole("button", { name: "Row 1, column 1: empty" })).toBeEnabled();
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

test("recovers from a failed initial load", async () => {
  fetchMock.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(ok(initial));
  render(<GameBoard sessionId="game-1" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load game.");
  fireEvent.click(screen.getByRole("button", { name: "Refresh game" }));
  expect(await screen.findByRole("button", { name: "Row 1, column 1: empty" })).toBeEnabled();
});

test("does not resend a saved move when the following state refresh fails", async () => {
  const updated = { ...initial, currentRound: {
    ...initial.currentRound, board: ["X", null, null, null, null, null, null, null, null], currentPlayer: "O",
  } };
  fetchMock.mockResolvedValueOnce(ok(initial)).mockResolvedValueOnce(ok({}))
    .mockRejectedValueOnce(new Error("Read failed")).mockResolvedValueOnce(ok(updated));
  render(<GameBoard sessionId="game-1" />);
  fireEvent.click(await screen.findByRole("button", { name: "Row 1, column 1: empty" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Refresh game" }));
  expect(await screen.findByRole("button", { name: "Row 1, column 1: X" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("Sam's turn (O)");
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
});

test.each(["X", "draw"])("shows a server-reported %s result and disables every cell", async (result) => {
  fetchMock.mockResolvedValueOnce(ok({ ...initial, rounds: [{ moves: [], result }],
    currentRound: { ...initial.currentRound, status: "finished", currentPlayer: null },
  }));
  render(<GameBoard sessionId="game-1" />);
  await screen.findByRole("heading", { name: "Arvin vs Sam" });
  expect(screen.getByRole("status")).toHaveTextContent(result === "X" ? "Arvin wins this round!" : "This round is a draw.");
  for (const cell of screen.getAllByRole("button", { name: /Row/ })) expect(cell).toBeDisabled();
});
