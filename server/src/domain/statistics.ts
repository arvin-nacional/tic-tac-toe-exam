export function getStatistics(rounds: readonly { result?: string | null }[]) {
  const xWins = rounds.filter((round) => round.result === 'X').length;
  const oWins = rounds.filter((round) => round.result === 'O').length;
  const draws = rounds.filter((round) => round.result === 'draw').length;

  return {
    X: { wins: xWins, losses: oWins, draws },
    O: { wins: oWins, losses: xWins, draws },
  };
}
