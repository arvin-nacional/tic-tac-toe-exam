type PlayerStatistics = { wins: number; losses: number; draws: number };

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
