type PlayerStatistics = { wins: number; losses: number; draws: number };

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
