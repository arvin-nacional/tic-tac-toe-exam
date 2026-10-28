import { Suspense } from "react";
import ActiveGame from "@/components/active-game";

type GamePageProps = { params: Promise<{ id: string }> };

async function GameContent({ params }: GamePageProps) {
  const { id } = await params;
  return <ActiveGame sessionId={id} />;
}

export default function GamePage({ params }: GamePageProps) {
  return (
    <Suspense fallback={<main className="home-page"><p role="status">Loading game…</p></main>}>
      <GameContent params={params} />
    </Suspense>
  );
}
