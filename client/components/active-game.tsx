"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import GameBoard from "@/components/game-board";

export default function ActiveGame({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  return (
    <main className="home-page">
      <div className="home-shell">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">
            <Link href="/" className="rounded focus-visible:outline-2 focus-visible:outline-offset-4">Tic-Tac-Toe</Link>
          </h1>
          <span className="home-count">Local two-player</span>
        </header>
        <div className="home-game-entry">
          <GameBoard key={sessionId} sessionId={sessionId} onStopped={() => router.replace("/")} />
        </div>
      </div>
    </main>
  );
}
