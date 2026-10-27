# Tic-Tac-Toe server

Express and TypeScript backend connected to MongoDB through Mongoose. Game endpoints and session persistence will be added in later tasks.

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

The server defaults to port 3001. Set `PORT` to override it. `GET /health` returns HTTP 200 with `{"status":"ok"}` to confirm the HTTP server is responding. This is a liveness check; it does not check current MongoDB connectivity. Other routes return Express's default 404 response.

## Checks and production startup

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

[src/app.ts](src/app.ts) configures Express without opening a network port, allowing future HTTP tests to import the app. [src/server.ts](src/server.ts) starts the listener. TypeScript compiles the source into the ignored `dist` directory.
