import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../src/app.ts';

let database;

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
