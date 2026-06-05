import { Switch, Route, Router as WouterRouter, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { I18nProvider, ValuesProvider } from "@/i18n";

import Home from "./pages/home";
import Tasks from "./pages/game/tasks";
import Roadmap from "./pages/game/roadmap";
import Milestones from "./pages/game/milestones";
import Risks from "./pages/game/risks";
import Kpis from "./pages/game/kpis";
import Players from "./pages/game/players";
import Timeline from "./pages/game/timeline";
import GlobalTimeline from "./pages/timeline";

const queryClient = new QueryClient();

// Wraps game routes so ValuesProvider can read the gameId from the route
function GameRoutes() {
  const [matchGame, gameParams] = useRoute("/game/:gameId/*?");
  const gameId = matchGame ? (gameParams?.gameId ?? "0") : "0";

  return (
    <ValuesProvider gameId={gameId}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/game/:gameId" component={Roadmap} />
        <Route path="/game/:gameId/roadmap" component={Roadmap} />
        <Route path="/game/:gameId/tasks" component={Tasks} />
        <Route path="/game/:gameId/milestones" component={Milestones} />
        <Route path="/game/:gameId/risks" component={Risks} />
        <Route path="/game/:gameId/kpis" component={Kpis} />
        <Route path="/game/:gameId/players" component={Players} />
        <Route path="/game/:gameId/timeline" component={Timeline} />
        <Route path="/timeline" component={GlobalTimeline} />
        <Route component={NotFound} />
      </Switch>
    </ValuesProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <GameRoutes />
          </WouterRouter>
        </I18nProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
