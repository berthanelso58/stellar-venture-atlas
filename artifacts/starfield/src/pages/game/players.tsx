import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListPlayers, useCreatePlayer, useDeletePlayer,
  useListTasks, getListPlayersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import GameLayout from "./layout";

const AVATAR_COLORS = ["#6366f1","#8b5cf6","#d946ef","#f43f5e","#f97316","#eab308","#22c55e","#14b8a6","#0ea5e9","#3b82f6"];

export default function Players() {
  const [, params] = useRoute("/game/:gameId/players");
  const gameId = Number(params?.gameId);
  const queryClient = useQueryClient();

  const { data: players = [], isLoading } = useListPlayers(gameId, { query: { enabled: !!gameId, queryKey: getListPlayersQueryKey(gameId) } });
  const { data: tasks = [] } = useListTasks(gameId, { query: { enabled: !!gameId } });
  const createPlayer = useCreatePlayer();
  const deletePlayer = useDeletePlayer();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", avatarColor: AVATAR_COLORS[0] });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createPlayer.mutate({ gameId, data: { name: form.name, role: form.role || "Player", avatarColor: form.avatarColor } },
      { onSuccess: () => { setOpen(false); setForm({ name: "", role: "", avatarColor: AVATAR_COLORS[0] }); invalidate(); } });
  };

  return (
    <GameLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground">The Crew</h1>
            <p className="text-sm text-muted-foreground mt-1">The constellation of people navigating this mission</p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus size={16} /> Add Player</Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-center py-16">Loading crew...</div>
        ) : players.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-lg">No crew members yet.</p>
            <p className="text-sm mt-2">Every mission needs its constellation of people.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {players.map(p => {
              const assignedTasks = tasks.filter(t => t.assignedPlayerId === p.id);
              const activeTasks = assignedTasks.filter(t => t.status !== "next_plan");
              return (
                <div key={p.id} data-testid={`card-player-${p.id}`} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: p.avatarColor }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h2 className="font-semibold text-foreground">{p.name}</h2>
                      <p className="text-sm text-muted-foreground">{p.role}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deletePlayer.mutate({ gameId, playerId: p.id }, { onSuccess: invalidate })}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground border-t border-border/50 pt-3">
                    <span><span className="text-foreground font-medium">{activeTasks.length}</span> active tasks</span>
                    <span><span className="text-foreground font-medium">{assignedTasks.length}</span> total</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Crew Member</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input data-testid="input-player-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Player name" /></div>
              <div><Label>Role</Label><Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. CEO, Designer, Engineer" /></div>
              <div>
                <Label>Avatar Color</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} data-testid={`color-${c}`} onClick={() => setForm(f => ({ ...f, avatarColor: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.avatarColor === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="button-create-player" onClick={handleCreate} disabled={createPlayer.isPending}>Add to Crew</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </GameLayout>
  );
}
