import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
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

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: 'session-api-tests' });
}, { timeout: 1_200_000 });

after(async () => {
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
