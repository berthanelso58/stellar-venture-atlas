import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListGames, useCreateGame, getListGamesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Star, AlertCircle } from "lucide-react";

const EMPTY_FORM = { name: "", mission: "", description: "", playerCount: "1" };

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: games = [], isLoading } = useListGames();
  const createGame = useCreateGame();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string; mission?: string; playerCount?: string }>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListGamesQueryKey() });

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim())    e.name    = "Game name is required.";
    if (!form.mission.trim()) e.mission = "Mission statement is required.";
    const n = Number(form.playerCount);
    if (isNaN(n) || n < 1 || n > 20) e.playerCount = "Must be between 1 and 20.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleOpen = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(true);
  };

  const handleCreate = () => {
    if (!validate()) return;
    createGame.mutate(
      {
        data: {
          name: form.name.trim(),
          mission: form.mission.trim(),
          description: form.description.trim() || undefined,
          playerCount: Number(form.playerCount),
        },
      },
      {
        onSuccess: (game) => {
          setOpen(false);
          setForm(EMPTY_FORM);
          invalidate();
          setLocation(`/game/${game.id}/roadmap`);
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Could not create game. Please try again.";
          toast({ title: "Failed to create game", description: message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              top: Math.random() * 60 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.1,
            }} />
        ))}
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-8 py-16">
        <header className="mb-16 text-center">
          <h1 className="text-6xl font-serif text-primary tracking-tight mb-4">STARFIELD</h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
            A collaborative game for companies navigating their mission — from North Star to earth.
          </p>
        </header>

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Your Games</h2>
          <Button data-testid="button-create-game" onClick={handleOpen} className="gap-2">
            <Plus size={16} /> New Game
          </Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-center py-16">Loading your universe…</div>
        ) : games.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground border border-dashed border-border/50 rounded-2xl">
            <Star size={32} className="mx-auto mb-4 text-primary/30" />
            <p className="text-lg">No games yet.</p>
            <p className="text-sm mt-2">Create your first game to begin navigating your mission.</p>
            <Button className="mt-6 gap-2" onClick={handleOpen}><Plus size={16} /> Create First Game</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {games.map(game => (
              <Link key={game.id} href={`/game/${game.id}/roadmap`}>
                <div data-testid={`card-game-${game.id}`}
                  className="border border-border bg-card p-6 rounded-xl hover:border-primary/50 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="text-lg font-bold text-card-foreground group-hover:text-primary transition-colors leading-tight">{game.name}</h2>
                    <Star size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 italic">"{game.mission}"</p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border/50 pt-3">
                    <span>{game.playerCount} {game.playerCount === 1 ? "player" : "players"}</span>
                    <span className="text-primary/50">Enter &rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── New Game Dialog ── */}
      <Dialog open={open} onOpenChange={o => { if (!o && !createGame.isPending) { setOpen(false); setErrors({}); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a New Game</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label>Game Name <span className="text-destructive">*</span></Label>
              <Input
                data-testid="input-game-name"
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: undefined })); }}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
                placeholder="Your company or project name"
                className={errors.name ? "border-destructive" : ""}
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle size={11} /> {errors.name}
                </p>
              )}
            </div>

            {/* Mission */}
            <div>
              <Label>North Star Mission <span className="text-destructive">*</span></Label>
              <Textarea
                data-testid="input-game-mission"
                value={form.mission}
                onChange={e => { setForm(f => ({ ...f, mission: e.target.value })); setErrors(er => ({ ...er, mission: undefined })); }}
                placeholder="What is your company's ultimate mission?"
                className={errors.mission ? "border-destructive" : ""}
                rows={3}
              />
              {errors.mission && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle size={11} /> {errors.mission}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="A short description of this game / company"
                rows={2}
              />
            </div>

            {/* Player count */}
            <div>
              <Label>Number of Players</Label>
              <Input
                data-testid="input-game-players"
                type="number"
                min="1"
                max="20"
                value={form.playerCount}
                onChange={e => { setForm(f => ({ ...f, playerCount: e.target.value })); setErrors(er => ({ ...er, playerCount: undefined })); }}
                className={errors.playerCount ? "border-destructive" : ""}
              />
              {errors.playerCount && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle size={11} /> {errors.playerCount}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setErrors({}); }} disabled={createGame.isPending}>
              Cancel
            </Button>
            <Button
              data-testid="button-submit-game"
              onClick={handleCreate}
              disabled={createGame.isPending}
            >
              {createGame.isPending ? "Launching…" : "Launch Game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
