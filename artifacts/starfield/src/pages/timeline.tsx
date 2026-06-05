import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQueries } from "@tanstack/react-query";
import {
  useListGames,
  getListMilestonesQueryOptions,
  getListTasksQueryOptions,
} from "@workspace/api-client-react";
import type { Milestone, Task } from "@workspace/api-client-react";
import { ChevronRight, ChevronDown, Flag, CheckSquare, LayoutGrid } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const MS_DAY  = 86_400_000;
const MS_WEEK = 7 * MS_DAY;
const MS_HOUR = 3_600_000;

// ── Types ─────────────────────────────────────────────────────────────────────
type Granularity = "year" | "quarter" | "month" | "week" | "day" | "hour";

interface TimeNode {
  id: string;
  granularity: Granularity;
  label: string;
  start: Date;
  end: Date;
  depth: number;         // 0=year … 5=hour
  hasChildren: boolean;
  isCurrentPeriod: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function weeksOfMonth(year: number, month: number): { start: Date; end: Date }[] {
  const out: { start: Date; end: Date }[] = [];
  const d = new Date(year, month, 1);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // snap back to Monday
  const mEnd = new Date(year, month + 1, 1);
  while (d < mEnd) {
    out.push({ start: new Date(d), end: new Date(d.getTime() + MS_WEEK) });
    d.setDate(d.getDate() + 7);
  }
  return out;
}

function computeNodes(expanded: Set<string>, y0: number, y1: number): TimeNode[] {
  const rows: TimeNode[] = [];
  const now = Date.now();
  const cur = (s: Date, e: Date) => s.getTime() <= now && e.getTime() > now;

  for (let yr = y1; yr >= y0; yr--) {
    const ys = new Date(yr, 0, 1), ye = new Date(yr + 1, 0, 1);
    const yid = `${yr}`;
    rows.push({ id: yid, granularity: "year",  label: `${yr}`, start: ys, end: ye, depth: 0, hasChildren: true, isCurrentPeriod: cur(ys, ye) });
    if (!expanded.has(yid)) continue;

    for (let q = 4; q >= 1; q--) {
      const qs = new Date(yr, (q - 1) * 3, 1), qe = new Date(yr, q * 3, 1);
      const qid = `${yr}-Q${q}`;
      rows.push({ id: qid, granularity: "quarter", label: `Q${q} ${yr}`, start: qs, end: qe, depth: 1, hasChildren: true, isCurrentPeriod: cur(qs, qe) });
      if (!expanded.has(qid)) continue;

      for (let m = q * 3 - 1; m >= (q - 1) * 3; m--) {
        const ms_ = new Date(yr, m, 1), me = new Date(yr, m + 1, 1);
        const mid = `${yr}-M${m + 1}`;
        const ml = ms_.toLocaleDateString("en-US", { month: "short" });
        rows.push({ id: mid, granularity: "month", label: ml, start: ms_, end: me, depth: 2, hasChildren: true, isCurrentPeriod: cur(ms_, me) });
        if (!expanded.has(mid)) continue;

        const wks = weeksOfMonth(yr, m);
        for (let wi = wks.length - 1; wi >= 0; wi--) {
          const { start: ws, end: we } = wks[wi];
          const wid = `${mid}-W${wi + 1}`;
          const wl = `Wk ${wi + 1}  ${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          rows.push({ id: wid, granularity: "week", label: wl, start: ws, end: we, depth: 3, hasChildren: true, isCurrentPeriod: cur(ws, we) });
          if (!expanded.has(wid)) continue;

          for (let di = 6; di >= 0; di--) {
            const ds = new Date(ws.getTime() + di * MS_DAY);
            const de = new Date(ds.getTime() + MS_DAY);
            // Skip days entirely outside the month
            if (ds >= me || de <= ms_) continue;
            const did = `${yr}-${m + 1}-${ds.getDate()}`;
            const dl = ds.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
            rows.push({ id: did, granularity: "day", label: dl, start: ds, end: de, depth: 4, hasChildren: true, isCurrentPeriod: cur(ds, de) });
            if (!expanded.has(did)) continue;

            for (let h = 23; h >= 0; h--) {
              const hs = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate(), h);
              const he = new Date(hs.getTime() + MS_HOUR);
              const hid = `${did}-H${h}`;
              rows.push({ id: hid, granularity: "hour", label: `${String(h).padStart(2, "0")}:00`, start: hs, end: he, depth: 5, hasChildren: false, isCurrentPeriod: cur(hs, he) });
            }
          }
        }
      }
    }
  }
  return rows;
}

// Best (deepest) visible node containing a date
function nodeFor(ts: number, nodes: TimeNode[]): TimeNode | null {
  let best: TimeNode | null = null;
  for (const n of nodes) {
    if (ts >= n.start.getTime() && ts < n.end.getTime()) {
      if (!best || n.depth > best.depth) best = n;
    }
  }
  return best;
}

function defaultExpanded(): Set<string> {
  const d = new Date();
  const yr = d.getFullYear();
  const q  = Math.floor(d.getMonth() / 3) + 1;
  return new Set([`${yr}`, `${yr}-Q${q}`]);
}

// ── Visual helpers ─────────────────────────────────────────────────────────────
const M_STYLE: Record<string, { bg: string; text: string }> = {
  planted:  { bg: "bg-blue-500/15 border-blue-400/40",    text: "text-blue-300" },
  growing:  { bg: "bg-emerald-500/15 border-emerald-400/40", text: "text-emerald-300" },
  blooming: { bg: "bg-amber-500/15 border-amber-400/40",  text: "text-amber-300" },
  harvested:{ bg: "bg-purple-500/15 border-purple-400/40", text: "text-purple-300" },
};
const T_STYLE: Record<string, string> = {
  plan: "text-muted-foreground/50", doing: "text-blue-300",
  check: "text-amber-300", next_plan: "text-emerald-300",
};

const ROW_MIN: Record<Granularity, string> = {
  year: "min-h-[44px]", quarter: "min-h-[40px]", month: "min-h-[36px]",
  week: "min-h-[32px]", day:  "min-h-[28px]",  hour: "min-h-[24px]",
};
const FONT: Record<Granularity, string> = {
  year: "font-bold text-sm", quarter: "font-semibold text-xs", month: "text-xs",
  week: "text-[11px]", day: "text-[11px]", hour: "text-[10px]",
};
const INDENT = [0, 10, 20, 30, 40, 50]; // px

// ── Layout constants ───────────────────────────────────────────────────────────
const LABEL_W = 188;
const COL_MIN = 180;
const COL_MAX = 300;

// ── Sub-components ─────────────────────────────────────────────────────────────
function NowRow({ colCount, colW }: { colCount: number; colW: number }) {
  return (
    <div className="flex items-center relative z-10" style={{ height: 20 }}>
      {/* Sticky label cell */}
      <div
        className="sticky left-0 z-20 flex items-center justify-end pr-2 bg-background border-r border-border/20"
        style={{ width: LABEL_W, minWidth: LABEL_W, height: 20 }}
      >
        <span
          className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-400"
          style={{ textShadow: "0 0 10px rgba(251,191,36,0.9)" }}
        >
          NOW
        </span>
      </div>
      {/* Amber line across all game columns */}
      <div
        className="h-[2px] flex-1"
        style={{
          width: colCount * colW,
          background: "linear-gradient(90deg, rgba(251,191,36,0.9) 0%, rgba(251,191,36,0.4) 50%, transparent 100%)",
          boxShadow: "0 0 8px rgba(251,191,36,0.4)",
        }}
      />
    </div>
  );
}

function EventCell({ milestones, tasks }: { milestones: Milestone[]; tasks: Task[] }) {
  if (!milestones.length && !tasks.length) return null;
  return (
    <div className="flex flex-col gap-[2px] py-1">
      {milestones.slice(0, 3).map(m => {
        const s = M_STYLE[m.status] ?? M_STYLE.planted;
        return (
          <div key={m.id} className={`flex items-center gap-1 rounded px-1.5 py-[2px] border text-[10px] truncate ${s.bg} ${s.text}`}>
            <Flag size={8} className="shrink-0 opacity-70" />
            <span className="truncate">{m.title}</span>
          </div>
        );
      })}
      {milestones.length > 3 && <span className="text-[9px] text-muted-foreground/35 pl-1">+{milestones.length - 3}</span>}
      {tasks.slice(0, 2).map(t => (
        <div key={t.id} className={`flex items-center gap-1 text-[10px] truncate px-1.5 py-[2px] rounded border border-border/15 bg-card/30 ${T_STYLE[t.status] ?? "text-muted-foreground/40"}`}>
          <CheckSquare size={8} className="shrink-0" />
          <span className="truncate">{t.title}</span>
        </div>
      ))}
      {tasks.length > 2 && <span className="text-[9px] text-muted-foreground/35 pl-1">+{tasks.length - 2}t</span>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GlobalTimeline() {
  const { data: games = [], isLoading } = useListGames();

  const msResults = useQueries({ queries: games.map(g => getListMilestonesQueryOptions(g.id)) });
  const tkResults = useQueries({ queries: games.map(g => getListTasksQueryOptions(g.id))      });

  const gameData = useMemo(
    () => games.map((g, i) => ({
      game: g,
      milestones: (msResults[i]?.data ?? []) as Milestone[],
      tasks:      (tkResults[i]?.data ?? []) as Task[],
    })),
    [games, msResults, tkResults]
  );

  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded);
  const toggle = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Date range: cover all events + ±1 year buffer
  const { y0, y1 } = useMemo(() => {
    const now = new Date().getFullYear();
    let mn = now - 1, mx = now + 2;
    for (const { milestones, tasks } of gameData) {
      for (const m of milestones) if (m.targetDate) { const y = new Date(m.targetDate).getFullYear(); mn = Math.min(mn, y); mx = Math.max(mx, y); }
      for (const t of tasks)      if (t.dueDate)    { const y = new Date(t.dueDate).getFullYear();    mn = Math.min(mn, y); mx = Math.max(mx, y); }
    }
    return { y0: mn, y1: mx };
  }, [gameData]);

  const nodes = useMemo(() => computeNodes(expanded, y0, y1), [expanded, y0, y1]);

  // Build per-game event maps: nodeId → {milestones, tasks}
  const eventMaps = useMemo(() =>
    gameData.map(({ milestones, tasks }) => {
      const map = new Map<string, { milestones: Milestone[]; tasks: Task[] }>();
      const put = (id: string) => { if (!map.has(id)) map.set(id, { milestones: [], tasks: [] }); return map.get(id)!; };
      for (const m of milestones) {
        if (m.targetDate) { const n = nodeFor(new Date(m.targetDate).getTime(), nodes); if (n) put(n.id).milestones.push(m); }
      }
      for (const t of tasks) {
        if (t.dueDate) { const n = nodeFor(new Date(t.dueDate).getTime(), nodes); if (n) put(n.id).tasks.push(t); }
      }
      return map;
    }),
    [gameData, nodes]
  );

  // Insert NOW divider: before the first fully-past node
  const nowTs = Date.now();
  const nowBoundaryIdx = nodes.findIndex(n => n.end.getTime() <= nowTs);

  // Flat rows including the NOW divider
  const rows = useMemo(() => {
    type Row = { kind: "now" } | { kind: "node"; node: TimeNode; idx: number };
    const r: Row[] = [];
    let inserted = false;
    for (let i = 0; i < nodes.length; i++) {
      if (!inserted && nodes[i].end.getTime() <= nowTs) { r.push({ kind: "now" }); inserted = true; }
      r.push({ kind: "node", node: nodes[i], idx: i });
    }
    if (!inserted) r.push({ kind: "now" }); // all nodes are future
    return r;
  }, [nodes, nowTs]);

  const colW = Math.max(COL_MIN, Math.min(COL_MAX, Math.floor(Math.max(800, typeof window !== "undefined" ? window.innerWidth : 1280) - LABEL_W) / Math.max(1, games.length)));

  return (
    <div className="flex flex-col bg-background text-foreground" style={{ height: "100vh" }}>

      {/* ── Top nav bar ── */}
      <header className="shrink-0 border-b border-border/40 bg-card/40 backdrop-blur sticky top-0 z-40 flex items-center gap-4 px-6 h-14">
        <Link href="/" className="font-serif text-primary font-bold text-xl">SF</Link>
        <div className="w-px h-5 bg-border/30" />
        <LayoutGrid size={14} className="text-primary/60" />
        <span className="text-sm font-bold uppercase tracking-widest text-foreground/80">Timeline</span>
        {games.length > 0 && (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-xs text-muted-foreground/40">{games.length} game{games.length !== 1 ? "s" : ""}</span>
          </>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground/30 hidden md:block">
          Click <ChevronRight size={9} className="inline" /> on a period to nest into it
        </span>
      </header>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-muted-foreground/40 text-sm">Loading…</div>
        )}

        {!isLoading && games.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground/40">
            <p className="text-sm">No games yet.</p>
            <Link href="/" className="text-primary text-sm hover:underline">← Create a game</Link>
          </div>
        )}

        {!isLoading && games.length > 0 && (
          <div style={{ minWidth: LABEL_W + colW * games.length }}>

            {/* ── Sticky game-name header row ── */}
            <div className="flex sticky top-0 z-30 border-b border-border/30 bg-background/95 backdrop-blur">
              {/* Corner cell */}
              <div
                className="sticky left-0 z-40 bg-background/95 border-r border-border/20 flex items-end pb-2 pl-3"
                style={{ width: LABEL_W, minWidth: LABEL_W, height: 48 }}
              >
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/30 font-semibold">Period</span>
              </div>
              {/* Game columns */}
              {games.map(g => (
                <Link
                  key={g.id}
                  href={`/game/${g.id}/roadmap`}
                  className="border-l border-border/20 px-3 py-2 hover:bg-muted/10 transition-colors"
                  style={{ width: colW, minWidth: colW }}
                >
                  <div className="text-xs font-semibold text-foreground/80 truncate hover:text-primary transition-colors">{g.name}</div>
                  <div className="text-[10px] text-muted-foreground/35 mt-0.5 truncate">{g.mission?.slice(0, 40)}{(g.mission?.length ?? 0) > 40 ? "…" : ""}</div>
                </Link>
              ))}
            </div>

            {/* ── Time rows ── */}
            {rows.map((row, ri) => {
              if (row.kind === "now") {
                return <NowRow key="now" colCount={games.length} colW={colW} />;
              }

              const { node } = row;
              const nowTs_ = Date.now();
              const isPast = node.end.getTime() <= nowTs_;
              const timeColor = node.isCurrentPeriod
                ? "text-amber-300"
                : isPast
                ? "text-muted-foreground/30"
                : "text-muted-foreground/70";

              const isYearRow = node.granularity === "year";

              return (
                <div
                  key={node.id}
                  className={`flex border-b ${
                    isYearRow
                      ? "border-border/25 bg-card/8"
                      : node.isCurrentPeriod
                      ? "border-border/15 bg-amber-500/[0.025]"
                      : "border-border/10"
                  } ${ROW_MIN[node.granularity]}`}
                >
                  {/* ── Time label (sticky left) ── */}
                  <div
                    className={`sticky left-0 z-10 flex items-start gap-1 py-1.5 bg-background/95 border-r border-border/20 ${ROW_MIN[node.granularity]}`}
                    style={{ width: LABEL_W, minWidth: LABEL_W, paddingLeft: 10 + INDENT[node.depth] }}
                  >
                    {node.hasChildren ? (
                      <button
                        onClick={() => toggle(node.id)}
                        className="mt-0.5 shrink-0 text-muted-foreground/35 hover:text-primary transition-colors"
                        title={expanded.has(node.id) ? "Collapse" : "Expand"}
                      >
                        {expanded.has(node.id)
                          ? <ChevronDown size={11} />
                          : <ChevronRight size={11} />}
                      </button>
                    ) : (
                      <div style={{ width: 11 }} />
                    )}
                    <span className={`leading-tight ${FONT[node.granularity]} ${timeColor}`}>
                      {node.label}
                    </span>
                    {node.isCurrentPeriod && (
                      <span className="ml-1 inline-block w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0 animate-pulse" />
                    )}
                  </div>

                  {/* ── Game columns ── */}
                  {games.map((g, gi) => {
                    const cell = eventMaps[gi]?.get(node.id);
                    return (
                      <div
                        key={g.id}
                        className="border-l border-border/10 px-2"
                        style={{ width: colW, minWidth: colW }}
                      >
                        {cell && <EventCell milestones={cell.milestones} tasks={cell.tasks} />}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div style={{ height: 80 }} />
          </div>
        )}
      </div>
    </div>
  );
}
