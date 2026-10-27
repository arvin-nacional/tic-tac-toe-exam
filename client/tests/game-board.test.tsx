import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import GameBoard from "@/components/game-board";

const initial = {
  _id: "game-1", status: "active",
  players: { X: { name: "Arvin" }, O: { name: "Sam" } },
  rounds: [{ moves: [], result: null }],
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
