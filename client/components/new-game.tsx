"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/lib/api/sessions";

export default function NewGame() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [xName, setXName] = useState("");
  const [oName, setOName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
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
      const session = await createSession(xName.trim(), oName.trim());
      router.push(`/game/${encodeURIComponent(session._id)}`);
    } catch {
      setError("Unable to create game. Please try again.");
      submitting.current = false;
      setPending(false);
    }
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
      className="player-form"
      aria-busy={pending}
    >
      <p className="player-form-kicker">MEET YOUR MATCH</p>
      <h2 id="new-game-heading">
        New game
      </h2>
      <p className="player-form-intro">
        Enter both names. Player X goes first.
      </p>
      <fieldset disabled={pending} className="player-form-fields">
        <legend className="sr-only">Player names</legend>
        <div className="player-card player-card-x">
          <div className="player-card-heading" aria-hidden="true"><span className="player-badge">X</span><span>THE FIRST MOVE</span></div>
          <label htmlFor="player-x">
            Player X name
          </label>
          <input
            id="player-x"
            name="playerX"
            required
            placeholder="Enter a name"
            value={xName}
            onChange={(event) => setXName(event.target.value)}
            aria-describedby={error ? "new-game-error" : undefined}
            aria-invalid={!!error && !xName.trim()}
            className="player-name-input"
          />
        </div>
        <div className="player-card player-card-o">
          <div className="player-card-heading" aria-hidden="true"><span className="player-badge">O</span><span>THE CHALLENGER</span></div>
          <label htmlFor="player-o">
            Player O name
          </label>
          <input
            id="player-o"
            name="playerO"
            required
            placeholder="Enter a name"
            value={oName}
            onChange={(event) => setOName(event.target.value)}
            aria-describedby={error ? "new-game-error" : undefined}
            aria-invalid={!!error && !oName.trim()}
            className="player-name-input"
          />
        </div>
        {error && (
          <p
            id="new-game-error"
            role="alert"
            className="player-form-error"
          >
            {error}
          </p>
        )}
        <div className="player-form-actions">
          <button
            type="submit"
            className="player-create-button"
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
            className="player-cancel-button"
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
