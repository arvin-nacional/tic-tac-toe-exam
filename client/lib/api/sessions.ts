type PlayerStatistics = { wins: number; losses: number; draws: number };

export type PlayerMark = "X" | "O";
export type GameSession = CreatedSession & {
  status: "active" | "completed";
  rounds: { result: PlayerMark | "draw" | null }[];
  currentRound: {
    number: number;
    board: (PlayerMark | null)[];
    currentPlayer: PlayerMark | null;
    status: "in_progress" | "finished";
  };
};

export async function getSession(id: string, signal: AbortSignal): Promise<GameSession> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Unable to load game.");
  return response.json();
}

export async function submitMove(id: string, player: PlayerMark, cellIndex: number, signal: AbortSignal): Promise<void> {
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/moves`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player, cellIndex }), signal,
  });
  if (!response.ok) throw new Error("Unable to save move.");
}

export type CreatedSession = {
  _id: string;
  players: { X: { name: string }; O: { name: string } };
};

export async function createSession(xName: string, oName: string): Promise<CreatedSession> {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players: { X: { name: xName }, O: { name: oName } } }),
  });
  if (!response.ok) throw new Error("Unable to create game.");
  return response.json();
}

export type CompletedSession = {
  _id: string;
  players: { X: { name: string }; O: { name: string } };
  roundCount: number;
  statistics: { X: PlayerStatistics; O: PlayerStatistics };
  completedAt: string;
};

export async function getCompletedSessions(signal: AbortSignal): Promise<CompletedSession[]> {
  const response = await fetch("/api/sessions?status=completed", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Unable to load completed sessions.");
  return response.json();
}
