import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListRisks, useCreateRisk, useUpdateRisk, useDeleteRisk,
  getListRisksQueryKey
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

const SEVERITY_STYLES: Record<string, { badge: string; glow: string; label: string }> = {
  lurking: { badge: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30", glow: "shadow-yellow-900/30", label: "Lurking" },
  stalking: { badge: "text-orange-400 bg-orange-400/10 border-orange-400/30", glow: "shadow-orange-900/30", label: "Stalking" },
  charging: { badge: "text-red-500 bg-red-500/10 border-red-500/30", glow: "shadow-red-900/40", label: "Charging" },
  tamed: { badge: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", glow: "shadow-emerald-900/20", label: "Tamed" },
};

const STATUS_LABELS: Record<string, string> = { active: "Active", mitigated: "Mitigated", eliminated: "Eliminated" };

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={10} className={i < value ? "fill-amber-400 text-amber-400" : "text-muted/30"} />
      ))}
    </span>
  );
}

export default function Risks() {
  const [, params] = useRoute("/game/:gameId/risks");
  const gameId = Number(params?.gameId);
  const queryClient = useQueryClient();

  const { data: risks = [], isLoading } = useListRisks(gameId, { query: { enabled: !!gameId, queryKey: getListRisksQueryKey(gameId) } });
  const createRisk = useCreateRisk();
  const updateRisk = useUpdateRisk();
  const deleteRisk = useDeleteRisk();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", severity: "lurking", likelihood: "3", impact: "3", mitigationPlan: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListRisksQueryKey(gameId) });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createRisk.mutate({
      gameId,
      data: { name: form.name, description: form.description, severity: form.severity as "lurking" | "stalking" | "charging" | "tamed", likelihood: Number(form.likelihood), impact: Number(form.impact), mitigationPlan: form.mitigationPlan || undefined }
    }, { onSuccess: () => { setOpen(false); setForm({ name: "", description: "", severity: "lurking", likelihood: "3", impact: "3", mitigationPlan: "" }); invalidate(); } });
  };

  const handleStatusChange = (riskId: number, status: string) => {
    updateRisk.mutate({ gameId, riskId, data: { status: status as "active" | "mitigated" | "eliminated" } }, { onSuccess: invalidate });
  };

  const activeRisks = risks.filter(r => r.status === "active");
  const resolvedRisks = risks.filter(r => r.status !== "active");

  return (
    <GameLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground">The Carnivores</h1>
            <p className="text-sm text-muted-foreground mt-1">Risks prowling your terrain — name them to tame them</p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus size={16} /> Name a Carnivore</Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-center py-16">Loading...</div>
        ) : (
          <>
            {activeRisks.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Active Threats</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {activeRisks.map(r => {
                    const sev = SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.lurking;
                    return (
                      <div key={r.id} data-testid={`card-risk-${r.id}`} className={`bg-card border border-border rounded-xl p-5 flex flex-col gap-3 shadow-lg ${sev.glow} hover:border-primary/40 transition-colors`}>
                        <div className="flex justify-between items-start">
                          <span className={`text-xs px-2 py-0.5 rounded border font-bold uppercase tracking-wide ${sev.badge}`}>{sev.label}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteRisk.mutate({ gameId, riskId: r.id }, { onSuccess: invalidate })}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                        <h2 className="font-semibold text-foreground">{r.name}</h2>
                        {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <div className="flex flex-col gap-1"><span>Likelihood</span><StarRating value={r.likelihood} /></div>
                          <div className="flex flex-col gap-1"><span>Impact</span><StarRating value={r.impact} /></div>
                        </div>
                        {r.mitigationPlan && <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">{r.mitigationPlan}</p>}
                        <Select value={r.status} onValueChange={v => handleStatusChange(r.id, v)}>
                          <SelectTrigger className="text-xs h-7" data-testid={`select-risk-status-${r.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {resolvedRisks.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Resolved</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {resolvedRisks.map(r => (
                    <div key={r.id} className="bg-card/40 border border-border/40 rounded-xl p-4 flex justify-between items-center opacity-60">
                      <div>
                        <p className="font-medium text-sm text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{r.status}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteRisk.mutate({ gameId, riskId: r.id }, { onSuccess: invalidate })}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {risks.length === 0 && (
              <div className="text-center py-24 text-muted-foreground">
                <p className="text-lg">No carnivores spotted yet.</p>
                <p className="text-sm mt-2">Name your risks to see them clearly.</p>
              </div>
            )}
          </>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Name a Carnivore</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input data-testid="input-risk-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="What threatens the mission?" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lurking">Lurking</SelectItem>
                    <SelectItem value="stalking">Stalking</SelectItem>
                    <SelectItem value="charging">Charging</SelectItem>
                    <SelectItem value="tamed">Tamed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Likelihood (1-5)</Label><Input type="number" min="1" max="5" value={form.likelihood} onChange={e => setForm(f => ({ ...f, likelihood: e.target.value }))} /></div>
                <div><Label>Impact (1-5)</Label><Input type="number" min="1" max="5" value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))} /></div>
              </div>
              <div><Label>Mitigation Plan</Label><Textarea value={form.mitigationPlan} onChange={e => setForm(f => ({ ...f, mitigationPlan: e.target.value }))} placeholder="How will you tame it?" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="button-create-risk" onClick={handleCreate} disabled={createRisk.isPending}>Add Carnivore</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </GameLayout>
  );
}
