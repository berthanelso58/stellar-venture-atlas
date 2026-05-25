import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListKpis, useCreateKpi, useUpdateKpi, useDeleteKpi,
  useListMilestones, useListTasks,
  getListKpisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Pencil, Plus, Link2, ChevronRight, Trash2 } from "lucide-react";
import GameLayout from "./layout";
import { useLang } from "@/i18n";

// ── Funnel stage definitions ──────────────────────────────────────────────────
const FUNNEL_STAGES = [
  { key: "Research",         label: "Research",         group: "creation",  color: "#818cf8", desc: "Experiments, learnings, discoveries" },
  { key: "Strategy",         label: "Strategy",         group: "creation",  color: "#a78bfa", desc: "Strategic bets & focus areas" },
  { key: "Idea",             label: "Idea",             group: "creation",  color: "#c084fc", desc: "Validated ideas in the pipeline" },
  { key: "Production",       label: "Production",       group: "build",     color: "#f472b6", desc: "Features & content in production" },
  { key: "Deliverables",     label: "Deliverables",     group: "build",     color: "#fb7185", desc: "Shipped deliverables" },
  { key: "Channels",         label: "Channels",         group: "growth",    color: "#fb923c", desc: "Active distribution channels" },
  { key: "Total Exposure",   label: "Total Exposure",   group: "growth",    color: "#fbbf24", desc: "Total reach across all channels" },
  { key: "Followers",        label: "Followers",        group: "audience",  color: "#a3e635", desc: "Followers & subscribers" },
  { key: "Total Users",      label: "Total Users",      group: "audience",  color: "#34d399", desc: "Registered / activated users" },
  { key: "Paid Users",       label: "Paid Users",       group: "revenue",   color: "#22d3ee", desc: "Paying customers" },
  { key: "Recurring Users",  label: "Recurring (DAU)",  group: "revenue",   color: "#60a5fa", desc: "Daily active users" },
] as const;

type StageKey = typeof FUNNEL_STAGES[number]["key"];

const GROUP_LABELS: Record<string, string> = {
  creation: "Creation",
  build:    "Build",
  growth:   "Growth",
  audience: "Audience",
  revenue:  "Revenue",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

// ── Stage Row ─────────────────────────────────────────────────────────────────
function StageRow({
  stage, kpi, maxVal, gameId, milestones, tasks,
  prevKpi, onActivate,
}: {
  stage: typeof FUNNEL_STAGES[number];
  kpi: any | null;
  maxVal: number;
  gameId: number;
  milestones: any[];
  tasks: any[];
  prevKpi: any | null;
  onActivate: (key: StageKey) => void;
}) {
  const queryClient = useQueryClient();
  const updateKpi = useUpdateKpi();
  const deleteKpi = useDeleteKpi();

  const [editVal,    setEditVal]    = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editing,    setEditing]    = useState(false);
  const [milestoneEdit, setMilestoneEdit] = useState(false);

  const current = kpi?.current ?? 0;
  const target  = kpi?.target  ?? 100;
  const pct     = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const barPct  = maxVal > 0 ? (current / maxVal) * 100 : 0;
  const milestone = milestones.find(m => m.id === kpi?.milestoneId);
  const linkedTasks = tasks.filter(t => t.kpiImpact === stage.key || t.kpiImpact === stage.label);

  // Conversion from previous stage
  const convRate = prevKpi && prevKpi.current > 0
    ? Math.round((current / prevKpi.current) * 100)
    : null;

  const startEdit = () => {
    setEditVal(String(kpi?.current ?? 0));
    setEditTarget(String(kpi?.target ?? 100));
    setEditing(true);
    setMilestoneEdit(false);
  };

  const saveEdit = () => {
    if (!kpi) return;
    const v = parseFloat(editVal);
    const tgt = parseFloat(editTarget);
    if (isNaN(v)) return;
    updateKpi.mutate(
      { gameId, kpiId: kpi.id, data: { current: v, ...(isNaN(tgt) ? {} : { target: tgt }) } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(gameId) }); setEditing(false); } }
    );
  };

  const saveMilestone = (val: string) => {
    if (!kpi) return;
    const mid = val === "none" ? null : Number(val);
    updateKpi.mutate(
      { gameId, kpiId: kpi.id, data: { milestoneId: mid } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(gameId) }); setMilestoneEdit(false); } }
    );
  };

  const handleDelete = () => {
    if (!kpi) return;
    deleteKpi.mutate({ gameId, kpiId: kpi.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(gameId) }) });
  };

  return (
    <div className="relative flex items-stretch gap-0">
      {/* Left gutter: group label + connector */}
      <div className="w-24 shrink-0 flex flex-col items-end pr-3 pt-3 select-none">
        <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: stage.color + "90" }}>
          {GROUP_LABELS[stage.group]}
        </span>
      </div>

      {/* Stage card */}
      <div className="flex-1 min-w-0 mb-0.5">
        {/* Conversion arrow from previous */}
        {convRate !== null && (
          <div className="flex items-center gap-1.5 mb-1 ml-2">
            <ChevronRight size={11} style={{ color: stage.color + "70" }} />
            <span className="text-[10px] tabular-nums" style={{ color: stage.color + "70" }}>
              {convRate}% conversion
            </span>
          </div>
        )}

        <div
          className="rounded-xl border transition-all hover:border-opacity-60 group relative overflow-hidden"
          style={{ borderColor: stage.color + (kpi ? "50" : "25"), background: kpi ? `rgba(15,23,42,0.8)` : "rgba(15,23,42,0.4)" }}
        >
          {/* Funnel bar background */}
          {kpi && (
            <div
              className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700"
              style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${stage.color}18, ${stage.color}08)`, borderRight: `1px solid ${stage.color}20` }}
            />
          )}

          <div className="relative z-10 flex items-center gap-4 px-4 py-3">
            {/* Step badge */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold border"
              style={{ borderColor: stage.color + (kpi ? "60" : "20"), color: stage.color + (kpi ? "ff" : "50"),
                background: kpi ? stage.color + "18" : "transparent",
                boxShadow: kpi ? `0 0 12px 2px ${stage.color}30` : "none" }}>
              {String(FUNNEL_STAGES.findIndex(s => s.key === stage.key) + 1).padStart(2, "0")}
            </div>

            {/* Label + desc */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight" style={{ color: kpi ? stage.color : stage.color + "50" }}>
                {stage.label}
              </p>
              <p className="text-[10px] text-muted-foreground/50 leading-tight mt-0.5">{stage.desc}</p>
            </div>

            {/* Value area */}
            {kpi ? (
              <>
                {editing ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col gap-1">
                      <Input
                        type="number" value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveEdit()}
                        className="h-7 w-24 text-sm tabular-nums text-right"
                        placeholder="Current"
                        autoFocus
                      />
                      <Input
                        type="number" value={editTarget} onChange={e => setEditTarget(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && saveEdit()}
                        className="h-6 w-24 text-xs tabular-nums text-right text-muted-foreground"
                        placeholder="Target"
                      />
                    </div>
                    <button onClick={saveEdit} disabled={updateKpi.isPending}
                      className="p-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors">
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1 shrink-0 cursor-pointer group/val" onClick={startEdit}>
                    <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: stage.color }}>
                      {fmt(current)}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      / {fmt(target)} {kpi.unit}
                    </span>
                  </div>
                )}

                {/* Progress arc */}
                <div className="w-9 h-9 shrink-0 relative">
                  <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke={stage.color + "20"} strokeWidth="3" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke={stage.color} strokeWidth="3"
                      strokeDasharray={`${(pct / 100) * 2 * Math.PI * 14} ${2 * Math.PI * 14}`}
                      strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 4px ${stage.color}80)` }} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums" style={{ color: stage.color }}>{pct}%</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={startEdit} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => { setMilestoneEdit(v => !v); setEditing(false); }}
                    className="p-1 transition-colors" style={{ color: milestone ? stage.color : undefined }}
                    title="Link milestone">
                    <Link2 size={11} />
                  </button>
                  <button onClick={handleDelete} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 size={11} />
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => onActivate(stage.key)}
                className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-dashed transition-all hover:border-opacity-60 shrink-0"
                style={{ borderColor: stage.color + "30", color: stage.color + "60" }}>
                <Plus size={10} /> Activate
              </button>
            )}
          </div>

          {/* Milestone link row */}
          {kpi && (
            <div className="relative z-10 border-t border-border/20 px-4 py-1.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {milestone
                  ? <span className="text-[10px] px-2 py-0.5 rounded border w-fit truncate"
                      style={{ color: stage.color + "cc", borderColor: stage.color + "30", background: stage.color + "0d" }}>
                      {milestone.title}
                    </span>
                  : <span className="text-[10px] text-muted-foreground/30 italic">No milestone linked</span>}
              </div>
              {linkedTasks.length > 0 && (
                <span className="text-[9px] text-muted-foreground/40 shrink-0">{linkedTasks.length} task{linkedTasks.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          )}

          {/* Milestone selector dropdown */}
          {milestoneEdit && kpi && (
            <div className="relative z-10 border-t border-border/20 px-4 py-2">
              <Select
                value={kpi.milestoneId ? String(kpi.milestoneId) : "none"}
                onValueChange={saveMilestone}
              >
                <SelectTrigger className="h-7 text-xs w-full">
                  <SelectValue placeholder="Link to milestone…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No milestone</SelectItem>
                  {milestones.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Activate Dialog ───────────────────────────────────────────────────────────
function ActivateStage({ stageKey, gameId, milestones, onClose }: {
  stageKey: StageKey; gameId: number; milestones: any[]; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const createKpi = useCreateKpi();
  const stage = FUNNEL_STAGES.find(s => s.key === stageKey)!;

  const [current, setCurrent]     = useState("0");
  const [target,  setTarget]      = useState("100");
  const [unit,    setUnit]        = useState("");
  const [milestoneId, setMilestoneId] = useState("none");

  const handleCreate = () => {
    createKpi.mutate(
      { gameId, data: {
        name: stage.key,
        description: stage.desc,
        unit: unit || "units",
        target: Number(target) || 100,
        current: Number(current) || 0,
        milestoneId: milestoneId !== "none" ? Number(milestoneId) : null,
      }},
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(gameId) }); onClose(); } }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl"
        style={{ borderColor: stage.color + "40", boxShadow: `0 0 40px 4px ${stage.color}20` }}
        onClick={e => e.stopPropagation()}>
        <div>
          <h2 className="font-serif font-bold text-lg" style={{ color: stage.color }}>Activate {stage.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{stage.desc}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Current value</p>
            <Input type="number" value={current} onChange={e => setCurrent(e.target.value)} className="text-sm" placeholder="0" autoFocus />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Target</p>
            <Input type="number" value={target} onChange={e => setTarget(e.target.value)} className="text-sm" placeholder="100" />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Unit</p>
          <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="users, reach, ideas…" className="text-sm" />
        </div>
        {milestones.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Link to milestone</p>
            <Select value={milestoneId} onValueChange={setMilestoneId}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {milestones.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleCreate} disabled={createKpi.isPending}
            style={{ backgroundColor: stage.color, color: "#0f172a" }}>
            Activate
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Kpis() {
  const [, params]       = useRoute("/game/:gameId/kpis");
  const gameId           = Number(params?.gameId);
  const { t }            = useLang();

  const { data: kpis       = [], isLoading } = useListKpis(gameId,      { query: { enabled: !!gameId, queryKey: getListKpisQueryKey(gameId) } });
  const { data: milestones = [] }             = useListMilestones(gameId, { query: { enabled: !!gameId } });
  const { data: tasks      = [] }             = useListTasks(gameId,      { query: { enabled: !!gameId } });

  const [activating, setActivating] = useState<StageKey | null>(null);

  // Map each funnel stage to its KPI (matched by name, case-insensitive)
  const stageKpis = FUNNEL_STAGES.map(s => ({
    stage: s,
    kpi: kpis.find(k => k.name.toLowerCase() === s.key.toLowerCase()) ?? null,
  }));

  // Max current value across activated stages (for bar width scaling)
  const maxVal = Math.max(...stageKpis.map(s => s.kpi?.current ?? 0), 1);

  // Extra KPIs not matched to any funnel stage
  const funnelKeys = new Set(FUNNEL_STAGES.map(s => s.key.toLowerCase()));
  const extraKpis  = kpis.filter(k => !funnelKeys.has(k.name.toLowerCase()));

  const activatedCount = stageKpis.filter(s => s.kpi).length;

  return (
    <GameLayout>
      <div className="h-[calc(100vh-3.5rem)] overflow-auto"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #0d1b2a 0%, #060d14 60%, #030508 100%)" }}>
        {/* Stars */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width: Math.random() * 2 + 0.5 + "px", height: Math.random() * 2 + 0.5 + "px",
                top: Math.random() * 100 + "%", left: Math.random() * 100 + "%", opacity: Math.random() * 0.35 + 0.05 }} />
          ))}
        </div>

        <div className="relative z-10 max-w-2xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-serif text-amber-400 font-bold tracking-wide">{t.kpis}</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Workflow funnel — current situation snapshot
                {activatedCount > 0 && <span className="ml-2 text-primary/60">{activatedCount}/{FUNNEL_STAGES.length} stages active</span>}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="text-muted-foreground text-center py-16">Loading…</div>
          ) : (
            <div className="flex flex-col gap-1">
              {stageKpis.map(({ stage, kpi }, idx) => {
                const prevKpi = idx > 0 ? stageKpis[idx - 1].kpi : null;
                return (
                  <StageRow
                    key={stage.key}
                    stage={stage}
                    kpi={kpi}
                    maxVal={maxVal}
                    gameId={gameId}
                    milestones={milestones}
                    tasks={tasks}
                    prevKpi={prevKpi}
                    onActivate={k => setActivating(k)}
                  />
                );
              })}
            </div>
          )}

          {/* Extra KPIs not in funnel */}
          {extraKpis.length > 0 && (
            <div className="mt-8 border border-border/30 rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Other KPIs</p>
              <div className="grid grid-cols-2 gap-3">
                {extraKpis.map(kpi => {
                  const pct = kpi.target > 0 ? Math.min(100, Math.round((kpi.current / kpi.target) * 100)) : 0;
                  const ms  = milestones.find(m => m.id === kpi.milestoneId);
                  return (
                    <div key={kpi.id} className="border border-border/30 rounded-lg p-3 bg-card/40">
                      <p className="text-xs font-medium text-foreground truncate">{kpi.name}</p>
                      <p className="text-xl font-bold text-primary tabular-nums mt-1">{fmt(kpi.current)}<span className="text-xs text-muted-foreground ml-1">{kpi.unit}</span></p>
                      <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                      </div>
                      {ms && <p className="text-[10px] text-primary/60 mt-1.5 truncate">{ms.title}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {activating && (
        <ActivateStage
          stageKey={activating}
          gameId={gameId}
          milestones={milestones}
          onClose={() => setActivating(null)}
        />
      )}
    </GameLayout>
  );
}
