import assert from 'node:assert/strict';
import { afterAll, beforeAll, beforeEach, test } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../src/app.ts';
import { Session } from '../src/models/session.ts';

let database;
beforeAll(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: 'history-api-tests' });
}, 1_200_000);

beforeEach(async () => {
  await Session.deleteMany({});
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
  } finally {
    await database?.stop();
  }
});

test('GET /api/sessions?status=completed returns an empty array when no sessions are completed', async () => {
  await Session.create({ players: { X: { name: 'Active X' }, O: { name: 'Active O' } } });
  await request(app).get('/api/sessions?status=completed')
    .expect('Content-Type', /json/)
    .expect(200, []);
});

test('history lists only completed sessions by completion time with derived final statistics', async () => {
  const players = { X: { name: 'Arvin' }, O: { name: 'Sam' } };
  const winningRound = {
    moves: [0, 3, 1, 4, 2].map((cellIndex, i) => ({ player: i % 2 === 0 ? 'X' : 'O', cellIndex })),
    result: 'X',
  };
  const drawnRound = {
    moves: [0, 1, 2, 4, 3, 5, 7, 6, 8].map((cellIndex, i) => ({ player: i % 2 === 0 ? 'X' : 'O', cellIndex })),
    result: 'draw',
  };
  // Insert oldest completion first; creation dates deliberately have the opposite order.
  const older = await Session.create({
    players: { X: { name: 'Alex' }, O: { name: 'Jo' } },
    status: 'completed', rounds: [drawnRound],
    createdAt: new Date('2026-01-02T00:00:00Z'),
    completedAt: new Date('2026-01-02T01:00:00Z'),
  });
  const newer = await Session.create({
    players, status: 'completed', rounds: [winningRound, drawnRound],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    completedAt: new Date('2026-01-03T00:00:00Z'),
  });
  await Session.create({ players, rounds: [winningRound] });

  const response = await request(app).get('/api/sessions?status=completed')
    .expect(200).expect('Content-Type', /json/);

  assert.deepEqual(response.body, [
    {
      _id: newer.id, status: 'completed', players, roundCount: 2,
      statistics: { X: { wins: 1, losses: 0, draws: 1 }, O: { wins: 0, losses: 1, draws: 1 } },
      createdAt: newer.createdAt.toISOString(), completedAt: newer.completedAt.toISOString(),
    },
    {
      _id: older.id, status: 'completed',
      players: { X: { name: 'Alex' }, O: { name: 'Jo' } }, roundCount: 1,
      statistics: { X: { wins: 0, losses: 0, draws: 1 }, O: { wins: 0, losses: 0, draws: 1 } },
      createdAt: older.createdAt.toISOString(), completedAt: older.completedAt.toISOString(),
    },
  ]);
});
