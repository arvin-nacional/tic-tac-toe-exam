import assert from 'node:assert/strict';
import { afterAll, beforeAll, test } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../src/app.ts';

let database;

test('POST /api/sessions rejects a blank player name without saving a session', async () => {
  const sessions = mongoose.connection.collection('sessions');
  const countBefore = await sessions.countDocuments();

  await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: '   ' }, O: { name: 'Sam' } } })
    .expect('Content-Type', /json/)
    .expect(400, { error: 'Both player names are required.' });

  assert.equal(await sessions.countDocuments(), countBefore);
});

beforeAll(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: 'session-api-tests' });
}, 1_200_000);

afterAll(async () => {
  try {
    await mongoose.disconnect();
  } finally {
    await database?.stop();
  }
});

test('POST /api/sessions creates an active session with two players and an empty first round', async () => {
  const players = {
    X: { name: 'Arvin' },
    O: { name: 'Sam' },
  };

  const response = await request(app)
    .post('/api/sessions')
    .send({ players })
    .expect(201)
    .expect('Content-Type', /json/);

  const session = response.body;
  assert.equal(typeof session._id, 'string');
  assert.ok(session._id.length > 0);
  assert.deepEqual(session.players, players);
  assert.equal(session.status, 'active');
  assert.equal(session.rounds.length, 1);
  assert.deepEqual(session.rounds[0].moves, []);
  assert.equal(session.rounds[0].result, null);
  assert.equal(typeof session.createdAt, 'string');
  assert.ok(Number.isFinite(Date.parse(session.createdAt)));
  assert.equal(session.completedAt, null);

  // Read directly from MongoDB to verify that the API actually persisted it.
  const stored = await mongoose.connection.collection('sessions').findOne({
    _id: new mongoose.Types.ObjectId(session._id),
  });
  assert.ok(stored);
  assert.deepEqual(stored.players, players);
  assert.equal(stored.status, 'active');
  assert.equal(stored.rounds.length, 1);
  assert.deepEqual(stored.rounds[0].moves, []);
  assert.equal(stored.rounds[0].result, null);
  assert.equal(stored.createdAt.toISOString(), session.createdAt);
  assert.equal(stored.completedAt, null);
});

test('GET /api/sessions/:id returns the saved session with its initial board, turn, and statistics', async () => {
  const players = { X: { name: 'Arvin' }, O: { name: 'Sam' } };
  const created = await request(app)
    .post('/api/sessions')
    .send({ players })
    .expect(201);

  const response = await request(app)
    .get(`/api/sessions/${created.body._id}`)
    .expect(200)
    .expect('Content-Type', /json/);

  assert.deepEqual(response.body, {
    _id: created.body._id,
    status: 'active',
    players,
    rounds: [{ moves: [], result: null }],
    currentRound: {
      number: 1,
      board: [null, null, null, null, null, null, null, null, null],
      currentPlayer: 'X',
      status: 'in_progress',
    },
    statistics: {
      X: { wins: 0, losses: 0, draws: 0 },
      O: { wins: 0, losses: 0, draws: 0 },
    },
    createdAt: created.body.createdAt,
    completedAt: null,
  });
});

test('POST /api/sessions/:id/moves saves the first X move and passes the turn to O', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;
  const move = { player: 'X', cellIndex: 4 };

  await request(app)
    .post(`/api/sessions/${sessionId}/moves`)
    .send(move)
    .expect(200);

  const stored = await mongoose.connection.collection('sessions').findOne({
    _id: new mongoose.Types.ObjectId(sessionId),
  });
  assert.ok(stored);
  assert.equal(stored.status, 'active');
  assert.equal(stored.rounds.length, 1);
  assert.deepEqual(stored.rounds[0].moves, [move]);
  assert.equal(stored.rounds[0].result, null);

  const retrieved = await request(app)
    .get(`/api/sessions/${sessionId}`)
    .expect(200)
    .expect('Content-Type', /json/);

  assert.deepEqual(retrieved.body.rounds, [{ moves: [move], result: null }]);
  assert.deepEqual(retrieved.body.currentRound, {
    number: 1,
    board: [null, null, null, null, 'X', null, null, null, null],
    currentPlayer: 'O',
    status: 'in_progress',
  });
  assert.deepEqual(retrieved.body.statistics, {
    X: { wins: 0, losses: 0, draws: 0 },
    O: { wins: 0, losses: 0, draws: 0 },
  });
});

test('POST /api/sessions/:id/moves rejects an out-of-turn move without changing the saved session', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;
  const sessions = mongoose.connection.collection('sessions');
  const filter = { _id: new mongoose.Types.ObjectId(sessionId) };
  const beforeMove = await sessions.findOne(filter);
  assert.ok(beforeMove);

  await request(app)
    .post(`/api/sessions/${sessionId}/moves`)
    .send({ player: 'O', cellIndex: 4 })
    .expect('Content-Type', /json/)
    .expect(409, { error: 'It is not this player\'s turn.' });

  assert.deepEqual(await sessions.findOne(filter), beforeMove);
});

test('POST /api/sessions/:id/moves rejects an occupied cell without changing the saved session', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;

  await request(app)
    .post(`/api/sessions/${sessionId}/moves`)
    .send({ player: 'X', cellIndex: 4 })
    .expect(200);

  const sessions = mongoose.connection.collection('sessions');
  const filter = { _id: new mongoose.Types.ObjectId(sessionId) };
  const beforeMove = await sessions.findOne(filter);
  assert.ok(beforeMove);
  assert.deepEqual(beforeMove.rounds[0].moves, [{ player: 'X', cellIndex: 4 }]);

  await request(app)
    .post(`/api/sessions/${sessionId}/moves`)
    .send({ player: 'O', cellIndex: 4 })
    .expect('Content-Type', /json/)
    .expect(409, { error: 'Cell is already occupied.' });

  assert.deepEqual(await sessions.findOne(filter), beforeMove);
});

test('POST /api/sessions/:id/moves rejects invalid cell indexes without changing the saved session', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;
  const sessions = mongoose.connection.collection('sessions');
  const filter = { _id: new mongoose.Types.ObjectId(sessionId) };
  const beforeMove = await sessions.findOne(filter);
  assert.ok(beforeMove);

  // undefined omits cellIndex from the JSON request, covering a missing field.
  for (const cellIndex of [-1, 9, 0.5, '4', null, true, undefined]) {
    await request(app)
      .post(`/api/sessions/${sessionId}/moves`)
      .send({ player: 'X', cellIndex })
      .expect('Content-Type', /json/)
      .expect(400, { error: 'Cell index must be an integer between 0 and 8.' });

    assert.deepEqual(await sessions.findOne(filter), beforeMove);
  }
});

test('POST /api/sessions/:id/moves records a winning round and updates player statistics', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;
  const moves = [
    { player: 'X', cellIndex: 0 },
    { player: 'O', cellIndex: 3 },
    { player: 'X', cellIndex: 1 },
    { player: 'O', cellIndex: 4 },
    { player: 'X', cellIndex: 2 },
  ];

  for (const move of moves) {
    await request(app)
      .post(`/api/sessions/${sessionId}/moves`)
      .send(move)
      .expect(200);
  }

  const stored = await mongoose.connection.collection('sessions').findOne({
    _id: new mongoose.Types.ObjectId(sessionId),
  });
  assert.ok(stored);
  assert.equal(stored.rounds.length, 1);
  assert.deepEqual(stored.rounds[0].moves, moves);
  assert.equal(stored.rounds[0].result, 'X');
  assert.equal(stored.status, 'active');
  assert.equal(stored.completedAt, null);

  const retrieved = await request(app)
    .get(`/api/sessions/${sessionId}`)
    .expect(200)
    .expect('Content-Type', /json/);

  assert.deepEqual(retrieved.body.rounds, [{ moves, result: 'X' }]);
  assert.deepEqual(retrieved.body.currentRound, {
    number: 1,
    board: ['X', 'X', 'X', 'O', 'O', null, null, null, null],
    currentPlayer: null,
    status: 'finished',
  });
  assert.deepEqual(retrieved.body.statistics, {
    X: { wins: 1, losses: 0, draws: 0 },
    O: { wins: 0, losses: 1, draws: 0 },
  });
});

test('POST /api/sessions/:id/moves rejects moves after a win without changing the saved session', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;
  const moves = [
    { player: 'X', cellIndex: 0 },
    { player: 'O', cellIndex: 3 },
    { player: 'X', cellIndex: 1 },
    { player: 'O', cellIndex: 4 },
    { player: 'X', cellIndex: 2 },
  ];

  for (const move of moves) {
    await request(app)
      .post(`/api/sessions/${sessionId}/moves`)
      .send(move)
      .expect(200);
  }

  const sessions = mongoose.connection.collection('sessions');
  const filter = { _id: new mongoose.Types.ObjectId(sessionId) };
  const beforeMove = await sessions.findOne(filter);
  assert.ok(beforeMove);
  assert.equal(beforeMove.status, 'active');
  assert.equal(beforeMove.rounds[0].result, 'X');
  assert.deepEqual(beforeMove.rounds[0].moves, moves);

  await request(app)
    .post(`/api/sessions/${sessionId}/moves`)
    .send({ player: 'O', cellIndex: 5 })
    .expect('Content-Type', /json/)
    .expect(409, { error: 'Session or round has ended.' });

  assert.deepEqual(await sessions.findOne(filter), beforeMove);
});

test('POST /api/sessions/:id/moves records a drawn round and increments both draw counts', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;
  const moves = [
    { player: 'X', cellIndex: 0 },
    { player: 'O', cellIndex: 1 },
    { player: 'X', cellIndex: 2 },
    { player: 'O', cellIndex: 4 },
    { player: 'X', cellIndex: 3 },
    { player: 'O', cellIndex: 5 },
    { player: 'X', cellIndex: 7 },
    { player: 'O', cellIndex: 6 },
    { player: 'X', cellIndex: 8 },
  ];

  for (const move of moves) {
    await request(app)
      .post(`/api/sessions/${sessionId}/moves`)
      .send(move)
      .expect(200);
  }

  const stored = await mongoose.connection.collection('sessions').findOne({
    _id: new mongoose.Types.ObjectId(sessionId),
  });
  assert.ok(stored);
  assert.equal(stored.rounds.length, 1);
  assert.deepEqual(stored.rounds[0].moves, moves);
  assert.equal(stored.rounds[0].result, 'draw');
  assert.equal(stored.status, 'active');
  assert.equal(stored.completedAt, null);

  const retrieved = await request(app)
    .get(`/api/sessions/${sessionId}`)
    .expect(200)
    .expect('Content-Type', /json/);

  assert.deepEqual(retrieved.body.rounds, [{ moves, result: 'draw' }]);
  assert.deepEqual(retrieved.body.currentRound, {
    number: 1,
    board: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'],
    currentPlayer: null,
    status: 'finished',
  });
  assert.deepEqual(retrieved.body.statistics, {
    X: { wins: 0, losses: 0, draws: 1 },
    O: { wins: 0, losses: 0, draws: 1 },
  });
});

test('POST /api/sessions/:id/moves rejects moves after a draw without changing the saved session', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;
  const moves = [
    { player: 'X', cellIndex: 0 },
    { player: 'O', cellIndex: 1 },
    { player: 'X', cellIndex: 2 },
    { player: 'O', cellIndex: 4 },
    { player: 'X', cellIndex: 3 },
    { player: 'O', cellIndex: 5 },
    { player: 'X', cellIndex: 7 },
    { player: 'O', cellIndex: 6 },
    { player: 'X', cellIndex: 8 },
  ];

  for (const move of moves) {
    await request(app)
      .post(`/api/sessions/${sessionId}/moves`)
      .send(move)
      .expect(200);
  }

  const sessions = mongoose.connection.collection('sessions');
  const filter = { _id: new mongoose.Types.ObjectId(sessionId) };
  const beforeMove = await sessions.findOne(filter);
  assert.ok(beforeMove);
  assert.equal(beforeMove.status, 'active');
  assert.equal(beforeMove.rounds[0].result, 'draw');
  assert.deepEqual(beforeMove.rounds[0].moves, moves);

  await request(app)
    .post(`/api/sessions/${sessionId}/moves`)
    .send({ player: 'O', cellIndex: 0 })
    .expect('Content-Type', /json/)
    .expect(409, { error: 'Session or round has ended.' });

  assert.deepEqual(await sessions.findOne(filter), beforeMove);
});

test('POST /api/sessions/:id/rounds starts a new round while preserving previous results', async () => {
  const players = { X: { name: 'Arvin' }, O: { name: 'Sam' } };
  const created = await request(app)
    .post('/api/sessions')
    .send({ players })
    .expect(201);
  const sessionId = created.body._id;
  const moves = [
    { player: 'X', cellIndex: 0 },
    { player: 'O', cellIndex: 3 },
    { player: 'X', cellIndex: 1 },
    { player: 'O', cellIndex: 4 },
    { player: 'X', cellIndex: 2 },
  ];

  for (const move of moves) {
    await request(app)
      .post(`/api/sessions/${sessionId}/moves`)
      .send(move)
      .expect(200);
  }

  await request(app)
    .post(`/api/sessions/${sessionId}/rounds`)
    .expect(201);

  const stored = await mongoose.connection.collection('sessions').findOne({
    _id: new mongoose.Types.ObjectId(sessionId),
  });
  assert.ok(stored);
  assert.deepEqual(stored.players, players);
  assert.deepEqual(stored.rounds, [
    { moves, result: 'X' },
    { moves: [], result: null },
  ]);
  assert.equal(stored.status, 'active');
  assert.equal(stored.completedAt, null);

  const retrieved = await request(app)
    .get(`/api/sessions/${sessionId}`)
    .expect(200)
    .expect('Content-Type', /json/);

  assert.deepEqual(retrieved.body.rounds, stored.rounds);
  assert.deepEqual(retrieved.body.currentRound, {
    number: 2,
    board: [null, null, null, null, null, null, null, null, null],
    currentPlayer: 'X',
    status: 'in_progress',
  });
  assert.deepEqual(retrieved.body.statistics, {
    X: { wins: 1, losses: 0, draws: 0 },
    O: { wins: 0, losses: 1, draws: 0 },
  });
});

test('POST /api/sessions/:id/rounds rejects Continue during an unfinished round without saving changes', async () => {
  const created = await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } })
    .expect(201);
  const sessionId = created.body._id;

  await request(app)
    .post(`/api/sessions/${sessionId}/moves`)
    .send({ player: 'X', cellIndex: 4 })
    .expect(200);

  const sessions = mongoose.connection.collection('sessions');
  const filter = { _id: new mongoose.Types.ObjectId(sessionId) };
  const beforeContinue = await sessions.findOne(filter);
  assert.ok(beforeContinue);
  assert.equal(beforeContinue.status, 'active');
  assert.deepEqual(beforeContinue.rounds, [
    { moves: [{ player: 'X', cellIndex: 4 }], result: null },
  ]);

  await request(app)
    .post(`/api/sessions/${sessionId}/rounds`)
    .expect('Content-Type', /json/)
    .expect(409, { error: 'Current round is still in progress.' });

  assert.deepEqual(await sessions.findOne(filter), beforeContinue);
});

test('GET /api/sessions/:id returns 404 for a valid but unknown session ID', async () => {
  const unknownId = new mongoose.Types.ObjectId().toHexString();

  await request(app)
    .get(`/api/sessions/${unknownId}`)
    .expect('Content-Type', /json/)
    .expect(404, { error: 'Session not found.' });
});

test('GET /api/sessions/:id returns 400 for a malformed session ID', async () => {
  await request(app)
    .get('/api/sessions/not-a-valid-id')
    .expect('Content-Type', /json/)
    .expect(400, { error: 'Invalid session ID.' });
});

test('POST /api/sessions rejects a missing player name without saving a session', async () => {
  const sessions = mongoose.connection.collection('sessions');
  const countBefore = await sessions.countDocuments();

  await request(app)
    .post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: {} } })
    .expect('Content-Type', /json/)
    .expect(400, { error: 'Both player names are required.' });

  assert.equal(await sessions.countDocuments(), countBefore);
});
