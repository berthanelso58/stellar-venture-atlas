import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListMilestones, useListTasks, useListKpis,
  useCreateMilestone, useUpdateMilestone,
  useCreateTask, useUpdateTask,
  getListMilestonesQueryKey, getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Star, X, ChevronRight } from "lucide-react";
import GameLayout from "./layout";

type MilestoneStatus = "planted" | "growing" | "blooming" | "harvested";
type TaskStatus = "plan" | "doing" | "check" | "next_plan";
type Priority = "low" | "medium" | "high" | "critical";

const MILESTONE_COLORS: Record<MilestoneStatus, { fill: string; stroke: string; glow: string; label: string }> = {
  planted:  { fill: "#1e293b", stroke: "#64748b", glow: "#64748b40", label: "Planted" },
  growing:  { fill: "#052e16", stroke: "#4ade80", glow: "#4ade8040", label: "Growing" },
  blooming: { fill: "#451a03", stroke: "#fb923c", glow: "#fb923c50", label: "Blooming" },
  harvested:{ fill: "#2e1065", stroke: "#a78bfa", glow: "#a78bfa50", label: "Harvested" },
};

const TASK_COLORS: Record<TaskStatus, { dot: string; ring: string; label: string }> = {
  plan:      { dot: "#475569", ring: "#64748b", label: "Plan" },
  doing:     { dot: "#d97706", ring: "#fbbf24", label: "Doing" },
  check:     { dot: "#2563eb", ring: "#60a5fa", label: "Check" },
  next_plan: { dot: "#16a34a", ring: "#4ade80", label: "Done" },
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#60a5fa", medium: "#fbbf24", high: "#f97316", critical: "#ef4444",
};

function StarRating({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={10} className={i <= value ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground/30"} />
      ))}
    </span>
  );
}

export default function Roadmap() {
  const [, params] = useRoute("/game/:gameId/roadmap");
  const gameId = Number(params?.gameId);
  const queryClient = useQueryClient();

  const { data: milestones = [] } = useListMilestones(gameId, { query: { enabled: !!gameId, queryKey: getListMilestonesQueryKey(gameId) } });
  const { data: tasks = [] } = useListTasks(gameId, { query: { enabled: !!gameId, queryKey: getListTasksQueryKey(gameId) } });
  const { data: kpis = [] } = useListKpis(gameId, { query: { enabled: !!gameId } });

  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [selected, setSelected] = useState<{ type: "milestone" | "task"; id: number } | null>(null);
  const [newMilestoneOpen, setNewMilestoneOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState<number | null>(null); // milestoneId

  const [mForm, setMForm] = useState({ title: "", description: "", starsValue: "3", targetDate: "" });
  const [tForm, setTForm] = useState({ title: "", description: "", priority: "medium", kpiImpact: "" });

  const invalidateMilestones = () => queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey(gameId) });
  const invalidateTasks = () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(gameId) });

  const handleCreateMilestone = () => {
    if (!mForm.title.trim()) return;
    createMilestone.mutate({ gameId, data: { title: mForm.title, description: mForm.description, starsValue: Number(mForm.starsValue), targetDate: mForm.targetDate || undefined } },
      { onSuccess: () => { setNewMilestoneOpen(false); setMForm({ title: "", description: "", starsValue: "3", targetDate: "" }); invalidateMilestones(); } });
  };

  const handleCreateTask = () => {
    if (!tForm.title.trim()) return;
    createTask.mutate({ gameId, data: { title: tForm.title, description: tForm.description, priority: tForm.priority as Priority, milestoneId: newTaskOpen ?? undefined, kpiImpact: tForm.kpiImpact || undefined } },
      { onSuccess: () => { setNewTaskOpen(null); setTForm({ title: "", description: "", priority: "medium", kpiImpact: "" }); invalidateTasks(); } });
  };

  const handleStatusChange = (milestoneId: number, status: MilestoneStatus) => {
    updateMilestone.mutate({ gameId, milestoneId, data: { status } }, { onSuccess: invalidateMilestones });
  };

  const handleTaskStatusChange = (taskId: number, status: TaskStatus) => {
    updateTask.mutate({ gameId, taskId, data: { status } }, { onSuccess: invalidateTasks });
  };

  // Layout constants — designed for a wide canvas that fills the screen
  const SVG_W = 700;
  const NODE_R = 30;
  const TASK_R = 9;
  const M_TOP = 70;
  const M_STEP = 230;
  const LEFT_X = 160;
  const RIGHT_X = SVG_W - 160;
  const _CENTER_X = SVG_W / 2; void _CENTER_X;

  const totalMilestones = milestones.length;

  // Arrange milestones: alternating left/right in a true serpentine
  type MilestoneNode = { x: number; y: number; col: "left" | "right"; m: typeof milestones[0] };
  const milestoneNodes: MilestoneNode[] = milestones.map((m, i) => {
    const col = i % 2 === 0 ? "left" : "right";
    const x = col === "left" ? LEFT_X : RIGHT_X;
    const y = M_TOP + i * M_STEP;
    return { x, y, col, m };
  });

  // Tasks: fan out to the outer side of each milestone
  type TaskNode = { x: number; y: number; t: typeof tasks[0] };
  const taskNodes: TaskNode[] = milestoneNodes.flatMap(({ x, y, col, m }) => {
    const mTasks = tasks.filter(t => t.milestoneId === m.id);
    return mTasks.map((t, ti) => {
      // Outer direction: left col fans left, right col fans right
      const dir = col === "left" ? -1 : 1;
      const spread = ti - (mTasks.length - 1) / 2;
      const tx = x + dir * (NODE_R + 48 + Math.abs(spread) * 12);
      const ty = y + spread * 38;
      return { x: tx, y: ty, t };
    });
  });

  // Unlinked tasks (no milestone)
  const unlinkedTasks = tasks.filter(t => !t.milestoneId);

  const svgH = totalMilestones === 0
    ? 400
    : M_TOP + (totalMilestones - 1) * M_STEP + NODE_R + 100;

  // Winding spine: curves through center between alternating milestones
  const spinePath = milestoneNodes.length < 2
    ? ""
    : milestoneNodes.map((n, i) => {
        if (i === 0) return `M ${n.x} ${n.y}`;
        const prev = milestoneNodes[i - 1];
        const midY = (prev.y + n.y) / 2;
        // Bezier curves through center for a natural river-like wind
        return `C ${prev.x} ${midY}, ${n.x} ${midY}, ${n.x} ${n.y}`;
      }).join(" ");

  const selectedMilestone = selected?.type === "milestone" ? milestones.find(m => m.id === selected.id) : null;
  const selectedTask = selected?.type === "task" ? tasks.find(t => t.id === selected.id) : null;

  return (
    <GameLayout>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

        {/* Scrollable roadmap canvas */}
        <div className="flex-1 overflow-auto relative" style={{ background: "radial-gradient(ellipse at 50% 0%, #0d1b2a 0%, #060d14 60%, #030508 100%)" }}>
          {/* Ambient stars */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white"
                style={{ width: Math.random() * 2 + 1 + "px", height: Math.random() * 2 + 1 + "px", top: Math.random() * 50 + "%", left: Math.random() * 100 + "%", opacity: Math.random() * 0.4 + 0.05 }} />
            ))}
          </div>

          <div className="relative p-6 flex flex-col items-center">
            {/* Header */}
            <div className="flex w-full max-w-2xl items-center justify-between mb-4 z-10">
              <div>
                <h1 className="text-xl font-serif text-amber-400 font-bold tracking-wide">Roadmap</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Milestones and tasks on the journey</p>
              </div>
              <Button size="sm" onClick={() => setNewMilestoneOpen(true)} className="gap-1.5 text-xs">
                <Plus size={13} /> Milestone
              </Button>
            </div>

            {/* SVG Roadmap */}
            <svg
              width={SVG_W}
              height={svgH}
              viewBox={`0 0 ${SVG_W} ${svgH}`}
              className="w-full"
              style={{ maxWidth: "700px" }}
            >
              <defs>
                <filter id="glow-amber">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-strong">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {milestoneNodes.map(({ m }) => (
                  <radialGradient key={m.id} id={`mg-${m.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={MILESTONE_COLORS[m.status as MilestoneStatus]?.stroke ?? "#64748b"} stopOpacity="0.25" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                  </radialGradient>
                ))}
              </defs>

              {/* Spine path — glowing trail */}
              {spinePath && (
                <>
                  <path d={spinePath} fill="none" stroke="#1e3a5f" strokeWidth="3" strokeDasharray="8 6" />
                  <path d={spinePath} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity="0.3" />
                </>
              )}

              {/* Task connector lines */}
              {milestoneNodes.map(({ x, y, m }) => {
                const mTasks = tasks.filter(t => t.milestoneId === m.id);
                return mTasks.map((t, ti) => {
                  const tn = taskNodes.find(tn => tn.t.id === t.id);
                  if (!tn) return null;
                  return (
                    <line key={`conn-${t.id}`}
                      x1={x} y1={y} x2={tn.x} y2={tn.y}
                      stroke="#334155" strokeWidth="1.5" strokeDasharray="4 4" />
                  );
                });
              })}

              {/* Milestone glow halos */}
              {milestoneNodes.map(({ x, y, m }) => (
                <circle key={`halo-${m.id}`} cx={x} cy={y} r={NODE_R + 20}
                  fill={`url(#mg-${m.id})`} />
              ))}

              {/* Milestone nodes */}
              {milestoneNodes.map(({ x, y, col, m }, i) => {
                const colors = MILESTONE_COLORS[m.status as MilestoneStatus] ?? MILESTONE_COLORS.planted;
                const mTasks = tasks.filter(t => t.milestoneId === m.id);
                const doneTasks = mTasks.filter(t => t.status === "next_plan").length;
                const pct = mTasks.length > 0 ? doneTasks / mTasks.length : 0;
                const arc = 2 * Math.PI * (NODE_R - 5) * pct;
                const arcTotal = 2 * Math.PI * (NODE_R - 5);
                const isSelected = selected?.type === "milestone" && selected.id === m.id;

                return (
                  <g key={m.id} onClick={() => setSelected(isSelected ? null : { type: "milestone", id: m.id })} style={{ cursor: "pointer" }}>
                    {/* Progress ring */}
                    <circle cx={x} cy={y} r={NODE_R - 5} fill="none" stroke="#1e293b" strokeWidth="4" />
                    {pct > 0 && (
                      <circle cx={x} cy={y} r={NODE_R - 5} fill="none"
                        stroke={colors.stroke} strokeWidth="4"
                        strokeDasharray={`${arc} ${arcTotal - arc}`}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${x} ${y})`} />
                    )}
                    {/* Main node */}
                    <circle cx={x} cy={y} r={NODE_R}
                      fill={colors.fill}
                      stroke={isSelected ? "#fbbf24" : colors.stroke}
                      strokeWidth={isSelected ? 3 : 2} />
                    {/* Star icon */}
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize="16" fill={colors.stroke}>✦</text>
                    {/* Step number */}
                    <text x={x} y={y + NODE_R + 14} textAnchor="middle"
                      fontSize="10" fill="#64748b" fontFamily="serif">
                      {String(i + 1).padStart(2, "0")}
                    </text>
                    {/* Title */}
                    {(() => {
                      const words = m.title.split(" ");
                      const lines: string[] = [];
                      let cur = "";
                      for (const w of words) {
                        if ((cur + " " + w).trim().length > 14) { lines.push(cur.trim()); cur = w; }
                        else cur = (cur + " " + w).trim();
                      }
                      if (cur) lines.push(cur.trim());
                      const labelX = col === "left" ? x - NODE_R - 12 : x + NODE_R + 12;
                      const anchor = col === "left" ? "end" : "start";
                      return lines.map((line, li) => (
                        <text key={li} x={labelX} y={y + (li - (lines.length - 1) / 2) * 15}
                          textAnchor={anchor} dominantBaseline="middle"
                          fontSize="11" fill="#e2e8f0" fontFamily="serif" fontWeight="600">
                          {line}
                        </text>
                      ));
                    })()}
                    {/* Stars value */}
                    <text x={col === "left" ? x - NODE_R - 12 : x + NODE_R + 12}
                      y={y + 22} textAnchor={col === "left" ? "end" : "start"}
                      fontSize="10" fill="#f59e0b">
                      {"✦".repeat(m.starsValue)}
                    </text>
                    {/* Target date */}
                    {m.targetDate && (
                      <text x={col === "left" ? x - NODE_R - 12 : x + NODE_R + 12}
                        y={y + 37} textAnchor={col === "left" ? "end" : "start"}
                        fontSize="9" fill="#475569">
                        {m.targetDate}
                      </text>
                    )}
                    {/* Add task button */}
                    <g onClick={e => { e.stopPropagation(); setNewTaskOpen(m.id); }} style={{ cursor: "pointer" }}>
                      <circle cx={x + NODE_R + 2} cy={y - NODE_R + 2} r={10}
                        fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                      <text x={x + NODE_R + 2} y={y - NODE_R + 2}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="12" fill="#60a5fa">+</text>
                    </g>
                  </g>
                );
              })}

              {/* Task nodes */}
              {taskNodes.map(({ x, y, t }) => {
                const colors = TASK_COLORS[t.status as TaskStatus] ?? TASK_COLORS.plan;
                const pColor = t.priority ? PRIORITY_COLORS[t.priority as Priority] : "#64748b";
                const isSelected = selected?.type === "task" && selected.id === t.id;
                return (
                  <g key={t.id} onClick={() => setSelected(isSelected ? null : { type: "task", id: t.id })} style={{ cursor: "pointer" }}>
                    <circle cx={x} cy={y} r={TASK_R + 4} fill={colors.ring} fillOpacity="0.12" />
                    <circle cx={x} cy={y} r={TASK_R}
                      fill="#0f172a" stroke={isSelected ? "#fbbf24" : colors.ring}
                      strokeWidth={isSelected ? 2.5 : 1.5} />
                    <circle cx={x} cy={y} r={4} fill={colors.dot} />
                    {/* Priority indicator */}
                    <circle cx={x + TASK_R - 2} cy={y - TASK_R + 2} r={3}
                      fill={pColor} />
                  </g>
                );
              })}

              {/* Empty state */}
              {totalMilestones === 0 && (
                <>
                  <circle cx={SVG_W / 2} cy={svgH / 2} r={48} fill="#0f1e2e" stroke="#1e3a5f" strokeWidth="2" strokeDasharray="6 4" />
                  <text x={SVG_W / 2} y={svgH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="28" fill="#1e3a5f">✦</text>
                  <text x={SVG_W / 2} y={svgH / 2 + 70} textAnchor="middle" fontSize="13" fill="#334155">Plant your first milestone</text>
                </>
              )}
            </svg>

            {/* Unlinked tasks */}
            {unlinkedTasks.length > 0 && (
              <div className="mt-8 w-full max-w-xl">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-3">Unassigned Tasks</p>
                <div className="flex flex-wrap gap-2">
                  {unlinkedTasks.map(t => {
                    const colors = TASK_COLORS[t.status as TaskStatus] ?? TASK_COLORS.plan;
                    return (
                      <button key={t.id} onClick={() => setSelected({ type: "task", id: t.id })}
                        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full text-xs hover:border-primary/50 transition-colors">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }} />
                        {t.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {(selectedMilestone || selectedTask) && (
          <div className="w-80 border-l border-border bg-card/80 backdrop-blur flex flex-col shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                {selectedMilestone ? "Milestone" : "Task"}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(null)}>
                <X size={14} />
              </Button>
            </div>

            {selectedMilestone && (() => {
              const mTasks = tasks.filter(t => t.milestoneId === selectedMilestone.id);
              const done = mTasks.filter(t => t.status === "next_plan").length;
              const colors = MILESTONE_COLORS[selectedMilestone.status as MilestoneStatus] ?? MILESTONE_COLORS.planted;
              return (
                <div className="p-4 flex flex-col gap-4">
                  <div>
                    <h2 className="font-serif text-lg font-bold text-foreground leading-tight">{selectedMilestone.title}</h2>
                    {selectedMilestone.description && <p className="text-sm text-muted-foreground mt-2">{selectedMilestone.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <StarRating value={selectedMilestone.starsValue} />
                    {selectedMilestone.targetDate && <span className="text-xs text-muted-foreground">{selectedMilestone.targetDate}</span>}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                    <Select value={selectedMilestone.status} onValueChange={v => handleStatusChange(selectedMilestone.id, v as MilestoneStatus)}>
                      <SelectTrigger className="h-8 text-xs" style={{ borderColor: colors.stroke, color: colors.stroke }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["planted","growing","blooming","harvested"] as MilestoneStatus[]).map(s => (
                          <SelectItem key={s} value={s}>{MILESTONE_COLORS[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {mTasks.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span className="font-medium">Tasks</span>
                        <span>{done}/{mTasks.length} done</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${mTasks.length > 0 ? (done / mTasks.length) * 100 : 0}%` }} />
                      </div>
                      <div className="space-y-2">
                        {mTasks.map(t => {
                          const tc = TASK_COLORS[t.status as TaskStatus] ?? TASK_COLORS.plan;
                          return (
                            <div key={t.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-background/50 border border-border/50">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tc.dot }} />
                                <span className="text-xs text-foreground truncate">{t.title}</span>
                              </div>
                              <Select value={t.status} onValueChange={v => handleTaskStatusChange(t.id, v as TaskStatus)}>
                                <SelectTrigger className="h-6 text-[10px] w-20 shrink-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(["plan","doing","check","next_plan"] as TaskStatus[]).map(s => (
                                    <SelectItem key={s} value={s}>{TASK_COLORS[s].label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1"
                    onClick={() => { setNewTaskOpen(selectedMilestone.id); setSelected(null); }}>
                    <Plus size={12} /> Add Task to this Milestone
                  </Button>
                </div>
              );
            })()}

            {selectedTask && (() => {
              const tc = TASK_COLORS[selectedTask.status as TaskStatus] ?? TASK_COLORS.plan;
              const linkedMilestone = milestones.find(m => m.id === selectedTask.milestoneId);
              return (
                <div className="p-4 flex flex-col gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tc.dot }} />
                      <span className="text-xs text-muted-foreground">{tc.label}</span>
                      {selectedTask.priority && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold"
                          style={{ color: PRIORITY_COLORS[selectedTask.priority as Priority], borderColor: PRIORITY_COLORS[selectedTask.priority as Priority] + "40" }}>
                          {selectedTask.priority}
                        </span>
                      )}
                    </div>
                    <h2 className="font-serif text-lg font-bold text-foreground leading-tight">{selectedTask.title}</h2>
                    {selectedTask.description && <p className="text-sm text-muted-foreground mt-2">{selectedTask.description}</p>}
                  </div>
                  {linkedMilestone && (
                    <div className="flex items-center gap-2 text-xs text-primary/70 border border-primary/20 rounded-lg px-3 py-2">
                      <ChevronRight size={12} />
                      Milestone: {linkedMilestone.title}
                    </div>
                  )}
                  {selectedTask.kpiImpact && (
                    <div className="text-xs bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">KPI: </span>
                      <span className="text-primary">{selectedTask.kpiImpact}</span>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                    <Select value={selectedTask.status} onValueChange={v => handleTaskStatusChange(selectedTask.id, v as TaskStatus)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["plan","doing","check","next_plan"] as TaskStatus[]).map(s => (
                          <SelectItem key={s} value={s}>{TASK_COLORS[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* New Milestone Dialog */}
      <Dialog open={newMilestoneOpen} onOpenChange={setNewMilestoneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Plant a Milestone</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={mForm.title} onChange={e => setMForm(f => ({ ...f, title: e.target.value }))} placeholder="What landmark will you reach?" /></div>
            <div><Label>Description</Label><Textarea value={mForm.description} onChange={e => setMForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Stars Value (importance)</Label>
              <Select value={mForm.starsValue} onValueChange={v => setMForm(f => ({ ...f, starsValue: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Target Date</Label><Input type="date" value={mForm.targetDate} onChange={e => setMForm(f => ({ ...f, targetDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewMilestoneOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateMilestone} disabled={createMilestone.isPending}>Plant Milestone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Task Dialog */}
      <Dialog open={newTaskOpen !== null} onOpenChange={open => !open && setNewTaskOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={tForm.title} onChange={e => setTForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" /></div>
            <div><Label>Description</Label><Textarea value={tForm.description} onChange={e => setTForm(f => ({ ...f, description: e.target.value }))} /></div>
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
            {kpis.length > 0 && (
              <div><Label>KPI Impact (optional)</Label>
                <Select value={tForm.kpiImpact} onValueChange={v => setTForm(f => ({ ...f, kpiImpact: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {kpis.map(k => <SelectItem key={k.id} value={k.name}>{k.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTaskOpen(null)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={createTask.isPending}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GameLayout>
  );
}
