import { app } from './app.js';
import { connectDatabase } from './database.js';

const port = Number(process.env.PORT ?? 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

try {
  await connectDatabase(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  server.on('error', () => {
    console.error('HTTP server failed to start. Check whether PORT is already in use.');
    process.exit(1);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database startup failed.');
  process.exit(1);
}
