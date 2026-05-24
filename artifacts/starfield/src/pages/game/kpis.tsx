import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListKpis, useCreateKpi, useUpdateKpi, useDeleteKpi,
  useListKpiEntries, useCreateKpiEntry, useListMilestones,
  useListTasks, getListKpisQueryKey, getListKpiEntriesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import GameLayout from "./layout";

function TrendIcon({ trend }: { trend?: string | null }) {
  if (trend === "up") return <TrendingUp size={14} className="text-emerald-400" />;
  if (trend === "down") return <TrendingDown size={14} className="text-red-400" />;
  return <Minus size={14} className="text-muted-foreground" />;
}

function KpiCard({ kpi, gameId, milestones, tasks }: { kpi: any; gameId: number; milestones: any[]; tasks: any[] }) {
  const queryClient = useQueryClient();
  const { data: entries = [] } = useListKpiEntries(gameId, kpi.id, { query: { enabled: !!gameId && !!kpi.id, queryKey: getListKpiEntriesQueryKey(gameId, kpi.id) } });
  const createEntry = useCreateKpiEntry();
  const updateKpi = useUpdateKpi();
  const deleteKpi = useDeleteKpi();

  const [entryVal, setEntryVal] = useState("");
  const [logOpen, setLogOpen] = useState(false);

  const pct = kpi.target > 0 ? Math.min(100, Math.round((kpi.current / kpi.target) * 100)) : 0;
  const milestone = milestones.find(m => m.id === kpi.milestoneId);
  const linked = tasks.filter(t => t.kpiImpact === kpi.name);

  const handleLog = () => {
    const v = parseFloat(entryVal);
    if (isNaN(v)) return;
    const today = new Date().toISOString().split("T")[0];
    createEntry.mutate({ gameId, kpiId: kpi.id, data: { value: v, date: today } }, {
      onSuccess: () => {
        setEntryVal(""); setLogOpen(false);
        queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(gameId) });
        queryClient.invalidateQueries({ queryKey: getListKpiEntriesQueryKey(gameId, kpi.id) });
      }
    });
  };

  return (
    <div data-testid={`card-kpi-${kpi.id}`} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-semibold text-foreground">{kpi.name}</h2>
          {kpi.description && <p className="text-xs text-muted-foreground mt-0.5">{kpi.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <TrendIcon trend={kpi.trend} />
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => deleteKpi.mutate({ gameId, kpiId: kpi.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(gameId) }) })}>
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold text-primary tabular-nums">{kpi.current}<span className="text-sm text-muted-foreground ml-1">{kpi.unit}</span></span>
        <span className="text-sm text-muted-foreground">/ {kpi.target} {kpi.unit}</span>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground text-right">{pct}% of target</p>

      {milestone && <p className="text-xs text-primary/70 border border-primary/20 rounded px-2 py-0.5 w-fit">Milestone: {milestone.title}</p>}

      {linked.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1">Linked tasks:</p>
          <ul className="space-y-0.5">
            {linked.map(t => (
              <li key={t.id} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${t.status === "next_plan" ? "bg-emerald-400" : t.status === "check" ? "bg-amber-400" : "bg-muted-foreground"}`} />
                {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex gap-1 items-end h-10">
          {entries.slice(0, 14).reverse().map((e: any, i: number) => {
            const maxVal = Math.max(...entries.map((x: any) => x.value), kpi.target);
            const h = maxVal > 0 ? Math.max(4, Math.round((e.value / maxVal) * 36)) : 4;
            return <div key={i} className="flex-1 bg-primary/40 rounded-sm" style={{ height: `${h}px` }} />;
          })}
        </div>
      )}

      {logOpen ? (
        <div className="flex gap-2 mt-1">
          <Input data-testid={`input-kpi-value-${kpi.id}`} type="number" value={entryVal} onChange={e => setEntryVal(e.target.value)} placeholder={`Today's value (${kpi.unit})`} className="h-8 text-sm" />
          <Button size="sm" onClick={handleLog} disabled={createEntry.isPending}>Log</Button>
          <Button size="sm" variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
        </div>
      ) : (
        <Button data-testid={`button-log-kpi-${kpi.id}`} size="sm" variant="outline" className="w-full text-xs" onClick={() => setLogOpen(true)}>Log Today</Button>
      )}
    </div>
  );
}

export default function Kpis() {
  const [, params] = useRoute("/game/:gameId/kpis");
  const gameId = Number(params?.gameId);
  const queryClient = useQueryClient();

  const { data: kpis = [], isLoading } = useListKpis(gameId, { query: { enabled: !!gameId, queryKey: getListKpisQueryKey(gameId) } });
  const { data: milestones = [] } = useListMilestones(gameId, { query: { enabled: !!gameId } });
  const { data: tasks = [] } = useListTasks(gameId, { query: { enabled: !!gameId } });
  const createKpi = useCreateKpi();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", unit: "", target: "", milestoneId: "" });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    createKpi.mutate({
      gameId,
      data: { name: form.name, description: form.description, unit: form.unit || "units", target: Number(form.target) || 100, milestoneId: form.milestoneId ? Number(form.milestoneId) : null }
    }, { onSuccess: () => { setOpen(false); setForm({ name: "", description: "", unit: "", target: "", milestoneId: "" }); queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(gameId) }); } });
  };

  return (
    <GameLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground">KPI Constellation</h1>
            <p className="text-sm text-muted-foreground mt-1">Vital signs — correlated with tasks and milestones</p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus size={16} /> Add KPI</Button>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-center py-16">Loading...</div>
        ) : kpis.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-lg">No KPIs defined yet.</p>
            <p className="text-sm mt-2">Define what you measure — then measure what matters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {kpis.map(kpi => <KpiCard key={kpi.id} kpi={kpi} gameId={gameId} milestones={milestones} tasks={tasks} />)}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a KPI</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input data-testid="input-kpi-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Monthly Revenue" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. $, users, %" /></div>
                <div><Label>Target</Label><Input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="100" /></div>
              </div>
              {milestones.length > 0 && (
                <div><Label>Linked Milestone (optional)</Label>
                  <Select value={form.milestoneId} onValueChange={v => setForm(f => ({ ...f, milestoneId: v }))}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {milestones.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button data-testid="button-create-kpi" onClick={handleCreate} disabled={createKpi.isPending}>Add KPI</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </GameLayout>
  );
}
