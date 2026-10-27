import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Home from "@/app/page";

const fetchMock = vi.fn();
const session = { _id: "session-1", players: { X: { name: "Arvin" }, O: { name: "Sam" } } };
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({
    ...session, status: "active", rounds: [{ result: null }],
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

test("submits trimmed names once and displays server-confirmed players", async () => {
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
  expect(await screen.findByRole("heading", { name: "Arvin vs Sam" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Arvin's turn (X)");
  expect(screen.getAllByRole("button", { name: /Row/ })).toHaveLength(9);
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
});

test.each(["http", "network"])("preserves names and allows retry after a %s error", async (failure) => {
  if (failure === "http") fetchMock.mockResolvedValueOnce({ ok: false });
  else fetchMock.mockRejectedValueOnce(new Error("Network failed"));
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => session });
  await openForm();
  fillNames();
  fireEvent.submit(screen.getByRole("form", { name: "New game" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create game. Please try again.");
  expect(screen.getByLabelText("Player X name")).toHaveValue("Arvin");
  expect(screen.getByLabelText("Player O name")).toHaveValue("Sam");
  fireEvent.submit(screen.getByRole("form", { name: "New game" }));
  expect(await screen.findByRole("heading", { name: "Arvin vs Sam" })).toBeInTheDocument();
});
