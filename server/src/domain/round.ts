export type PlayerMark = 'X' | 'O';
export type Cell = PlayerMark | null;

export interface RoundState {
  board: Cell[];
  currentPlayer: PlayerMark;
  status: 'in_progress';
}

export function createRound(): RoundState {
  return {
    board: Array<Cell>(9).fill(null),
    currentPlayer: 'X',
    status: 'in_progress',
  };
}

// Assumes a legal move; validation and round-result detection are not implemented yet.
export function makeMove(round: RoundState, cellIndex: number): RoundState {
  const board = [...round.board];
  board[cellIndex] = round.currentPlayer;

  return {
    ...round,
    board,
    currentPlayer: round.currentPlayer === 'X' ? 'O' : 'X',
  };
}
