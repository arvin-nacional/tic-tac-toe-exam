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

export function getWinner(board: readonly Cell[]): PlayerMark | null {
  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  for (const [a, b, c] of winningLines) {
    const player = board[a];
    if ((player === 'X' || player === 'O')
      && player === board[b] && player === board[c]) {
      return player;
    }
  }
  return null;
}

export function getRoundResult(board: readonly Cell[]): PlayerMark | 'draw' | null {
  const winner = getWinner(board);
  if (winner !== null) return winner;

  return board.every((cell) => cell !== null) ? 'draw' : null;
}

// Applies a move; the caller handles round completion.
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
