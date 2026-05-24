import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Tasks from "./pages/game/tasks";
import Roadmap from "./pages/game/roadmap";
import Milestones from "./pages/game/milestones";
import Risks from "./pages/game/risks";
import Kpis from "./pages/game/kpis";
import Players from "./pages/game/players";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/game/:gameId" component={Roadmap} />
      <Route path="/game/:gameId/roadmap" component={Roadmap} />
      <Route path="/game/:gameId/tasks" component={Tasks} />
      <Route path="/game/:gameId/milestones" component={Milestones} />
      <Route path="/game/:gameId/risks" component={Risks} />
      <Route path="/game/:gameId/kpis" component={Kpis} />
      <Route path="/game/:gameId/players" component={Players} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
