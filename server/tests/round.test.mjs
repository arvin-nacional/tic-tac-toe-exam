import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRound, makeMove } from '../src/domain/round.ts';

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
