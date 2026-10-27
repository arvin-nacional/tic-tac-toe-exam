"use client";

import { useEffect, useRef, useState } from "react";
import { getSession, submitMove, type GameSession } from "@/lib/api/sessions";

export default function GameBoard({ sessionId }: { sessionId: string }) {
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

  if (loading) return <p role="status" className="mb-8 p-6">Loading game…</p>;

  const round = session?.currentRound;
  const result = session?.rounds[(round?.number ?? 1) - 1]?.result;
  const message = !session || !round ? "" : pending ? "Saving move…"
    : result === "draw" ? "This round is a draw."
    : result === "X" || result === "O" ? `${session.players[result].name} wins this round!`
    : session.status === "completed" ? "Session completed."
    : round.currentPlayer ? `${session.players[round.currentPlayer].name}'s turn (${round.currentPlayer})` : "Round finished.";

  return (
    <section className="mb-8 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800" aria-label="Current game">
      {session && round && <>
        <h2 className="break-words text-2xl font-semibold">{session.players.X.name} vs {session.players.O.name}</h2>
        <p className="mt-2 text-sm text-zinc-500">Round {round.number}</p>
        <p role="status" className="mt-3 font-medium">{message}</p>
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
