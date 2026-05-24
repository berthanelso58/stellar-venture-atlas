import { Link, useRoute } from "wouter";

export default function GameLayout({ children }: { children?: React.ReactNode }) {
  const [, params] = useRoute("/game/:gameId/*?");
  const [, routeParams] = useRoute("/game/:gameId/:page");
  const gameId = params?.gameId;
  const page = routeParams?.page ?? "roadmap";

  if (!gameId) return null;

  const navLinks = [
    { href: `/game/${gameId}/roadmap`, label: "Roadmap", id: "roadmap" },
    { href: `/game/${gameId}/tasks`, label: "Tasks", id: "tasks" },
    { href: `/game/${gameId}/kpis`, label: "KPIs", id: "kpis" },
    { href: `/game/${gameId}/risks`, label: "Risks", id: "risks" },
    { href: `/game/${gameId}/players`, label: "Crew", id: "players" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="px-6 h-14 flex items-center gap-6">
          <Link href="/" className="font-serif text-primary font-bold text-xl mr-4">SF</Link>
          <nav className="flex items-center gap-1 text-sm">
            {navLinks.map(link => (
              <Link key={link.id} href={link.href}
                className={`px-3 py-1.5 rounded-md transition-colors ${page === link.id || (link.id === "roadmap" && page === undefined) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
