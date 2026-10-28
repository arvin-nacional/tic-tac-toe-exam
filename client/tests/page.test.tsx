import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Home from "@/app/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

test("shows a loading state while history is being fetched", () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  render(<Home />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading completed sessions");
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/sessions?status=completed",
    expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
  );
});

test("shows an empty state when no sessions have been completed", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
  render(<Home />);
  expect(await screen.findByText("No completed sessions yet.")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("renders scores, round counts, and completion dates in API order", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => [
    {
      _id: "newer", players: { X: { name: "Arvin" }, O: { name: "Sam" } },
      roundCount: 4, completedAt: "2026-10-27T10:00:00.000Z",
      statistics: { X: { wins: 2, losses: 1, draws: 1 }, O: { wins: 1, losses: 2, draws: 1 } },
    },
    {
      _id: "older", players: { X: { name: "Alex" }, O: { name: "Jo" } },
      roundCount: 1, completedAt: "2026-10-26T10:00:00.000Z",
      statistics: { X: { wins: 0, losses: 0, draws: 1 }, O: { wins: 0, losses: 0, draws: 1 } },
    },
  ] });
  render(<Home />);
  const cards = await screen.findAllByRole("article");
  expect(within(cards[0]).getByRole("heading", { name: "Arvin vs Sam" })).toBeInTheDocument();
  expect(within(cards[0]).getByText("4 rounds")).toBeInTheDocument();
  expect(within(cards[0]).getByRole("row", { name: "Arvin (X) 2 1 1" })).toBeInTheDocument();
  expect(within(cards[0]).getByRole("row", { name: "Sam (O) 1 2 1" })).toBeInTheDocument();
  expect(cards[0].querySelector("time")).toHaveAttribute("datetime", "2026-10-27T10:00:00.000Z");
  expect(within(cards[1]).getByRole("heading", { name: "Alex vs Jo" })).toBeInTheDocument();
  expect(within(cards[1]).getByText("1 round")).toBeInTheDocument();
});

test.each(["http", "network"])("shows a recoverable error for a %s failure", async (failure) => {
  if (failure === "http") fetchMock.mockResolvedValueOnce({ ok: false });
  else fetchMock.mockRejectedValueOnce(new Error("Network failed"));
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
  render(<Home />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load completed sessions.");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No completed sessions yet.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
