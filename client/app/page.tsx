"use client";

import { useEffect, useState } from "react";
import { getCompletedSessions, type CompletedSession } from "@/lib/api/sessions";
import NewGame from "@/components/new-game";

type HistoryState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; sessions: CompletedSession[] };

export default function Home() {
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getCompletedSessions(controller.signal)
      .then((sessions) => {
        if (!controller.signal.aborted) setHistory({ status: "ready", sessions });
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistory({ status: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <main className="home-page">
      <div className="home-shell">
      <header className="home-hero">
        <div>
          <p className="home-eyebrow"><span className="home-dot" /> TWO PLAYERS. ENDLESS REMATCHES.</p>
          <h1>Tic-Tac-Toe<span className="home-title-dot">.</span></h1>
          <p className="home-intro">A little strategy. A little rivalry.<br />Make your move and keep the score.</p>
          <div className="home-tags"><span>Local two-player</span><span>Classic 3 × 3</span></div>
        </div>
        <div className="home-illustration" aria-hidden="true">
          <div className="home-mini-board">
            {["X", "O", "", "", "X", "O", "O", "", "X"].map((mark, index) => (
              <span key={index} className={mark === "X" ? "home-mark-x" : "home-mark-o"}>{mark}</span>
            ))}
          </div>
          <span className="home-board-note">YOUR NEXT MOVE AWAITS</span>
        </div>
      </header>

      <div className="home-game-entry">
      <NewGame onCompleted={() => {
        setHistory({ status: "loading" });
        setAttempt((previous) => previous + 1);
      }} />
      </div>

      <section aria-labelledby="history-heading" className="home-history">
        <div className="home-section-heading">
          <div><p className="home-section-kicker">THE SCOREBOOK</p>
          <h2 id="history-heading">Completed sessions</h2>
          <p className="home-muted">Most recently completed first.</p></div>
          {history.status === "ready" && history.sessions.length > 0 && (
            <span className="home-count">{history.sessions.length} {history.sessions.length === 1 ? "session" : "sessions"}</span>
          )}
        </div>

        {history.status === "loading" && (
          <p role="status" className="home-state">
            Loading completed sessions…
          </p>
        )}
        {history.status === "error" && (
          <div className="home-state home-error">
            <p role="alert">Unable to load completed sessions.</p>
            <button type="button" className="home-retry"
              onClick={() => {
                setHistory({ status: "loading" });
                setAttempt((previous) => previous + 1);
              }}>
              Try again
            </button>
          </div>
        )}
        {history.status === "ready" && history.sessions.length === 0 && (
          <div className="home-state home-empty">
            <div className="home-empty-marks" aria-hidden="true"><span>X</span><span>O</span></div>
            <p className="home-empty-title">No completed sessions yet.</p>
            <p className="home-muted">Every rivalry starts with a first game.</p>
            <p className="home-empty-hint">Finished sessions will appear here after you choose Stop.</p>
          </div>
        )}
        {history.status === "ready" && (
          <div className="home-history-grid">
            {history.sessions.map((session) => (
              <article key={session._id} className="home-session-card">
                <div className="home-card-top"><span className="home-completed">Completed</span>
                  <span className="home-round-count">{session.roundCount} {session.roundCount === 1 ? "round" : "rounds"}</span></div>
                <h3>{session.players.X.name} <span className="home-versus">vs</span> {session.players.O.name}</h3>
                <div className="home-card-meta">
                  <time dateTime={session.completedAt}>
                    {new Date(session.completedAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC
                  </time>
                </div>
                <div className="home-score-scroll">
                  <table className="home-score-table">
                    <caption className="sr-only">Final scores for {session.players.X.name} vs {session.players.O.name}</caption>
                    <thead>
                      <tr><th scope="col" className="pb-2 pr-4">Player</th><th scope="col" className="pb-2 px-2">Wins</th><th scope="col" className="pb-2 px-2">Losses</th><th scope="col" className="pb-2 pl-2">Draws</th></tr>
                    </thead>
                    <tbody>
                      {(["X", "O"] as const).map((mark) => (
                        <tr key={mark}>
                          <th scope="row" className="py-3 pr-4 font-medium break-words">{session.players[mark].name} <span className={mark === "X" ? "home-player-x" : "home-player-o"}>({mark})</span></th>
                          <td className="px-2">{session.statistics[mark].wins}</td>
                          <td className="px-2">{session.statistics[mark].losses}</td>
                          <td className="pl-2">{session.statistics[mark].draws}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer className="home-footer"><span>Simple rules. Good company.</span><span>X / O</span></footer>
      </div>
    </main>
  );
}
