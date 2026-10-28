import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app.ts';

// Never load .env or connect to the development database in this runner.
const database = await MongoMemoryServer.create();
let server;
let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  await database.stop();
}

process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });

try {
  await mongoose.connect(database.getUri(), { dbName: 'playwright-game-tests' });
  await new Promise((resolve, reject) => {
    server = app.listen(3101, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  console.log('Isolated E2E API listening on http://127.0.0.1:3101');
} catch (error) {
  await stop();
  throw error;
}
