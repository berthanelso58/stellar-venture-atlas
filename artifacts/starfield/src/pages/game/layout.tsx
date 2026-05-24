import { Link, useRoute } from "wouter";

export default function GameLayout({ children }: { children?: React.ReactNode }) {
  const [match, params] = useRoute("/game/:gameId/*?");
  const gameId = params?.gameId;

  if (!gameId) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="px-6 h-14 flex items-center gap-6">
          <Link href="/" className="font-serif text-primary font-bold text-xl mr-4">SF</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href={`/game/${gameId}/tasks`} className="text-muted-foreground hover:text-primary transition-colors">Tasks</Link>
            <Link href={`/game/${gameId}/milestones`} className="text-muted-foreground hover:text-primary transition-colors">Milestones</Link>
            <Link href={`/game/${gameId}/risks`} className="text-muted-foreground hover:text-primary transition-colors">Risks</Link>
            <Link href={`/game/${gameId}/kpis`} className="text-muted-foreground hover:text-primary transition-colors">KPIs</Link>
            <Link href={`/game/${gameId}/players`} className="text-muted-foreground hover:text-primary transition-colors">Crew</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
