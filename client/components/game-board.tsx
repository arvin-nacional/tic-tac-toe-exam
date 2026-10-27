"use client";

import { useEffect, useRef, useState } from "react";
import { getSession, submitMove, updateSession, type GameSession } from "@/lib/api/sessions";

export default function GameBoard({ sessionId, onStopped }: { sessionId: string; onStopped?: () => void }) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    getSession(sessionId, controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) setSession(loaded);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Unable to load game.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          busy.current = false;
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [sessionId, attempt]);

  async function play(cellIndex: number) {
    const signal = controllerRef.current?.signal;
    const player = session?.currentRound.currentPlayer;
    if (!session || !signal || busy.current || error || !player
      || session.status !== "active" || session.currentRound.status !== "in_progress"
      || session.currentRound.board[cellIndex] !== null) return;

    busy.current = true;
    setPending(true);
    try {
      await submitMove(sessionId, player, cellIndex, signal);
      const updated = await getSession(sessionId, signal);
      if (!signal.aborted) setSession(updated);
    } catch {
      if (!signal.aborted) setError("Unable to update game. Refresh to check the latest state.");
    } finally {
      if (!signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  }

  async function finishAction(action: "rounds" | "complete") {
    const signal = controllerRef.current?.signal;
    if (!signal || !session || busy.current || error || session.status !== "active"
      || session.currentRound.status !== "finished") return;
    busy.current = true;
    setPending(true);
    try {
      await updateSession(sessionId, action, signal);
      if (action === "complete") {
        if (!signal.aborted) {
          setSession({ ...session, status: "completed" });
          onStopped?.();
        }
      } else {
        const updated = await getSession(sessionId, signal);
        if (!signal.aborted) setSession(updated);
      }
    } catch {
      if (!signal.aborted) setError("Unable to update game. Refresh to check the latest state.");
    } finally {
      if (!signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  }

  if (loading) return <p role="status" className="mb-8 p-6">Loading game…</p>;

  const round = session?.currentRound;
  const result = session?.rounds[(round?.number ?? 1) - 1]?.result;
  const message = !session || !round ? "" : pending ? "Saving changes…"
    : session.status === "completed" ? "Session completed."
    : result === "draw" ? "This round is a draw."
    : result === "X" || result === "O" ? `${session.players[result].name} wins this round!`
    : round.currentPlayer ? `${session.players[round.currentPlayer].name}'s turn (${round.currentPlayer})` : "Round finished.";

  return (
    <section className="mb-8 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800" aria-label="Current game">
      {session && round && <>
        <h2 className="break-words text-2xl font-semibold">{session.players.X.name} vs {session.players.O.name}</h2>
        <p className="mt-2 text-sm text-zinc-500">Round {round.number}</p>
        <p role="status" className="mt-3 font-medium">{message}</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-2 text-left font-semibold">Session scores</caption>
            <thead className="border-b border-zinc-300 dark:border-zinc-700">
              <tr><th scope="col" className="py-2 pr-4">Player</th><th scope="col" className="p-2">Wins</th><th scope="col" className="p-2">Losses</th><th scope="col" className="p-2">Draws</th></tr>
            </thead>
            <tbody>{(["X", "O"] as const).map((mark) => (
              <tr key={mark}>
                <th scope="row" className="py-2 pr-4 font-medium break-words">{session.players[mark].name} ({mark})</th>
                <td className="p-2">{session.statistics[mark].wins}</td>
                <td className="p-2">{session.statistics[mark].losses}</td>
                <td className="p-2">{session.statistics[mark].draws}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div role="group" aria-label="Tic-Tac-Toe board" aria-busy={pending}
          className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-2">
          {round.board.map((cell, index) => (
            <button key={index} type="button"
              aria-label={`Row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}: ${cell ?? "empty"}`}
              disabled={pending || !!error || session.status !== "active" || round.status !== "in_progress" || !round.currentPlayer || cell !== null}
              onClick={() => void play(index)}
              className="aspect-square rounded-lg border-2 border-zinc-400 text-4xl font-bold enabled:hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default dark:enabled:hover:bg-zinc-800">
              {cell}
            </button>
          ))}
        </div>
        {session.status === "active" && round.status === "finished" && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" disabled={pending || !!error} onClick={() => void finishAction("rounds")}
              className="rounded-lg bg-foreground px-5 py-2 font-semibold text-background disabled:opacity-50">Continue</button>
            <button type="button" disabled={pending || !!error} onClick={() => void finishAction("complete")}
              className="rounded-lg border border-zinc-400 px-5 py-2 disabled:opacity-50">Stop</button>
          </div>
        )}
        {session.status === "completed" && !error && (
          <button type="button" onClick={onStopped} className="mt-6 rounded-lg border border-zinc-400 px-4 py-2">Return to history</button>
        )}
      </>}
      {error && <div className="mt-4">
        <p role="alert" className="text-red-700 dark:text-red-400">{error}</p>
        <button type="button" className="mt-3 rounded-lg border border-zinc-400 px-4 py-2" onClick={() => {
          busy.current = true;
          setError("");
          setLoading(true);
          setAttempt((previous) => previous + 1);
        }}>Refresh game</button>
      </div>}
    </section>
  );
}
