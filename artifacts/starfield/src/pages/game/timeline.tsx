import { useState, useRef, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { useListMilestones, useListTasks, useListKpis } from "@workspace/api-client-react";
import type { Milestone, Task, Kpi } from "@workspace/api-client-react";
import GameLayout from "./layout";
import { Calendar, ChevronRight, ChevronDown, Zap, Flag, CheckSquare } from "lucide-react";

// ── Date helpers ───────────────────────────────────────────────────────────────
const MS_DAY  = 86_400_000;
const MS_WEEK = 7 * MS_DAY;
const MS_HOUR = 3_600_000;

function snapToMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function snapToMondayWeek(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0);
  const day = r.getDay(); // 0=Sun
  r.setDate(r.getDate() - ((day + 6) % 7)); // back to Monday
  return r;
}
function snapToDay(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function snapToHour(d: Date): Date {
  const r = new Date(d); r.setMinutes(0, 0, 0); return r;
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d); r.setMonth(r.getMonth() + n); return r;
}

// ── Zoom definition ────────────────────────────────────────────────────────────
type ZoomLevel = "year" | "quarter" | "month" | "week" | "day";

interface Tick {
  date: Date;
  label: string;
  isGroupStart: boolean;
  groupLabel: string;
}

interface ZoomDef {
  label: string;
  rowPx: number;
  futureMonths: number; // approximate months of future range
  pastMonths: number;
  snapStart: (d: Date) => Date;
  prevTick: (d: Date) => Date;
  makeTick: (d: Date) => Tick;
}

const ZOOMS: Record<ZoomLevel, ZoomDef> = {
  year: {
    label: "Year",
    rowPx: 76,
    futureMonths: 18,
    pastMonths: 18,
    snapStart: d => {
      // start one month AHEAD of top so the top row is fully visible
      const r = snapToMonth(d); r.setMonth(r.getMonth() + 1); return r;
    },
    prevTick: d => addMonths(d, -1),
    makeTick: d => ({
      date: d,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      isGroupStart: d.getMonth() === 0,
      groupLabel: String(d.getFullYear()),
    }),
  },
  quarter: {
    label: "Quarter",
    rowPx: 58,
    futureMonths: 6,
    pastMonths: 6,
    snapStart: d => {
      const r = snapToMondayWeek(d); r.setDate(r.getDate() + 7); return r;
    },
    prevTick: d => new Date(d.getTime() - MS_WEEK),
    makeTick: d => {
      const q = Math.floor(d.getMonth() / 3) + 1;
      const isQStart = d.getDate() <= 7 && d.getMonth() % 3 === 0;
      return {
        date: d,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        isGroupStart: isQStart,
        groupLabel: `Q${q} ${d.getFullYear()}`,
      };
    },
  },
  month: {
    label: "Month",
    rowPx: 40,
    futureMonths: 2,
    pastMonths: 2,
    snapStart: d => {
      const r = snapToDay(d); r.setDate(r.getDate() + 1); return r;
    },
    prevTick: d => new Date(d.getTime() - MS_DAY),
    makeTick: d => ({
      date: d,
      label: d.getDate() === 1
        ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : String(d.getDate()),
      isGroupStart: d.getDate() === 1,
      groupLabel: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    }),
  },
  week: {
    label: "Week",
    rowPx: 56,
    futureMonths: 0.5,
    pastMonths: 0.5,
    snapStart: d => {
      const r = snapToDay(d); r.setDate(r.getDate() + 1); return r;
    },
    prevTick: d => new Date(d.getTime() - MS_DAY),
    makeTick: d => ({
      date: d,
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      isGroupStart: d.getDay() === 1,
      groupLabel: `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    }),
  },
  day: {
    label: "Day",
    rowPx: 36,
    futureMonths: 0,
    pastMonths: 0,
    snapStart: d => {
      const r = snapToHour(d); r.setHours(r.getHours() + 2); return r;
    },
    prevTick: d => new Date(d.getTime() - MS_HOUR),
    makeTick: d => ({
      date: d,
      label: `${String(d.getHours()).padStart(2, "0")}:00`,
      isGroupStart: d.getHours() === 0,
      groupLabel: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    }),
  },
};

// ── Status colours ─────────────────────────────────────────────────────────────
const M_BORDER: Record<string, string> = {
  planted:  "border-blue-400/50",
  growing:  "border-emerald-400/50",
  blooming: "border-amber-400/50",
  harvested:"border-purple-400/50",
};
const M_BG: Record<string, string> = {
  planted:  "bg-blue-500/10",
  growing:  "bg-emerald-500/10",
  blooming: "bg-amber-500/10",
  harvested:"bg-purple-500/10",
};
const M_DOT: Record<string, string> = {
  planted:  "bg-blue-400  shadow-[0_0_6px_2px_rgba(96,165,250,0.6)]",
  growing:  "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]",
  blooming: "bg-amber-400  shadow-[0_0_6px_2px_rgba(251,191,36,0.6)]",
  harvested:"bg-purple-400 shadow-[0_0_6px_2px_rgba(167,139,250,0.6)]",
};
const M_LABEL: Record<string, string> = {
  planted:  "text-blue-300",
  growing:  "text-emerald-300",
  blooming: "text-amber-300",
  harvested:"text-purple-300",
};
const T_COLOR: Record<string, string> = {
  plan:      "text-muted-foreground",
  doing:     "text-blue-300",
  check:     "text-amber-300",
  next_plan: "text-emerald-300",
};

// ── Layout constants ───────────────────────────────────────────────────────────
const LABEL_W  = 108;
const SPINE_X  = LABEL_W + 24;
const CARD_X   = SPINE_X + 20;

// ── Positioning ────────────────────────────────────────────────────────────────
function getEventY(
  date: Date,
  ticks: Tick[],
  rowPx: number,
): number {
  if (ticks.length === 0) return 0;
  const ts = date.getTime();

  // Above all ticks (more future than topmost tick)
  if (ts >= ticks[0].date.getTime()) return 0;

  for (let i = 0; i < ticks.length - 1; i++) {
    const tTop = ticks[i].date.getTime();
    const tBot = ticks[i + 1].date.getTime();
    if (ts <= tTop && ts > tBot) {
      const frac = (tTop - ts) / (tTop - tBot);
      return (i + frac) * rowPx;
    }
  }

  // Below all ticks (more past than bottommost tick)
  return ticks.length * rowPx;
}

// ── Expand date range to include all events with padding ───────────────────────
function expandRange(
  baseStart: Date,
  baseEnd: Date,
  milestones: Milestone[],
  tasks: Task[],
  zdef: ZoomDef,
): { start: Date; end: Date } {
  let start = baseStart.getTime();
  let end   = baseEnd.getTime();
  const pad = zdef.rowPx > 50 ? 2 * 30 * MS_DAY : 7 * MS_DAY;

  for (const m of milestones) {
    if (m.targetDate) {
      const t = new Date(m.targetDate).getTime();
      if (t > start) start = t + pad;
      if (t < end)   end   = t - pad;
    }
  }
  for (const t of tasks) {
    if (t.dueDate) {
      const ts = new Date(t.dueDate).getTime();
      if (ts > start) start = ts + pad;
      if (ts < end)   end   = ts - pad;
    }
  }
  return { start: new Date(start), end: new Date(end) };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Timeline() {
  const [, params] = useRoute("/game/:gameId/timeline");
  const gameId = Number(params?.gameId ?? 0);

  const [zoom, setZoom] = useState<ZoomLevel>("quarter");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: milestones = [] } = useListMilestones(gameId, { query: { enabled: !!gameId } });
  const { data: tasks      = [] } = useListTasks(gameId,      { query: { enabled: !!gameId } });
  const { data: kpis       = [] } = useListKpis(gameId,       { query: { enabled: !!gameId } });

  const now  = useMemo(() => new Date(), []);
  const zdef = ZOOMS[zoom];

  // ── Compute ticks ────────────────────────────────────────────────────────────
  const { ticks, totalPx, nowY } = useMemo(() => {
    // Base date range from zoom config
    const approxFutureMs = zdef.futureMonths * 30 * MS_DAY || 2 * MS_DAY;
    const approxPastMs   = zdef.pastMonths   * 30 * MS_DAY || 2 * MS_DAY;
    const baseStart = new Date(now.getTime() + approxFutureMs);
    const baseEnd   = new Date(now.getTime() - approxPastMs);

    // Expand to include all events
    const { start, end } = expandRange(baseStart, baseEnd, milestones, tasks, zdef);

    // Generate ticks from top (future) → bottom (past)
    const result: Tick[] = [];
    let cursor = zdef.snapStart(start);
    let safety = 0;
    while (cursor.getTime() >= end.getTime() && safety < 2000) {
      result.push(zdef.makeTick(new Date(cursor)));
      cursor = zdef.prevTick(cursor);
      safety++;
    }

    const totalPx = result.length * zdef.rowPx;
    const nowY_   = getEventY(now, result, zdef.rowPx);
    return { ticks: result, totalPx, nowY: nowY_ };
  }, [zoom, milestones, tasks, now, zdef]);

  // ── Scroll to NOW on zoom change ─────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      const offset = nowY - scrollRef.current.clientHeight / 2;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, [zoom, nowY]);

  // ── Group events ─────────────────────────────────────────────────────────────
  const datedMs   = useMemo(() => milestones.filter(m => m.targetDate), [milestones]);
  const undatedMs = useMemo(() => milestones.filter(m => !m.targetDate), [milestones]);

  const tasksByMilestone = useMemo(() => {
    const m = new Map<number | null, Task[]>();
    for (const t of tasks) {
      const k = t.milestoneId ?? null;
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [tasks]);

  const kpisByMilestone = useMemo(() => {
    const m = new Map<number | null, Kpi[]>();
    for (const k of kpis) {
      const key = k.milestoneId ?? null;
      m.set(key, [...(m.get(key) ?? []), k]);
    }
    return m;
  }, [kpis]);

  const toggleExpand = (id: number) =>
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <GameLayout>
      <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem - 32px)" }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/30 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <Calendar size={15} className="text-primary" />
            <h1 className="text-sm font-bold uppercase tracking-widest text-foreground/80">Timeline</h1>
            <span className="text-xs text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground/40">
              {datedMs.length} scheduled · {undatedMs.length} floating
            </span>
          </div>
          <div className="flex items-center gap-0.5 bg-muted/20 rounded-lg p-0.5 border border-border/30">
            {(["year", "quarter", "month", "week", "day"] as ZoomLevel[]).map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  zoom === z
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                {ZOOMS[z].label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="relative" style={{ minHeight: totalPx + 200 }}>

            {/* ── Tick lines (full-width horizontal rules) ── */}
            {ticks.map((tick, i) => (
              <div
                key={`line-${i}`}
                className={`absolute left-0 right-0 pointer-events-none ${
                  tick.isGroupStart ? "h-[1px] bg-primary/12" : "h-px bg-border/8"
                }`}
                style={{ top: i * zdef.rowPx }}
              />
            ))}

            {/* ── Group headers (year / quarter / month bands) ── */}
            {ticks.map((tick, i) =>
              tick.isGroupStart ? (
                <div
                  key={`grp-${i}`}
                  className="absolute left-0 pointer-events-none"
                  style={{ top: i * zdef.rowPx - 14, left: 0, width: LABEL_W }}
                >
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/50 px-2 py-0.5 bg-primary/5 rounded-sm">
                    {tick.groupLabel}
                  </span>
                </div>
              ) : null
            )}

            {/* ── Time labels column ── */}
            {ticks.map((tick, i) => (
              <div
                key={`lbl-${i}`}
                className="absolute text-right pointer-events-none"
                style={{ top: i * zdef.rowPx + 2, left: 0, width: LABEL_W - 8 }}
              >
                <span className="text-[10px] text-muted-foreground/40 pr-2">
                  {tick.label}
                </span>
              </div>
            ))}

            {/* ── Spine ── */}
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: SPINE_X,
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(96,165,250,0.25) 5%, rgba(96,165,250,0.25) 95%, transparent 100%)",
              }}
            />
            {/* Tick marks on spine */}
            {ticks.map((tick, i) => (
              <div
                key={`spine-tick-${i}`}
                className="absolute pointer-events-none"
                style={{
                  top: i * zdef.rowPx,
                  left: SPINE_X - 4,
                  width: 8,
                  height: 1,
                  background: tick.isGroupStart
                    ? "rgba(96,165,250,0.3)"
                    : "rgba(96,165,250,0.12)",
                }}
              />
            ))}

            {/* ── NOW line ── */}
            <div
              className="absolute left-0 right-4 z-20 pointer-events-none"
              style={{ top: nowY }}
            >
              <div
                className="h-[2px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.0) 0px, rgba(251,191,36,0.9) 108px, rgba(251,191,36,0.5) 60%, transparent 100%)",
                  boxShadow: "0 0 10px rgba(251,191,36,0.4)",
                }}
              />
              <div
                className="absolute text-[9px] font-black uppercase tracking-[0.2em] text-amber-400"
                style={{
                  top: 3,
                  left: LABEL_W + 4,
                  textShadow: "0 0 8px rgba(251,191,36,1)",
                }}
              >
                NOW
              </div>
            </div>

            {/* ── Milestone events ── */}
            {datedMs.map(m => {
              const y        = getEventY(new Date(m.targetDate!), ticks, zdef.rowPx);
              const isExp    = expanded.has(m.id);
              const mTasks   = tasksByMilestone.get(m.id) ?? [];
              const mKpis    = kpisByMilestone.get(m.id) ?? [];
              const dotColor = M_DOT[m.status]    ?? "bg-slate-400";
              const border   = M_BORDER[m.status]  ?? "border-border";
              const bg       = M_BG[m.status]      ?? "bg-card/60";
              const lblColor = M_LABEL[m.status]   ?? "text-muted-foreground";

              return (
                <div key={m.id} className="absolute" style={{ top: y - 14, left: CARD_X, right: 16, zIndex: 10 }}>
                  {/* Dot on spine */}
                  <div
                    className={`absolute w-3 h-3 rounded-full border-2 border-background ${dotColor}`}
                    style={{ top: 8, left: -(CARD_X - SPINE_X) + 2 }}
                  />
                  {/* Connector */}
                  <div
                    className="absolute h-px bg-border/30"
                    style={{ top: 14, left: -(CARD_X - SPINE_X) + 14, width: CARD_X - SPINE_X - 14 }}
                  />

                  {/* Card */}
                  <button
                    onClick={() => toggleExpand(m.id)}
                    className={`w-full text-left border rounded-xl px-4 py-2.5 transition-all duration-150 ${border} ${bg} hover:brightness-125 backdrop-blur-sm`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Flag size={11} className={`shrink-0 ${lblColor} opacity-70`} />
                        <span className="text-sm font-semibold text-foreground/90 truncate">{m.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(mTasks.length > 0 || mKpis.length > 0) && (
                          <span className="text-[10px] text-muted-foreground/40">
                            {mTasks.length > 0 && `${mTasks.length}t`}{mKpis.length > 0 && ` ${mKpis.length}k`}
                          </span>
                        )}
                        {isExp ? <ChevronDown size={11} className="text-muted-foreground/50" /> : <ChevronRight size={11} className="text-muted-foreground/30" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className={`text-[10px] uppercase tracking-wide ${lblColor} opacity-70`}>{m.status}</span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {new Date(m.targetDate!).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </button>

                  {/* Expanded: tasks + KPIs */}
                  {isExp && (
                    <div className="mt-1 ml-4 space-y-0.5 border-l border-border/20 pl-3">
                      {mTasks.length > 0 && (
                        <>
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/35 pt-1 pb-0.5">
                            Tasks
                          </div>
                          {mTasks.map(t => (
                            <div
                              key={t.id}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50 border border-border/15"
                            >
                              <CheckSquare size={9} className={T_COLOR[t.status] ?? "text-muted-foreground"} />
                              <span className="text-xs text-foreground/65 flex-1 truncate">{t.title}</span>
                              {t.dueDate && (
                                <span className="text-[9px] text-muted-foreground/35 shrink-0">
                                  {new Date(t.dueDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                              <span
                                className={`text-[9px] uppercase ${T_COLOR[t.status] ?? "text-muted-foreground"} opacity-70`}
                              >
                                {t.status.replace("_", " ")}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                      {mKpis.length > 0 && (
                        <>
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/35 pt-2 pb-0.5">
                            KPIs
                          </div>
                          {mKpis.map(k => (
                            <div
                              key={k.id}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50 border border-border/15"
                            >
                              <Zap size={9} className="text-amber-400/60 shrink-0" />
                              <span className="text-xs text-foreground/65 flex-1 truncate">{k.name}</span>
                              <span className="text-[9px] text-muted-foreground/35 shrink-0">
                                {k.current}/{k.target} {k.unit}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Standalone tasks with dueDate (not linked to a milestone) ── */}
            {(tasksByMilestone.get(null) ?? [])
              .filter(t => !!t.dueDate)
              .map(t => {
                const y = getEventY(new Date(t.dueDate!), ticks, zdef.rowPx);
                return (
                  <div key={`t-${t.id}`} className="absolute" style={{ top: y - 8, left: CARD_X, right: 16, zIndex: 8 }}>
                    {/* Dot */}
                    <div
                      className="absolute w-2 h-2 rounded-full bg-slate-400/60 border border-background"
                      style={{ top: 6, left: -(CARD_X - SPINE_X) + 3 }}
                    />
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/40 border border-border/20">
                      <CheckSquare size={9} className={T_COLOR[t.status] ?? "text-muted-foreground"} />
                      <span className="text-xs text-foreground/55 flex-1 truncate">{t.title}</span>
                      <span className="text-[9px] text-muted-foreground/30 shrink-0">
                        {new Date(t.dueDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                );
              })}

          </div>

          {/* ── Unscheduled section ── */}
          {(undatedMs.length > 0 ||
            (tasksByMilestone.get(null) ?? []).filter(t => !t.dueDate).length > 0) && (
            <div className="border-t border-border/20 px-6 py-5 mt-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/35 mb-3">
                Floating — no target date
              </div>
              <div className="flex flex-wrap gap-2">
                {undatedMs.map(m => (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${M_BORDER[m.status] ?? "border-border"} ${M_BG[m.status] ?? "bg-card/40"} ${M_LABEL[m.status] ?? "text-muted-foreground"}`}
                  >
                    <Flag size={10} className="opacity-60" />{m.title}
                  </span>
                ))}
                {(tasksByMilestone.get(null) ?? [])
                  .filter(t => !t.dueDate)
                  .map(t => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-card/30 text-xs text-foreground/50"
                    >
                      <CheckSquare size={10} className="opacity-50" />{t.title}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Bottom spacer so last events aren't clipped */}
          <div style={{ height: 120 }} />
        </div>
      </div>
    </GameLayout>
  );
}
