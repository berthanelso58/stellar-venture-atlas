import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListMilestones, useListTasks, useListKpis, useListPlayers,
  useCreateMilestone, useUpdateMilestone,
  useCreateTask, useUpdateTask,
  getListMilestonesQueryKey, getListTasksQueryKey, getListKpisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Star, Flag, Zap } from "lucide-react";
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
  { id: "plan",      label: "Plan",      dot: "#475569", ring: "#64748b" },
  { id: "doing",     label: "Doing",     dot: "#d97706", ring: "#fbbf24" },
  { id: "check",     label: "Check",     dot: "#2563eb", ring: "#60a5fa" },
  { id: "next_plan", label: "Done",      dot: "#16a34a", ring: "#4ade80" },
];

const PRIORITY_BADGE: Record<Priority, string> = {
  low:      "text-blue-400 border-blue-400/30 bg-blue-400/10",
  medium:   "text-amber-400 border-amber-400/30 bg-amber-400/10",
  high:     "text-orange-400 border-orange-400/30 bg-orange-400/10",
  critical: "text-red-500 border-red-500/40 bg-red-500/10",
};

// ── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 22 }: { name: string; color?: string | null; size?: number }) {
  return (
    <div
      title={name}
      style={{ width: size, height: size, backgroundColor: color ?? "#475569", fontSize: size * 0.45 }}
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 ring-1 ring-white/20"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Dash to the Finish Line ──────────────────────────────────────────────────
function DashToFinish({ kpis, milestoneId, msStatus }: { kpis: any[]; milestoneId: number; msStatus: MilestoneStatus }) {
  const linked = kpis.filter(k => k.milestoneId === milestoneId);
  if (linked.length === 0) return null;
  const col = MS_COLORS[msStatus];

  return (
    <div
      className="rounded-xl border px-4 py-3 mt-3 flex flex-col gap-2"
      style={{ borderColor: col.stroke + "40", background: col.bg, boxShadow: `0 0 18px 2px ${col.stroke}22` }}
    >
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
            <div className="h-2 rounded-full bg-white/5 overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${col.stroke}99, ${col.stroke})`,
                  boxShadow: `0 0 8px 1px ${col.stroke}88`,
                }}
              />
            </div>
            <p className="text-[10px] text-right mt-0.5" style={{ color: col.stroke + "aa" }}>{pct}%</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({
  task, players, colRing, colDot, onStatusChange, onAssignChange,
}: {
  task: any; players: any[]; colRing: string; colDot: string;
  onStatusChange: (id: number, s: TaskStatus) => void;
  onAssignChange: (id: number, playerId: number | null) => void;
}) {
  const assignee = players.find(p => p.id === task.assignedPlayerId);

  return (
    <div
      className="bg-background/60 border rounded-lg px-3 py-2.5 flex flex-col gap-1.5 hover:border-primary/40 transition-colors group"
      style={{ borderColor: colRing + "40" }}
    >
      {/* Title + priority */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs text-foreground leading-snug font-medium">{task.title}</span>
        {task.priority && (
          <span className={`text-[9px] px-1 py-0.5 rounded border uppercase font-bold shrink-0 ${PRIORITY_BADGE[task.priority as Priority] ?? ""}`}>
            {task.priority}
          </span>
        )}
      </div>
      {/* KPI impact pulse (check column) */}
      {task.status === "check" && task.kpiImpact && (
        <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
          {task.kpiImpact}
        </div>
      )}
      {/* Footer: avatar + status dropdown */}
      <div className="flex items-center justify-between mt-0.5">
        {/* Avatar picker */}
        <div className="relative group/avatar">
          {assignee ? (
            <Avatar name={assignee.name} color={assignee.avatarColor} size={20} />
          ) : (
            <div className="w-5 h-5 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground/40">
              <Plus size={8} />
            </div>
          )}
          {/* Hover player picker */}
          <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/avatar:flex flex-col bg-popover border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
            <button
              className="text-[10px] px-2 py-1.5 text-left hover:bg-muted transition-colors text-muted-foreground"
              onClick={() => onAssignChange(task.id, null)}
            >
              Unassign
            </button>
            {players.map(p => (
              <button
                key={p.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted transition-colors"
                onClick={() => onAssignChange(task.id, p.id)}
              >
                <Avatar name={p.name} color={p.avatarColor} size={16} />
                <span className="text-[10px] text-foreground truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Status select — hidden until hover */}
        <select
          value={task.status}
          onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="text-[10px] bg-transparent border-none text-muted-foreground focus:ring-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {TASK_COLS.map(c => <option key={c.id} value={c.id} className="bg-background">{c.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── Between-milestone Kanban ──────────────────────────────────────────────────
function BetweenKanban({
  milestoneId, tasks, players, kpis, msStatus, msTitle,
  onStatusChange, onAssignChange, onAddTask,
}: {
  milestoneId: number; tasks: any[]; players: any[];
  kpis: any[]; msStatus: MilestoneStatus; msTitle: string;
  onStatusChange: (id: number, s: TaskStatus) => void;
  onAssignChange: (id: number, pid: number | null) => void;
  onAddTask: (milestoneId: number, status: TaskStatus) => void;
}) {
  const msTasks = tasks.filter(t => t.milestoneId === milestoneId);
  const col = MS_COLORS[msStatus];

  if (msTasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-4">
        <div className="h-12 w-px" style={{ background: `linear-gradient(to bottom, ${col.stroke}60, ${col.stroke}20)` }} />
        <button
          onClick={() => onAddTask(milestoneId, "plan")}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 py-2"
        >
          <Plus size={10} /> Add first task
        </button>
        <div className="h-12 w-px" style={{ background: `linear-gradient(to bottom, ${col.stroke}20, transparent)` }} />
      </div>
    );
  }

  return (
    <div className="py-3">
      {/* Connector line top */}
      <div className="flex justify-center mb-3">
        <div className="h-8 w-px" style={{ background: `linear-gradient(to bottom, ${col.stroke}60, ${col.stroke}20)` }} />
      </div>

      {/* Kanban label */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-2">
          {msTitle} — Tasks
        </span>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      {/* 4-column kanban */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: col.stroke + "25", background: "rgba(15,23,42,0.7)" }}
      >
        <div className="grid grid-cols-4 divide-x" style={{ borderColor: col.stroke + "20" }}>
          {TASK_COLS.map(tc => {
            const colTasks = msTasks.filter(t => t.status === tc.id);
            return (
              <div key={tc.id} className="flex flex-col min-h-[80px]">
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tc.dot }} />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                      {tc.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">{colTasks.length}</span>
                </div>
                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 flex-1">
                  {colTasks.map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      players={players}
                      colRing={tc.ring}
                      colDot={tc.dot}
                      onStatusChange={onStatusChange}
                      onAssignChange={onAssignChange}
                    />
                  ))}
                  <button
                    onClick={() => onAddTask(milestoneId, tc.id)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors py-1 px-1 rounded"
                  >
                    <Plus size={9} /> Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dash to Finish Line KPIs */}
      <DashToFinish kpis={kpis} milestoneId={milestoneId} msStatus={msStatus} />

      {/* Connector line bottom */}
      <div className="flex justify-center mt-3">
        <div className="h-8 w-px" style={{ background: `linear-gradient(to bottom, ${col.stroke}20, transparent)` }} />
      </div>
    </div>
  );
}

// ── Milestone Node ────────────────────────────────────────────────────────────
function MilestoneNode({
  m, index, tasks, isSelected, onClick, onAddTask,
}: {
  m: any; index: number; tasks: any[];
  isSelected: boolean; onClick: () => void;
  onAddTask: (id: number) => void;
}) {
  const col = MS_COLORS[m.status as MilestoneStatus] ?? MS_COLORS.planted;
  const mTasks = tasks.filter(t => t.milestoneId === m.id);
  const done = mTasks.filter(t => t.status === "next_plan").length;
  const pct = mTasks.length > 0 ? Math.round((done / mTasks.length) * 100) : 0;

  return (
    <div
      className="flex flex-col items-center cursor-pointer group"
      onClick={onClick}
    >
      {/* Node + label row */}
      <div className="flex items-center gap-4 w-full">
        {/* Left side info */}
        <div className="flex-1 text-right min-w-0">
          <div className="flex items-center justify-end gap-1 mb-0.5">
            {[1,2,3,4,5].map(i => (
              <Star key={i} size={9} className={i <= m.starsValue ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/20"} />
            ))}
          </div>
          {m.targetDate && <p className="text-[10px] text-muted-foreground">{m.targetDate}</p>}
        </div>

        {/* Central node */}
        <div className="relative shrink-0">
          {/* Glow */}
          <div
            className="absolute inset-0 rounded-full blur-md opacity-60 group-hover:opacity-90 transition-opacity"
            style={{ background: col.stroke, transform: "scale(1.5)" }}
          />
          {/* Outer ring (progress) */}
          <svg width="56" height="56" className="relative z-10" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="28" cy="28" r="24" fill={col.fill} stroke={col.stroke + "40"} strokeWidth="2" />
            {pct > 0 && (
              <circle cx="28" cy="28" r="24" fill="none" stroke={col.stroke} strokeWidth="3"
                strokeDasharray={`${(pct / 100) * 2 * Math.PI * 24} ${2 * Math.PI * 24}`}
                strokeLinecap="round" />
            )}
          </svg>
          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Flag size={16} style={{ color: col.stroke }} />
          </div>
          {/* Step badge */}
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
            style={{ color: col.stroke, borderColor: col.stroke + "50", background: "#0f172a", zIndex: 20 }}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
        </div>

        {/* Right side: title + status */}
        <div className="flex-1 min-w-0">
          <h3
            className="font-serif font-bold text-sm leading-tight text-foreground group-hover:underline truncate"
            title={m.title}
          >
            {m.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
              style={{ color: col.stroke, borderColor: col.stroke + "40" }}
            >
              {col.label}
            </span>
            {mTasks.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{done}/{mTasks.length} tasks</span>
            )}
          </div>
        </div>
      </div>

      {/* Add task mini-button */}
      <button
        onClick={e => { e.stopPropagation(); onAddTask(m.id); }}
        className="mt-2 text-[10px] text-muted-foreground/50 hover:text-primary transition-colors flex items-center gap-1"
      >
        <Plus size={9} /> Add task
      </button>
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
  const { data: tasks = [] } = useListTasks(gameId, { query: { enabled: !!gameId, queryKey: getListTasksQueryKey(gameId) } });
  const { data: kpis = [] } = useListKpis(gameId, { query: { enabled: !!gameId, queryKey: getListKpisQueryKey(gameId) } });
  const { data: players = [] } = useListPlayers(gameId, { query: { enabled: !!gameId } });

  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null);
  const [newMilestoneOpen, setNewMilestoneOpen] = useState(false);
  const [newTaskContext, setNewTaskContext] = useState<{ milestoneId: number; status: TaskStatus } | null>(null);

  const [mForm, setMForm] = useState({ title: "", description: "", starsValue: "3", targetDate: "" });
  const [tForm, setTForm] = useState({ title: "", description: "", priority: "medium", kpiImpact: "none", assignedPlayerId: "none" });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey(gameId) });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(gameId) });
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
        kpiImpact: (tForm.kpiImpact && tForm.kpiImpact !== "none") ? tForm.kpiImpact : undefined,
        assignedPlayerId: (tForm.assignedPlayerId && tForm.assignedPlayerId !== "none") ? Number(tForm.assignedPlayerId) : undefined,
      }},
      { onSuccess: () => { setNewTaskContext(null); setTForm({ title: "", description: "", priority: "medium", kpiImpact: "none", assignedPlayerId: "none" }); invalidate(); } }
    );
  };

  const handleStatusChange = (taskId: number, status: TaskStatus) => {
    updateTask.mutate({ gameId, taskId, data: { status } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(gameId) }) });
  };

  const handleAssignChange = (taskId: number, playerId: number | null) => {
    updateTask.mutate({ gameId, taskId, data: { assignedPlayerId: playerId } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(gameId) }) });
  };

  const handleMilestoneStatusChange = (milestoneId: number, status: MilestoneStatus) => {
    updateMilestone.mutate({ gameId, milestoneId, data: { status } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey(gameId) }) });
  };

  const unlinkedTasks = tasks.filter(t => !t.milestoneId);
  const selectedMilestone = milestones.find(m => m.id === selectedMilestoneId);

  return (
    <GameLayout>
      <div
        className="h-[calc(100vh-3.5rem)] overflow-auto"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #0d1b2a 0%, #060d14 60%, #030508 100%)" }}
      >
        {/* Stars */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width: Math.random() * 2 + 1 + "px", height: Math.random() * 2 + 1 + "px",
                top: Math.random() * 100 + "%", left: Math.random() * 100 + "%",
                opacity: Math.random() * 0.4 + 0.05 }} />
          ))}
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-2xl font-serif text-amber-400 font-bold tracking-wide">Roadmap</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {milestones.length} milestones · {tasks.length} tasks
              </p>
            </div>
            <Button size="sm" onClick={() => setNewMilestoneOpen(true)} className="gap-1.5">
              <Plus size={14} /> Milestone
            </Button>
          </div>

          {milestones.length === 0 ? (
            <div className="flex flex-col items-center py-32 text-muted-foreground">
              <Flag size={36} className="mb-4 text-primary/20" />
              <p className="text-lg">No milestones yet.</p>
              <p className="text-sm mt-1">Plant your first milestone to begin the journey.</p>
              <Button className="mt-6 gap-2" onClick={() => setNewMilestoneOpen(true)}><Plus size={14} /> Plant First Milestone</Button>
            </div>
          ) : (
            <div className="flex flex-col">
              {milestones.map((m, i) => (
                <div key={m.id}>
                  {/* Milestone node */}
                  <MilestoneNode
                    m={m}
                    index={i}
                    tasks={tasks}
                    isSelected={selectedMilestoneId === m.id}
                    onClick={() => setSelectedMilestoneId(selectedMilestoneId === m.id ? null : m.id)}
                    onAddTask={id => setNewTaskContext({ milestoneId: id, status: "plan" })}
                  />

                  {/* Expanded milestone details */}
                  {selectedMilestoneId === m.id && (
                    <div className="mt-3 mb-2 ml-16 mr-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur p-4 flex flex-col gap-3">
                      {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                      <div className="flex items-center gap-3">
                        <Label className="text-xs text-muted-foreground shrink-0">Status</Label>
                        <Select value={m.status} onValueChange={v => handleMilestoneStatusChange(m.id, v as MilestoneStatus)}>
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(["planted","growing","blooming","harvested"] as MilestoneStatus[]).map(s => (
                              <SelectItem key={s} value={s}>{MS_COLORS[s].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Between-milestone Kanban + KPI Dash */}
                  <BetweenKanban
                    milestoneId={m.id}
                    tasks={tasks}
                    players={players}
                    kpis={kpis}
                    msStatus={m.status as MilestoneStatus}
                    msTitle={m.title}
                    onStatusChange={handleStatusChange}
                    onAssignChange={handleAssignChange}
                    onAddTask={(mid, status) => setNewTaskContext({ milestoneId: mid, status })}
                  />

                  {/* Connector to next milestone */}
                  {i < milestones.length - 1 && (
                    <div className="flex justify-center -my-1">
                      <div className="flex flex-col items-center gap-0.5">
                        {[0,1,2].map(j => (
                          <div key={j} className="w-1 h-1 rounded-full bg-primary/30" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Unlinked tasks */}
              {unlinkedTasks.length > 0 && (
                <div className="mt-8 border border-border/40 rounded-xl bg-card/40 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-3">Backlog — Unassigned to milestone</p>
                  <div className="grid grid-cols-4 gap-2">
                    {unlinkedTasks.map(t => {
                      const tc = TASK_COLS.find(c => c.id === t.status) ?? TASK_COLS[0];
                      return (
                        <TaskCard
                          key={t.id}
                          task={t}
                          players={players}
                          colRing={tc.ring}
                          colDot={tc.dot}
                          onStatusChange={handleStatusChange}
                          onAssignChange={handleAssignChange}
                        />
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
              <Input value={tForm.title} onChange={e => setTForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" />
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
    </GameLayout>
  );
}
