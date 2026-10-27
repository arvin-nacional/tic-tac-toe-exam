This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Completed-session history

The home page displays completed sessions with player names, round counts, completion times in UTC, and server-calculated wins, losses, and draws. It includes loading, empty, and retryable error states.

Start New Game opens a two-player name form. It rejects blank or whitespace-only names, trims names before sending `POST /api/sessions`, disables submission while pending, and preserves names for retry after a failure. Cancel closes the form without creating a session. On success, it displays the player assignments returned by Express. The playable board and resuming an active session after a page reload are not implemented yet; session creation is persisted by the backend.

Run the Express backend using the instructions in [server/README.md](../server/README.md). The client defaults to `http://localhost:3001` for its backend. To override it, copy [.env.example](.env.example) to `.env.local` (without overwriting an existing file) and set `API_BASE_URL` to the backend origin, without `/api` at the end.

[next.config.ts](next.config.ts) forwards `/api/sessions` requests and their query strings to Express. The browser uses the Next.js origin, avoiding cross-origin browser requests. Express remains responsible for the API and database; no Server Actions or duplicate API handlers are added. Restart Next.js after changing the environment variable. Set `API_BASE_URL` to the HTTPS Render backend URL before building on Vercel; changing it requires a rebuild/redeploy.

## Tests and checks

From this directory, run:

```sh
pnpm test
pnpm test:watch
pnpm typecheck
pnpm lint
```

Tests use Vitest, React Testing Library, and jsdom. `pnpm test` runs once; `pnpm test:watch` reruns affected tests as files change. [tests/setup.ts](tests/setup.ts) enables DOM assertions and cleans up rendered components after each test. [Page tests](tests/page.test.tsx) cover history states. [New-game tests](tests/new-game.test.tsx) cover cancellation, validation, trimmed requests, duplicate-submit prevention, confirmation, and retries. HTTP responses are mocked.

Vitest supports synchronous components here. Async Server Components and complete browser journeys will need end-to-end tests separately. These component tests do not start Next.js or call the Express server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
