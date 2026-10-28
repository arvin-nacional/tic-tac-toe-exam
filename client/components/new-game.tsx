"use client";

import { useRef, useState, type FormEvent } from "react";
import { createSession, type CreatedSession } from "@/lib/api/sessions";
import GameBoard from "@/components/game-board";

export default function NewGame({ onCompleted }: { onCompleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [xName, setXName] = useState("");
  const [oName, setOName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<CreatedSession | null>(null);
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!xName.trim() || !oName.trim()) {
      setError("Enter both player names.");
      return;
    }

    submitting.current = true;
    setPending(true);
    setError("");
    try {
      setSession(await createSession(xName.trim(), oName.trim()));
    } catch {
      setError("Unable to create game. Please try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  if (session) {
    return (
      <GameBoard
        key={session._id}
        sessionId={session._id}
        onStopped={() => {
          setSession(null);
          setOpen(false);
          setXName("");
          setOName("");
          setError("");
          onCompleted?.();
        }}
      />
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="home-start cursor-pointer"
      >
        Start New Game <span aria-hidden="true">↗</span>
      </button>
    );
  }

  return (
    <form
      aria-labelledby="new-game-heading"
      onSubmit={handleSubmit}
      noValidate
      className="mb-8 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800"
    >
      <h2 id="new-game-heading" className="text-2xl font-semibold">
        New game
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Enter both names. Player X goes first.
      </p>
      <fieldset disabled={pending} className="mt-5 space-y-4">
        <legend className="sr-only">Player names</legend>
        <div>
          <label htmlFor="player-x" className="block font-medium">
            Player X name
          </label>
          <input
            id="player-x"
            name="playerX"
            required
            value={xName}
            onChange={(event) => setXName(event.target.value)}
            aria-describedby={error ? "new-game-error" : undefined}
            className="mt-2 w-full rounded-lg border border-zinc-400 bg-background px-3 py-2 disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="player-o" className="block font-medium">
            Player O name
          </label>
          <input
            id="player-o"
            name="playerO"
            required
            value={oName}
            onChange={(event) => setOName(event.target.value)}
            aria-describedby={error ? "new-game-error" : undefined}
            className="mt-2 w-full rounded-lg border border-zinc-400 bg-background px-3 py-2 disabled:opacity-60"
          />
        </div>
        {error && (
          <p
            id="new-game-error"
            role="alert"
            className="text-red-700 dark:text-red-400"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 font-semibold text-background disabled:opacity-60 cursor-pointer"
          >
            {pending ? "Creating game…" : "Create game"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setXName("");
              setOName("");
              setError("");
            }}
            className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
