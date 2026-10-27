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

// Round-result detection is not implemented yet.
export function makeMove(round: RoundState, cellIndex: number): RoundState {
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) {
    throw new Error('Cell index must be an integer between 0 and 8.');
  }

  if (round.board[cellIndex] === 'X' || round.board[cellIndex] === 'O') {
    throw new Error('Cell is already occupied.');
  }

  const board = [...round.board];
  board[cellIndex] = round.currentPlayer;

  return {
    ...round,
    board,
    currentPlayer: round.currentPlayer === 'X' ? 'O' : 'X',
  };
}
