import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListMilestones, useListTasks, useListKpis, useListPlayers,
  useCreateMilestone, useUpdateMilestone,
  useCreateTask, useUpdateTask, useCreateKpi,
  getListMilestonesQueryKey, getListTasksQueryKey, getListKpisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Star, Flag, Zap, ChevronDown, ChevronRight, Pencil, Check } from "lucide-react";
import GameLayout from "./layout";

type MilestoneStatus = "planted" | "growing" | "blooming" | "harvested";
type TaskStatus = "plan" | "doing" | "check" | "next_plan";
type Priority = "low" | "medium" | "high" | "critical";

const MS_COLORS: Record<MilestoneStatus, { stroke: string; fill: string; bg: string; label: string }> = {
  planted:  { stroke: "#64748b", fill: "#1e293b", bg: "rgba(100,116,139,0.08)", label: "Planted" },
  growing:  { stroke: "#4ade80", fill: "#052e16", bg: "rgba(74,222,128,0.08)",  label: "Growing" },
  blooming: { stroke: "#fb923c", fill: "#451a03", bg: "rgba(251,146,60,0.08)",  label: "Blooming" },
  harvested:{ stroke: "#a78bfa", fill: "#2e1065", bg: "rgba(167,139,250,0.10)", label: "Harvested" },
};

const TASK_COLS: { id: TaskStatus; label: string; dot: string; ring: string }[] = [
  { id: "plan",      label: "Plan",  dot: "#475569", ring: "#64748b" },
  { id: "doing",     label: "Doing", dot: "#d97706", ring: "#fbbf24" },
  { id: "check",     label: "Check", dot: "#2563eb", ring: "#60a5fa" },
  { id: "next_plan", label: "Done",  dot: "#16a34a", ring: "#4ade80" },
];

const PRIORITY_BADGE: Record<Priority, string> = {
  low:      "text-blue-400 border-blue-400/30 bg-blue-400/10",
  medium:   "text-amber-400 border-amber-400/30 bg-amber-400/10",
  high:     "text-orange-400 border-orange-400/30 bg-orange-400/10",
  critical: "text-red-500 border-red-500/40 bg-red-500/10",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 22 }: { name: string; color?: string | null; size?: number }) {
  return (
    <div title={name}
      style={{ width: size, height: size, backgroundColor: color ?? "#475569", fontSize: size * 0.45 }}
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 ring-1 ring-white/20"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StarSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star size={14} className={n <= value ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/40"} />
        </button>
      ))}
    </div>
  );
}

// ── Dash to the Finish Line ─────────────────────────────────────────────────
function DashToFinish({ kpis, milestoneId, msStatus }: { kpis: any[]; milestoneId: number; msStatus: MilestoneStatus }) {
  const linked = kpis.filter(k => k.milestoneId === milestoneId);
  if (linked.length === 0) return null;
  const col = MS_COLORS[msStatus];
  return (
    <div className="rounded-xl border px-4 py-3 mt-3 flex flex-col gap-2"
      style={{ borderColor: col.stroke + "40", background: col.bg, boxShadow: `0 0 18px 2px ${col.stroke}22` }}>
      <div className="flex items-center gap-2 mb-0.5">
        <Zap size={12} style={{ color: col.stroke }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: col.stroke }}>
          Dash to the Finish Line
        </span>
      </div>
      {linked.map(k => {
        const pct = k.target > 0 ? Math.min(100, Math.round((k.current / k.target) * 100)) : 0;
        return (
          <div key={k.id}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-foreground font-medium">{k.name}</span>
              <span className="text-xs tabular-nums" style={{ color: col.stroke }}>
                {k.current} / {k.target} {k.unit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg,${col.stroke}99,${col.stroke})`, boxShadow: `0 0 8px 1px ${col.stroke}88` }} />
            </div>
            <p className="text-[10px] text-right mt-0.5" style={{ color: col.stroke + "aa" }}>{pct}%</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, players, colRing, colDot, onStatusChange, onAssignChange }: {
  task: any; players: any[]; colRing: string; colDot: string;
  onStatusChange: (id: number, s: TaskStatus) => void;
  onAssignChange: (id: number, pid: number | null) => void;
}) {
  const assignee = players.find(p => p.id === task.assignedPlayerId);
  const ago = timeAgo(task.updatedAt);

  return (
    <div className="bg-background/60 border rounded-lg px-3 py-2.5 flex flex-col gap-1.5 hover:border-primary/40 transition-colors group"
      style={{ borderColor: colRing + "40" }}>
      {/* Title + priority */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs text-foreground leading-snug font-medium">{task.title}</span>
        {task.priority && (
          <span className={`text-[9px] px-1 py-0.5 rounded border uppercase font-bold shrink-0 ${PRIORITY_BADGE[task.priority as Priority] ?? ""}`}>
            {task.priority}
          </span>
        )}
      </div>
      {/* KPI impact */}
      {task.status === "check" && task.kpiImpact && (
        <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
          {task.kpiImpact}
        </div>
      )}
      {/* Footer: avatar + timestamp + status */}
      <div className="flex items-center justify-between mt-0.5 gap-1">
        <div className="flex items-center gap-1.5">
          {/* Avatar picker */}
          <div className="relative group/avatar">
            {assignee
              ? <Avatar name={assignee.name} color={assignee.avatarColor} size={18} />
              : (
                <div className="w-[18px] h-[18px] rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground/40">
                  <Plus size={7} />
                </div>
              )}
            <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/avatar:flex flex-col bg-popover border border-border rounded-lg shadow-lg overflow-hidden min-w-[130px]">
              <button className="text-[10px] px-2 py-1.5 text-left hover:bg-muted transition-colors text-muted-foreground"
                onClick={() => onAssignChange(task.id, null)}>Unassign</button>
              {players.map(p => (
                <button key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted transition-colors"
                  onClick={() => onAssignChange(task.id, p.id)}>
                  <Avatar name={p.name} color={p.avatarColor} size={14} />
                  <span className="text-[10px] text-foreground truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          {ago && <span className="text-[9px] text-muted-foreground/50">{ago}</span>}
        </div>
        <select value={task.status} onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="text-[10px] bg-transparent border-none text-muted-foreground focus:ring-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
          {TASK_COLS.map(c => <option key={c.id} value={c.id} className="bg-background">{c.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── Between-milestone Kanban (collapsed by default) ──────────────────────────
function BetweenKanban({ milestoneId, tasks, players, kpis, msStatus, msTitle, onStatusChange, onAssignChange, onAddTask }: {
  milestoneId: number; tasks: any[]; players: any[];
  kpis: any[]; msStatus: MilestoneStatus; msTitle: string;
  onStatusChange: (id: number, s: TaskStatus) => void;
  onAssignChange: (id: number, pid: number | null) => void;
  onAddTask: (milestoneId: number, status: TaskStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const msTasks = tasks.filter(t => t.milestoneId === milestoneId);
  const col = MS_COLORS[msStatus];

  const countByStatus = (s: TaskStatus) => msTasks.filter(t => t.status === s).length;

  // Connector line
  const Connector = ({ opacity = "60" }: { opacity?: string }) => (
    <div className="flex justify-center">
      <div className="h-6 w-px" style={{ background: `linear-gradient(to bottom, ${col.stroke}${opacity}, ${col.stroke}20)` }} />
    </div>
  );

  if (msTasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-2">
        <Connector />
        <button onClick={() => onAddTask(milestoneId, "plan")}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 py-1.5 px-3 rounded-full border border-dashed border-border/40 hover:border-primary/40">
          <Plus size={9} /> Add first task for this milestone
        </button>
        <Connector opacity="20" />
      </div>
    );
  }

  return (
    <div className="py-1">
      <Connector />

      {/* Collapsed summary bar */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all hover:border-primary/30"
        style={{ borderColor: col.stroke + "25", background: expanded ? col.bg : "rgba(15,23,42,0.5)" }}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {expanded ? <ChevronDown size={12} style={{ color: col.stroke }} /> : <ChevronRight size={12} style={{ color: col.stroke }} />}
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: col.stroke }}>
            {msTitle}
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">— {msTasks.length} tasks</span>
        </div>
        {/* Mini status pills */}
        <div className="flex items-center gap-2 shrink-0">
          {TASK_COLS.map(tc => {
            const n = countByStatus(tc.id);
            if (n === 0) return null;
            return (
              <div key={tc.id} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tc.dot }} />
                <span className="text-[10px] tabular-nums text-muted-foreground">{n}</span>
              </div>
            );
          })}
        </div>
      </button>

      {/* Expanded kanban */}
      {expanded && (
        <div className="mt-2">
          <div className="rounded-xl border overflow-hidden"
            style={{ borderColor: col.stroke + "25", background: "rgba(15,23,42,0.7)" }}>
            <div className="grid grid-cols-4 divide-x divide-border/20">
              {TASK_COLS.map(tc => {
                const colTasks = msTasks.filter(t => t.status === tc.id);
                return (
                  <div key={tc.id} className="flex flex-col min-h-[80px]">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tc.dot }} />
                        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{tc.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60">{colTasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 p-2 flex-1">
                      {colTasks.map(t => (
                        <TaskCard key={t.id} task={t} players={players}
                          colRing={tc.ring} colDot={tc.dot}
                          onStatusChange={onStatusChange} onAssignChange={onAssignChange} />
                      ))}
                      <button onClick={() => onAddTask(milestoneId, tc.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1 px-1 rounded">
                        <Plus size={9} /> Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dash to Finish Line */}
          <DashToFinish kpis={kpis} milestoneId={milestoneId} msStatus={msStatus} />
        </div>
      )}

      <Connector opacity="20" />
    </div>
  );
}

// ── Milestone Edit Panel ─────────────────────────────────────────────────────
function MilestoneEditPanel({ m, tasks, kpis, onSave, onCreateKpi, onAddTask }: {
  m: any; tasks: any[]; kpis: any[];
  onSave: (id: number, data: any) => void;
  onCreateKpi: (milestoneId: number) => void;
  onAddTask: (milestoneId: number) => void;
}) {
  const col = MS_COLORS[m.status as MilestoneStatus] ?? MS_COLORS.planted;
  const mTasks = tasks.filter(t => t.milestoneId === m.id);
  const linkedKpis = kpis.filter(k => k.milestoneId === m.id);
  const done = mTasks.filter(t => t.status === "next_plan").length;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: m.title, description: m.description ?? "", starsValue: m.starsValue, targetDate: m.targetDate ?? "", status: m.status as MilestoneStatus });

  const handleSave = () => {
    onSave(m.id, draft);
    setEditing(false);
  };

  return (
    <div className="mt-2 mb-1 ml-16 mr-0 rounded-xl border border-border/40 bg-card/50 backdrop-blur p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        {editing ? (
          <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            className="h-8 text-sm font-serif font-bold w-full mr-2" />
        ) : (
          <h3 className="font-serif font-bold text-sm text-foreground leading-snug">{m.title}</h3>
        )}
        <button onClick={() => editing ? handleSave() : setEditing(true)}
          className="shrink-0 ml-2 p-1.5 rounded-lg border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors">
          {editing ? <Check size={13} /> : <Pencil size={13} />}
        </button>
      </div>

      {/* Description */}
      {editing ? (
        <Textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          placeholder="Describe this milestone..." className="text-xs min-h-[60px]" />
      ) : (
        m.description && <p className="text-xs text-muted-foreground">{m.description}</p>
      )}

      {/* Stars + Date + Status row */}
      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Stars</span>
              <StarSelect value={draft.starsValue} onChange={n => setDraft(d => ({ ...d, starsValue: n }))} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Target Date</span>
              <Input type="date" value={draft.targetDate} onChange={e => setDraft(d => ({ ...d, targetDate: e.target.value }))}
                className="h-7 text-xs w-36" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Status</span>
              <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v as MilestoneStatus }))}>
                <SelectTrigger className="h-7 text-xs w-28" style={{ borderColor: col.stroke + "60", color: col.stroke }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["planted","growing","blooming","harvested"] as MilestoneStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{MS_COLORS[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={10} className={i <= m.starsValue ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/20"} />
              ))}
            </div>
            {m.targetDate && <span className="text-xs text-muted-foreground">{m.targetDate}</span>}
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
              style={{ color: col.stroke, borderColor: col.stroke + "40" }}>{col.label}</span>
          </>
        )}
      </div>

      {/* Task progress */}
      {mTasks.length > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
            <span>Tasks</span><span>{done}/{mTasks.length} done</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${mTasks.length > 0 ? (done/mTasks.length)*100 : 0}%`, background: col.stroke }} />
          </div>
        </div>
      )}

      {/* Linked KPIs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">KPIs for this Milestone</span>
          <button onClick={() => onCreateKpi(m.id)}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors">
            <Plus size={9} /> Add KPI
          </button>
        </div>
        {linkedKpis.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/50 italic">No KPIs linked yet. Add one to track progress.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {linkedKpis.map(k => {
              const pct = k.target > 0 ? Math.min(100, Math.round((k.current/k.target)*100)) : 0;
              return (
                <div key={k.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-foreground flex-1 truncate">{k.name}</span>
                  <span className="text-[10px] tabular-nums" style={{ color: col.stroke }}>{k.current}/{k.target} {k.unit}</span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col.stroke }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-border/30">
        <button onClick={() => onAddTask(m.id)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          <Plus size={9} /> Add Task
        </button>
      </div>
    </div>
  );
}

// ── Milestone Node ────────────────────────────────────────────────────────────
function MilestoneNode({ m, index, tasks, isSelected, onClick, onAddTask }: {
  m: any; index: number; tasks: any[];
  isSelected: boolean; onClick: () => void;
  onAddTask: (id: number) => void;
}) {
  const col = MS_COLORS[m.status as MilestoneStatus] ?? MS_COLORS.planted;
  const mTasks = tasks.filter(t => t.milestoneId === m.id);
  const done = mTasks.filter(t => t.status === "next_plan").length;
  const pct = mTasks.length > 0 ? Math.round((done / mTasks.length) * 100) : 0;

  return (
    <div className="flex flex-col items-center cursor-pointer group" onClick={onClick}>
      <div className="flex items-center gap-4 w-full">
        {/* Left: stars + date */}
        <div className="flex-1 text-right min-w-0">
          <div className="flex items-center justify-end gap-0.5 mb-0.5">
            {[1,2,3,4,5].map(i => (
              <Star key={i} size={9} className={i <= m.starsValue ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/20"} />
            ))}
          </div>
          {m.targetDate && <p className="text-[10px] text-muted-foreground">{m.targetDate}</p>}
        </div>

        {/* Node */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full blur-md opacity-50 group-hover:opacity-80 transition-opacity"
            style={{ background: col.stroke, transform: "scale(1.4)" }} />
          <svg width="56" height="56" className="relative z-10" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="28" cy="28" r="24" fill={isSelected ? col.fill : "#0f172a"}
              stroke={isSelected ? col.stroke : col.stroke + "80"} strokeWidth={isSelected ? 2.5 : 1.5} />
            {pct > 0 && (
              <circle cx="28" cy="28" r="24" fill="none" stroke={col.stroke} strokeWidth="3"
                strokeDasharray={`${(pct/100)*2*Math.PI*24} ${2*Math.PI*24}`} strokeLinecap="round" />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Flag size={15} style={{ color: col.stroke }} />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border z-20"
            style={{ color: col.stroke, borderColor: col.stroke + "50", background: "#0f172a" }}>
            {String(index + 1).padStart(2, "0")}
          </div>
        </div>

        {/* Right: title + status */}
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-bold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors" title={m.title}>
            {m.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
              style={{ color: col.stroke, borderColor: col.stroke + "40" }}>{col.label}</span>
            {mTasks.length > 0 && <span className="text-[10px] text-muted-foreground">{done}/{mTasks.length}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Roadmap ──────────────────────────────────────────────────────────────
export default function Roadmap() {
  const [, params] = useRoute("/game/:gameId/roadmap");
  const [, altParams] = useRoute("/game/:gameId");
  const gameId = Number(params?.gameId ?? altParams?.gameId);
  const queryClient = useQueryClient();

  const { data: milestones = [] } = useListMilestones(gameId, { query: { enabled: !!gameId, queryKey: getListMilestonesQueryKey(gameId) } });
  const { data: tasks = [] }      = useListTasks(gameId,      { query: { enabled: !!gameId, queryKey: getListTasksQueryKey(gameId) } });
  const { data: kpis = [] }       = useListKpis(gameId,       { query: { enabled: !!gameId, queryKey: getListKpisQueryKey(gameId) } });
  const { data: players = [] }    = useListPlayers(gameId,    { query: { enabled: !!gameId } });

  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const createTask      = useCreateTask();
  const updateTask      = useUpdateTask();
  const createKpi       = useCreateKpi();

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null);
  const [newMilestoneOpen,    setNewMilestoneOpen]    = useState(false);
  const [newTaskContext,      setNewTaskContext]       = useState<{ milestoneId: number; status: TaskStatus } | null>(null);
  const [newKpiMilestoneId,   setNewKpiMilestoneId]   = useState<number | null>(null);

  const [mForm, setMForm]     = useState({ title: "", description: "", starsValue: "3", targetDate: "" });
  const [tForm, setTForm]     = useState({ title: "", description: "", priority: "medium", kpiImpact: "none", assignedPlayerId: "none" });
  const [kpiForm, setKpiForm] = useState({ name: "", unit: "units", target: "100", description: "" });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey(gameId) });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(gameId) });
    queryClient.invalidateQueries({ queryKey: getListKpisQueryKey(gameId) });
  };

  const handleCreateMilestone = () => {
    if (!mForm.title.trim()) return;
    createMilestone.mutate(
      { gameId, data: { title: mForm.title, description: mForm.description, starsValue: Number(mForm.starsValue), targetDate: mForm.targetDate || undefined } },
      { onSuccess: () => { setNewMilestoneOpen(false); setMForm({ title: "", description: "", starsValue: "3", targetDate: "" }); invalidate(); } }
    );
  };

  const handleCreateTask = () => {
    if (!tForm.title.trim() || !newTaskContext) return;
    createTask.mutate(
      { gameId, data: {
        title: tForm.title, description: tForm.description,
        priority: tForm.priority as Priority,
        status: newTaskContext.status,
        milestoneId: newTaskContext.milestoneId,
        kpiImpact: tForm.kpiImpact !== "none" ? tForm.kpiImpact : undefined,
        assignedPlayerId: tForm.assignedPlayerId !== "none" ? Number(tForm.assignedPlayerId) : undefined,
      }},
      { onSuccess: () => { setNewTaskContext(null); setTForm({ title: "", description: "", priority: "medium", kpiImpact: "none", assignedPlayerId: "none" }); invalidate(); } }
    );
  };

  const handleCreateKpi = () => {
    if (!kpiForm.name.trim() || newKpiMilestoneId === null) return;
    createKpi.mutate(
      { gameId, data: { name: kpiForm.name, description: kpiForm.description, unit: kpiForm.unit, target: Number(kpiForm.target), milestoneId: newKpiMilestoneId } },
      { onSuccess: () => { setNewKpiMilestoneId(null); setKpiForm({ name: "", unit: "units", target: "100", description: "" }); invalidate(); } }
    );
  };

  const handleMilestoneSave = (milestoneId: number, data: any) => {
    updateMilestone.mutate({ gameId, milestoneId, data }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey(gameId) }) });
  };

  const handleStatusChange = (taskId: number, status: TaskStatus) => {
    updateTask.mutate({ gameId, taskId, data: { status } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(gameId) }) });
  };

  const handleAssignChange = (taskId: number, playerId: number | null) => {
    updateTask.mutate({ gameId, taskId, data: { assignedPlayerId: playerId } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(gameId) }) });
  };

  const unlinkedTasks = tasks.filter(t => !t.milestoneId);

  return (
    <GameLayout>
      <div className="h-[calc(100vh-3.5rem)] overflow-auto"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #0d1b2a 0%, #060d14 60%, #030508 100%)" }}>
        {/* Stars */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width: Math.random()*2+1+"px", height: Math.random()*2+1+"px",
                top: Math.random()*100+"%", left: Math.random()*100+"%", opacity: Math.random()*0.4+0.05 }} />
          ))}
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-2xl font-serif text-amber-400 font-bold tracking-wide">Roadmap</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{milestones.length} milestones · {tasks.length} tasks</p>
            </div>
            <Button size="sm" onClick={() => setNewMilestoneOpen(true)} className="gap-1.5">
              <Plus size={14} /> Milestone
            </Button>
          </div>

          {milestones.length === 0 ? (
            <div className="flex flex-col items-center py-32 text-muted-foreground">
              <Flag size={36} className="mb-4 text-primary/20" />
              <p className="text-lg">No milestones yet.</p>
              <Button className="mt-6 gap-2" onClick={() => setNewMilestoneOpen(true)}><Plus size={14} /> Plant First Milestone</Button>
            </div>
          ) : (
            <div className="flex flex-col">
              {milestones.map((m, i) => (
                <div key={m.id}>
                  <MilestoneNode
                    m={m} index={i} tasks={tasks}
                    isSelected={selectedMilestoneId === m.id}
                    onClick={() => setSelectedMilestoneId(selectedMilestoneId === m.id ? null : m.id)}
                    onAddTask={id => setNewTaskContext({ milestoneId: id, status: "plan" })}
                  />

                  {/* Edit panel */}
                  {selectedMilestoneId === m.id && (
                    <MilestoneEditPanel
                      m={m} tasks={tasks} kpis={kpis}
                      onSave={handleMilestoneSave}
                      onCreateKpi={id => { setNewKpiMilestoneId(id); }}
                      onAddTask={id => setNewTaskContext({ milestoneId: id, status: "plan" })}
                    />
                  )}

                  {/* Between-milestone kanban */}
                  <BetweenKanban
                    milestoneId={m.id} tasks={tasks} players={players} kpis={kpis}
                    msStatus={m.status as MilestoneStatus} msTitle={m.title}
                    onStatusChange={handleStatusChange}
                    onAssignChange={handleAssignChange}
                    onAddTask={(mid, status) => setNewTaskContext({ milestoneId: mid, status })}
                  />

                  {i < milestones.length - 1 && (
                    <div className="flex justify-center -my-1">
                      <div className="flex flex-col items-center gap-0.5">
                        {[0,1,2].map(j => <div key={j} className="w-1 h-1 rounded-full bg-primary/20" />)}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Unlinked tasks */}
              {unlinkedTasks.length > 0 && (
                <div className="mt-8 border border-border/40 rounded-xl bg-card/40 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-3">Backlog — Unassigned</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {unlinkedTasks.map(t => {
                      const tc = TASK_COLS.find(c => c.id === t.status) ?? TASK_COLS[0];
                      return (
                        <TaskCard key={t.id} task={t} players={players} colRing={tc.ring} colDot={tc.dot}
                          onStatusChange={handleStatusChange} onAssignChange={handleAssignChange} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── New Milestone Dialog ── */}
      <Dialog open={newMilestoneOpen} onOpenChange={setNewMilestoneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Plant a Milestone</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label>
              <Input value={mForm.title} onChange={e => setMForm(f => ({ ...f, title: e.target.value }))} placeholder="What landmark will you reach?" />
            </div>
            <div><Label>Description</Label>
              <Textarea value={mForm.description} onChange={e => setMForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Stars Value</Label>
                <Select value={mForm.starsValue} onValueChange={v => setMForm(f => ({ ...f, starsValue: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Target Date</Label>
                <Input type="date" value={mForm.targetDate} onChange={e => setMForm(f => ({ ...f, targetDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewMilestoneOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateMilestone} disabled={createMilestone.isPending}>Plant Milestone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Task Dialog ── */}
      <Dialog open={newTaskContext !== null} onOpenChange={open => !open && setNewTaskContext(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Task</DialogTitle>
            {newTaskContext && (
              <p className="text-xs text-muted-foreground mt-1">
                {milestones.find(m => m.id === newTaskContext.milestoneId)?.title} → {TASK_COLS.find(c => c.id === newTaskContext.status)?.label}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label>
              <Input value={tForm.title} onChange={e => setTForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" autoFocus />
            </div>
            <div><Label>Description</Label>
              <Textarea value={tForm.description} onChange={e => setTForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Priority</Label>
                <Select value={tForm.priority} onValueChange={v => setTForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Stakeholder</Label>
                <Select value={tForm.assignedPlayerId} onValueChange={v => setTForm(f => ({ ...f, assignedPlayerId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {players.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <span className="flex items-center gap-2">
                          <Avatar name={p.name} color={p.avatarColor} size={14} />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {kpis.length > 0 && (
              <div><Label>KPI Impact</Label>
                <Select value={tForm.kpiImpact} onValueChange={v => setTForm(f => ({ ...f, kpiImpact: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {kpis.map(k => <SelectItem key={k.id} value={k.name}>{k.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskContext(null)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={createTask.isPending}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New KPI for Milestone Dialog ── */}
      <Dialog open={newKpiMilestoneId !== null} onOpenChange={open => !open && setNewKpiMilestoneId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add KPI to Milestone</DialogTitle>
            {newKpiMilestoneId && (
              <p className="text-xs text-muted-foreground mt-1">
                {milestones.find(m => m.id === newKpiMilestoneId)?.title}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>KPI Name</Label>
              <Input value={kpiForm.name} onChange={e => setKpiForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Monthly Active Users" autoFocus />
            </div>
            <div><Label>Description</Label>
              <Textarea value={kpiForm.description} onChange={e => setKpiForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unit</Label>
                <Input value={kpiForm.unit} onChange={e => setKpiForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="users, $, %" />
              </div>
              <div><Label>Target</Label>
                <Input type="number" value={kpiForm.target} onChange={e => setKpiForm(f => ({ ...f, target: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewKpiMilestoneId(null)}>Cancel</Button>
            <Button onClick={handleCreateKpi} disabled={createKpi.isPending}>Create KPI</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GameLayout>
  );
}
