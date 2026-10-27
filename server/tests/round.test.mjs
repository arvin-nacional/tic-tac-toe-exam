import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRound, getRoundResult, getWinner, makeMove } from '../src/domain/round.ts';

test('records a draw only for a full board with no winner', () => {
  const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
  const original = [...board];
  assert.equal(getRoundResult(board), 'draw');
  assert.deepEqual(board, original);
  assert.equal(getRoundResult([...board.slice(0, 8), null]), null);
  assert.equal(getRoundResult(Array(9).fill(null)), null);
});

test('a winning move on the final empty cell is a win rather than a draw', () => {
  assert.equal(getRoundResult(['X', 'O', 'O', 'O', 'X', 'X', 'X', 'O', 'X']), 'X');
});

test('detects either player winning across any row, column, or diagonal', () => {
  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  for (const player of ['X', 'O']) {
    for (const line of winningLines) {
      const board = Array(9).fill(null);
      for (const index of line) board[index] = player;
      const original = [...board];

      assert.equal(getWinner(board), player, `${player} wins on ${line}`);
      assert.deepEqual(board, original);
    }
  }
});

test('reports no winner for an empty, incomplete, or drawn board', () => {
  for (const board of [
    Array(9).fill(null),
    ['X', 'X', null, 'O', 'O', null, null, null, null],
    ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'],
  ]) {
    assert.equal(getWinner(board), null);
  }
});

test('rejects invalid cell indexes without changing the round', () => {
  const invalidIndexes = [-1, 9, 0.5, NaN, Infinity, -Infinity, '0', null, undefined];

  for (const cellIndex of invalidIndexes) {
    const round = createRound();
    const original = structuredClone(round);

    assert.throws(
      () => makeMove(round, cellIndex),
      /Cell index must be an integer between 0 and 8/,
      `Expected index ${String(cellIndex)} to be rejected`,
    );
    assert.deepEqual(round, original);
  }
});

test('rejects a move into an occupied cell without changing the round', () => {
  const round = makeMove(createRound(), 0);
  const original = structuredClone(round);

  assert.throws(() => makeMove(round, 0), /Cell is already occupied/);
  assert.deepEqual(round, original);
});

test('creates an in-progress round with nine empty cells and X to play', () => {
  assert.deepEqual(createRound(), {
    board: [null, null, null, null, null, null, null, null, null],
    currentPlayer: 'X',
    status: 'in_progress',
  });
});

test('each new round has its own board', () => {
  const first = createRound();
  const second = createRound();

  first.board[0] = 'X';

  assert.deepEqual(second.board, [null, null, null, null, null, null, null, null, null]);
});

test('the first legal move places X and passes the turn to O without changing the original round', () => {
  for (let cellIndex = 0; cellIndex < 9; cellIndex += 1) {
    const round = createRound();
    const original = structuredClone(round);

    const updated = makeMove(round, cellIndex);

    const expectedBoard = [null, null, null, null, null, null, null, null, null];
    expectedBoard[cellIndex] = 'X';
    assert.deepEqual(updated, {
      board: expectedBoard,
      currentPlayer: 'O',
      status: 'in_progress',
    });
    assert.deepEqual(round, original);
    assert.notStrictEqual(updated.board, round.board);
  }
});
