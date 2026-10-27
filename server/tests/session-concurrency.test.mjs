import assert from 'node:assert/strict';
import { afterAll, beforeAll, test, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../src/app.ts';
import { Session } from '../src/models/session.ts';

let database;
beforeAll(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: 'concurrency-api-tests' });
}, 1_200_000);

afterAll(async () => {
  try {
    await mongoose.disconnect();
  } finally {
    await database?.stop();
  }
});

async function createSession() {
  const response = await request(app).post('/api/sessions')
    .send({ players: { X: { name: 'Arvin' }, O: { name: 'Sam' } } }).expect(201);
  return response.body._id;
}

async function finishRound(id) {
  const moves = [0, 3, 1, 4, 2].map((cellIndex, index) => ({
    player: index % 2 === 0 ? 'X' : 'O', cellIndex,
  }));
  for (const move of moves) {
    await request(app).post(`/api/sessions/${id}/moves`).send(move).expect(200);
  }
  return { moves, result: 'X' };
}

async function readSession(id) {
  return mongoose.connection.collection('sessions').findOne({ _id: new mongoose.Types.ObjectId(id) });
}

async function raceSaves(requests) {
  const originalSave = Session.prototype.save;
  const versions = [];
  let release;
  let timer;
  const bothReady = new Promise((resolve, reject) => {
    release = resolve;
    timer = setTimeout(() => reject(new Error('Both requests did not reach save')), 3_000);
  });
  // Hold both requests after reading, then execute the real MongoDB saves.
  const spy = vi.spyOn(Session.prototype, 'save').mockImplementation(async function (...args) {
    versions.push(this.__v);
    if (versions.length === 2) release();
    await bothReady;
    return originalSave.apply(this, args);
  });
  try {
    const responses = await Promise.all(requests);
    assert.equal(versions.length, 2);
    assert.equal(versions[0], versions[1]);
    const conflicts = responses.filter((response) => response.status === 409);
    assert.equal(conflicts.length, 1);
    assert.deepEqual(conflicts[0].body, { error: 'Session changed. Refresh and try again.' });
    return responses;
  } finally {
    clearTimeout(timer);
    spy.mockRestore();
  }
}

test('competing X moves save exactly one move and preserve the successful response', async () => {
  const id = await createSession();
  const responses = await raceSaves([0, 4].map((cellIndex) =>
    request(app).post(`/api/sessions/${id}/moves`).send({ player: 'X', cellIndex })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const winningIndex = responses.findIndex((response) => response.status === 200);
  const stored = await readSession(id);
  assert.deepEqual(stored.rounds, [{ moves: [{ player: 'X', cellIndex: [0, 4][winningIndex] }], result: null }]);
  const retrieved = await request(app).get(`/api/sessions/${id}`).expect(200);
  assert.equal(retrieved.body.currentRound.currentPlayer, 'O');
  assert.equal(retrieved.body.currentRound.board.filter((cell) => cell === 'X').length, 1);
});

test('duplicate Continue requests append exactly one round and preserve the finished round', async () => {
  const id = await createSession();
  const finishedRound = await finishRound(id);
  const responses = await raceSaves([
    request(app).post(`/api/sessions/${id}/rounds`),
    request(app).post(`/api/sessions/${id}/rounds`),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const stored = await readSession(id);
  assert.equal(stored.status, 'active');
  assert.equal(stored.completedAt, null);
  assert.deepEqual(stored.rounds, [finishedRound, { moves: [], result: null }]);
});

test('Continue racing with Stop preserves exactly one valid outcome', async () => {
  const id = await createSession();
  const finishedRound = await finishRound(id);
  const [continued, stopped] = await raceSaves([
    request(app).post(`/api/sessions/${id}/rounds`),
    request(app).post(`/api/sessions/${id}/complete`),
  ]);
  const stored = await readSession(id);
  if (continued.status === 201) {
    assert.equal(stopped.status, 409);
    assert.equal(stored.status, 'active');
    assert.equal(stored.completedAt, null);
    assert.deepEqual(stored.rounds, [finishedRound, { moves: [], result: null }]);
  } else {
    assert.equal(continued.status, 409);
    assert.equal(stopped.status, 200);
    assert.equal(stored.status, 'completed');
    assert.ok(stored.completedAt instanceof Date);
    assert.deepEqual(stored.rounds, [finishedRound]);
  }
});
