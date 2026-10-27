# Tic-Tac-Toe server

Express and TypeScript backend connected to MongoDB through Mongoose. Session creation is implemented; gameplay and session-history endpoints are not implemented yet.

## Local setup

Use Node.js 24 and pnpm 10.7.0. From this directory:

```sh
pnpm install
cp .env.example .env
pnpm dev
```

If pnpm is not installed, replace `pnpm` with `npx --yes pnpm@10.7.0` (use `npx.cmd` in Windows PowerShell if script execution is disabled).

Copy [.env.example](.env.example) to `.env` only if you do not already have a local `.env` file. In PowerShell, use `Copy-Item .env.example .env`. Set `MONGODB_URI` in `.env` to your MongoDB connection string, including the intended database name.

The server connects to MongoDB before listening for HTTP requests. Missing configuration or a failed connection exits with status 1. Server selection times out after 10 seconds. For connection failures, check your URI, database credentials, and network access settings. Connection errors are reported without printing the URI. No collections or game records are created during startup.

Both `pnpm dev` and `pnpm start` load `.env` using Node.js's built-in environment file support. Restart the server after changing `.env`. Environment variables already set by your shell or hosting provider take precedence, and a missing `.env` is allowed. Keep real credentials in the ignored `.env`; commit only the empty example.

The server defaults to port 3001. Set `PORT` to override it. `GET /health` returns HTTP 200 with `{"status":"ok"}` to confirm the HTTP server is responding. This is a liveness check; it does not check current MongoDB connectivity.

## Create a session

Send `POST /api/sessions` with `Content-Type: application/json` and this body:

```json
{ "players": { "X": { "name": "Arvin" }, "O": { "name": "Sam" } } }
```

The endpoint saves a session in MongoDB and returns `201` with its `_id`, players, `active` status, one round with no moves and a `null` result, `createdAt`, and `completedAt: null`. Names are trimmed. Missing, blank, or non-string names return `400`; a failed save returns a generic `500` error. Client-supplied status, rounds, and timestamps are ignored.

## Checks and production startup

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

[tests/sessions.test.mjs](tests/sessions.test.mjs) starts an isolated temporary MongoDB process using `mongodb-memory-server`, calls the session endpoint, and reads the saved document directly from MongoDB. It does not load `.env` or use your development database. The first run downloads a MongoDB binary and needs network access; later runs reuse the cached binary. The setup timeout allows up to 20 minutes for the initial download. The test disconnects and stops the temporary database afterward.

[src/app.ts](src/app.ts) configures Express without opening a network port, allowing HTTP tests to import the app. [src/server.ts](src/server.ts) starts the listener. TypeScript compiles the source into the ignored `dist` directory.
