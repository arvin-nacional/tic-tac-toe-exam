"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSession,
  submitMove,
  updateSession,
  type GameSession,
} from "@/lib/api/sessions";

export default function GameBoard({
  sessionId,
  onStopped,
}: {
  sessionId: string;
  onStopped?: () => void;
}) {
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
    if (
      !session ||
      !signal ||
      busy.current ||
      error ||
      !player ||
      session.status !== "active" ||
      session.currentRound.status !== "in_progress" ||
      session.currentRound.board[cellIndex] !== null
    )
      return;

    busy.current = true;
    setPending(true);
    try {
      await submitMove(sessionId, player, cellIndex, signal);
      const updated = await getSession(sessionId, signal);
      if (!signal.aborted) setSession(updated);
    } catch {
      if (!signal.aborted)
        setError("Unable to update game. Refresh to check the latest state.");
    } finally {
      if (!signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  }

  async function finishAction(action: "rounds" | "complete") {
    const signal = controllerRef.current?.signal;
    if (
      !signal ||
      !session ||
      busy.current ||
      error ||
      session.status !== "active" ||
      session.currentRound.status !== "finished"
    )
      return;
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
      if (!signal.aborted)
        setError("Unable to update game. Refresh to check the latest state.");
    } finally {
      if (!signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  }

  if (loading)
    return (
      <p role="status" className="arena-loading">
        Loading game…
      </p>
    );

  const round = session?.currentRound;
  const result = session?.rounds[(round?.number ?? 1) - 1]?.result;
  const message =
    !session || !round
      ? ""
      : pending
        ? "Saving changes…"
        : session.status === "completed"
          ? "Session completed."
          : result === "draw"
            ? "This round is a draw."
            : result === "X" || result === "O"
              ? `${session.players[result].name} wins this round!`
              : round.currentPlayer
                ? `${session.players[round.currentPlayer].name}'s turn (${round.currentPlayer})`
                : "Round finished.";

  return (
    <section
      className="game-arena"
      aria-label="Current game"
    >
      {session && round && (
        <>
          <div className="arena-heading">
          <div><p className="arena-kicker">THE MATCH</p>
          <h2>
            {session.players.X.name} vs {session.players.O.name}
          </h2></div>
          <p className="arena-round">Round {round.number}</p>
          </div>
          <p role="status" className="arena-status" data-mark={result === "X" || result === "O" ? result : round.currentPlayer ?? "neutral"}>
            <span className="arena-status-dot" aria-hidden="true" />
            {message}
          </p>
          <div className="arena-layout">
          <div className="arena-score-panel">
            <table className="arena-score-table">
              <caption>
                Session scores
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="py-2 pr-4">
                    Player
                  </th>
                  <th scope="col" className="p-2">
                    Wins
                  </th>
                  <th scope="col" className="p-2">
                    Losses
                  </th>
                  <th scope="col" className="p-2">
                    Draws
                  </th>
                </tr>
              </thead>
              <tbody>
                {(["X", "O"] as const).map((mark) => (
                  <tr key={mark} data-mark={mark} data-active={session.status === "active" && round.currentPlayer === mark}>
                    <th
                      scope="row"
                      className="py-2 pr-4 font-medium break-words"
                    >
                      {session.players[mark].name} <span className="arena-player-mark">({mark})</span>
                    </th>
                    <td className="p-2">{session.statistics[mark].wins}</td>
                    <td className="p-2">{session.statistics[mark].losses}</td>
                    <td className="p-2">{session.statistics[mark].draws}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="arena-score-note">Every round counts.<br />Scores stay with you through each rematch.</p>
          </div>
          <div
            role="group"
            aria-label="Tic-Tac-Toe board"
            aria-busy={pending}
            className="arena-board"
          >
            {round.board.map((cell, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}: ${cell ?? "empty"}`}
                disabled={
                  pending ||
                  !!error ||
                  session.status !== "active" ||
                  round.status !== "in_progress" ||
                  !round.currentPlayer ||
                  cell !== null
                }
                onClick={() => void play(index)}
                data-mark={cell ?? "empty"}
                className="arena-cell"
              >
                {cell}
              </button>
            ))}
          </div>
          </div>
          {session.status === "active" && round.status === "finished" && (
            <div className="arena-actions">
              <button
                type="button"
                disabled={pending || !!error}
                onClick={() => void finishAction("rounds")}
                className="arena-primary"
              >
                Continue
              </button>
              <button
                type="button"
                disabled={pending || !!error}
                onClick={() => void finishAction("complete")}
                className="arena-secondary"
              >
                Stop
              </button>
            </div>
          )}
          {session.status === "completed" && !error && (
            <button
              type="button"
              onClick={onStopped}
              className="arena-secondary arena-return"
            >
              Return to history
            </button>
          )}
        </>
      )}
      {error && (
        <div className="arena-error">
          <p role="alert">
            {error}
          </p>
          <button
            type="button"
            className="arena-secondary arena-return"
            onClick={() => {
              busy.current = true;
              setError("");
              setLoading(true);
              setAttempt((previous) => previous + 1);
            }}
          >
            Refresh game
          </button>
        </div>
      )}
    </section>
  );
}
