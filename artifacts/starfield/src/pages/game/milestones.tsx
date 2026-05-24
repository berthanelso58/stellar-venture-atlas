import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListMilestones, useCreateMilestone, useUpdateMilestone, useDeleteMilestone,
  useListTasks, getListMilestonesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Star } from "lucide-react";
import GameLayout from "./layout";

const STATUS_COLORS: Record<string, string> = {
  planted: "text-stone-400 bg-stone-400/10 border-stone-400/30",
  growing: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  blooming: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  harvested: "text-violet-400 bg-violet-400/10 border-violet-400/30",
};

const STATUS_LABELS: Record<string, string> = {
  planted: "Planted",
  growing: "Growing",
  blooming: "Blooming",
  harvested: "Harvested",
};

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={12} className={i < count ? "fill-amber-400 text-amber-400" : "text-muted/30"} />
      ))}
    </span>
  );
}

export default function Milestones() {
  const [, params] = useRoute("/game/:gameId/milestones");
  const gameId = Number(params?.gameId);
  const queryClient = useQueryClient();

  const { data: milestones = [], isLoading } = useListMilestones(gameId, { query: { enabled: !!gameId, queryKey: getListMilestonesQueryKey(gameId) } });
  const { data: tasks = [] } = useListTasks(gameId, { query: { enabled: !!gameId } });

  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", starsValue: "3", targetDate: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey(gameId) });

  const handleCreate = () => {
    if (!form.title.trim()) return;
    createMilestone.mutate({
      gameId,
      data: { title: form.title, description: form.description, starsValue: Number(form.starsValue), targetDate: form.targetDate || undefined }
    }, { onSuccess: () => { setOpen(false); setForm({ title: "", description: "", starsValue: "3", targetDate: "" }); invalidate(); } });
  };

  const handleStatusChange = (milestoneId: number, status: string) => {
    updateMilestone.mutate({ gameId, milestoneId, data: { status: status as "planted" | "growing" | "blooming" | "harvested" } }, { onSuccess: invalidate });
  };

  return (
    <GameLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground">Earth View</h1>
            <p className="text-sm text-muted-foreground mt-1">Landmarks planted across the terrain</p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus size={16} /> New Milestone</Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-center py-16">Loading milestones...</div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-lg">No milestones planted yet.</p>
            <p className="text-sm mt-2">Every journey begins with a single landmark.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {milestones.map(m => {
              const mTasks = tasks.filter(t => t.milestoneId === m.id);
              const doneTasks = mTasks.filter(t => t.status === "next_plan").length;
              const pct = mTasks.length > 0 ? Math.round((doneTasks / mTasks.length) * 100) : 0;
              return (
                <div key={m.id} data-testid={`card-milestone-${m.id}`} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                  <div className="flex justify-between items-start">
                    <h2 className="font-semibold text-foreground leading-tight">{m.title}</h2>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMilestone.mutate({ gameId, milestoneId: m.id }, { onSuccess: invalidate })}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
                  <div className="flex items-center justify-between">
                    <Stars count={m.starsValue} />
                    {m.targetDate && <span className="text-xs text-muted-foreground">{m.targetDate}</span>}
                  </div>
                  {mTasks.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{doneTasks}/{mTasks.length} tasks done</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  <Select value={m.status} onValueChange={v => handleStatusChange(m.id, v)}>
                    <SelectTrigger className={`text-xs h-7 border ${STATUS_COLORS[m.status] ?? ""}`} data-testid={`select-milestone-status-${m.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Plant a New Milestone</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Title</Label><Input data-testid="input-milestone-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What landmark will you reach?" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this milestone..." /></div>
              <div><Label>Stars Value (importance)</Label>
                <Select value={form.starsValue} onValueChange={v => setForm(f => ({ ...f, starsValue: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Target Date</Label><Input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="button-create-milestone" onClick={handleCreate} disabled={createMilestone.isPending}>Plant Milestone</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </GameLayout>
  );
}
