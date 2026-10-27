import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/database.ts';

test('rejects a missing or blank MongoDB URI', async () => {
  for (const uri of [undefined, '', '   ']) {
    await assert.rejects(connectDatabase(uri), {
      message: 'MONGODB_URI is required.',
    });
  }
});

test('waits until the database connection succeeds', async (t) => {
  let finishConnection;
  t.mock.method(mongoose, 'connect', () => new Promise((resolve) => {
    finishConnection = resolve;
  }));
  let connected = false;
  const pending = connectDatabase('mongodb://localhost/test').then(() => {
    connected = true;
  });
  await Promise.resolve();
  assert.equal(connected, false);
  finishConnection(mongoose);
  await pending;
  assert.equal(connected, true);
});

test('reports connection failure without leaking the URI', async (t) => {
  t.mock.method(mongoose, 'connect', async () => {
    throw new Error('Failed mongodb://user:secret@localhost/test');
  });
  await assert.rejects(connectDatabase('mongodb://user:secret@localhost/test'), {
    message: 'MongoDB connection failed. Check your URI, credentials, and network access.',
  });
});
