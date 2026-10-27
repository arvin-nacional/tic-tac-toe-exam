"use client";

import { useEffect, useState } from "react";
import { getCompletedSessions, type CompletedSession } from "@/lib/api/sessions";

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
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <header className="mb-10 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <p className="mb-3 text-sm font-semibold tracking-widest text-zinc-500">UMBRA DIGITAL</p>
        <h1 className="text-4xl font-bold tracking-tight">Tic-Tac-Toe</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">Past games, friendly rivalries, and every result.</p>
      </header>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-2xl font-semibold">Completed sessions</h2>
        <p className="mb-6 mt-2 text-sm text-zinc-500">Most recently completed first.</p>

        {history.status === "loading" && (
          <p role="status" className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            Loading completed sessions…
          </p>
        )}
        {history.status === "error" && (
          <div className="rounded-xl border border-red-300 p-6 dark:border-red-900">
            <p role="alert">Unable to load completed sessions.</p>
            <button type="button" className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-4"
              onClick={() => {
                setHistory({ status: "loading" });
                setAttempt((previous) => previous + 1);
              }}>
              Try again
            </button>
          </div>
        )}
        {history.status === "ready" && history.sessions.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 dark:border-zinc-700">
            <p className="font-medium">No completed sessions yet.</p>
            <p className="mt-2 text-sm text-zinc-500">Finished sessions will appear here after you choose Stop.</p>
          </div>
        )}
        {history.status === "ready" && (
          <div className="space-y-5">
            {history.sessions.map((session) => (
              <article key={session._id} className="rounded-xl border border-zinc-200 p-5 sm:p-6 dark:border-zinc-800">
                <h3 className="break-words text-xl font-semibold">{session.players.X.name} vs {session.players.O.name}</h3>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
                  <span>{session.roundCount} {session.roundCount === 1 ? "round" : "rounds"}</span>
                  <time dateTime={session.completedAt}>
                    {new Date(session.completedAt).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC
                  </time>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Final scores for {session.players.X.name} vs {session.players.O.name}</caption>
                    <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                      <tr><th scope="col" className="pb-2 pr-4">Player</th><th scope="col" className="pb-2 px-2">Wins</th><th scope="col" className="pb-2 px-2">Losses</th><th scope="col" className="pb-2 pl-2">Draws</th></tr>
                    </thead>
                    <tbody>
                      {(["X", "O"] as const).map((mark) => (
                        <tr key={mark}>
                          <th scope="row" className="py-3 pr-4 font-medium break-words">{session.players[mark].name} ({mark})</th>
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
    </main>
  );
}
