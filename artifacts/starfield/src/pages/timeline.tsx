import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  useListGames,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  getListMilestonesQueryOptions,
  getListMilestonesQueryKey,
  getListTasksQueryOptions,
} from "@workspace/api-client-react";
import type { Milestone, Task } from "@workspace/api-client-react";
import {
  ChevronRight, ChevronDown, Flag, CheckSquare,
  LayoutGrid, Plus, Trash2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Constants ─────────────────────────────────────────────────────────────────
const MS_DAY  = 86_400_000;
const MS_WEEK = 7 * MS_DAY;
const MS_HOUR = 3_600_000;
const LABEL_W = 192;
const COL_MIN  = 180;
const COL_MAX  = 320;

// ── Types ─────────────────────────────────────────────────────────────────────
type Granularity = "year" | "quarter" | "month" | "week" | "day" | "hour";

interface TimeNode {
  id: string;
  granularity: Granularity;
  label: string;
  start: Date;
  end: Date;
  depth: number;
  hasChildren: boolean;
  isCurrentPeriod: boolean;
}

type SheetState =
  | { mode: "create"; node: TimeNode; gameId: number }
  | { mode: "edit";   node: TimeNode; gameId: number; milestone: Milestone }
  | null;

// ── Time-tree helpers ─────────────────────────────────────────────────────────
function weeksOfMonth(year: number, month: number) {
  const out: { start: Date; end: Date }[] = [];
  const d = new Date(year, month, 1);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
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
    rows.push({ id: yid, granularity: "year", label: `${yr}`, start: ys, end: ye, depth: 0, hasChildren: true, isCurrentPeriod: cur(ys, ye) });
    if (!expanded.has(yid)) continue;

    for (let q = 4; q >= 1; q--) {
      const qs = new Date(yr, (q - 1) * 3, 1), qe = new Date(yr, q * 3, 1);
      const qid = `${yr}-Q${q}`;
      rows.push({ id: qid, granularity: "quarter", label: `Q${q} ${yr}`, start: qs, end: qe, depth: 1, hasChildren: true, isCurrentPeriod: cur(qs, qe) });
      if (!expanded.has(qid)) continue;

      for (let m = q * 3 - 1; m >= (q - 1) * 3; m--) {
        const ms_ = new Date(yr, m, 1), me = new Date(yr, m + 1, 1);
        const mid = `${yr}-M${m + 1}`;
        rows.push({ id: mid, granularity: "month", label: ms_.toLocaleDateString("en-US", { month: "short" }), start: ms_, end: me, depth: 2, hasChildren: true, isCurrentPeriod: cur(ms_, me) });
        if (!expanded.has(mid)) continue;

        const wks = weeksOfMonth(yr, m);
        for (let wi = wks.length - 1; wi >= 0; wi--) {
          const { start: ws, end: we } = wks[wi];
          const wid = `${mid}-W${wi + 1}`;
          rows.push({ id: wid, granularity: "week", label: `Wk ${wi + 1}  ${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, start: ws, end: we, depth: 3, hasChildren: true, isCurrentPeriod: cur(ws, we) });
          if (!expanded.has(wid)) continue;

          for (let di = 6; di >= 0; di--) {
            const ds = new Date(ws.getTime() + di * MS_DAY);
            const de = new Date(ds.getTime() + MS_DAY);
            if (ds >= me || de <= ms_) continue;
            const did = `${yr}-${m + 1}-${ds.getDate()}`;
            rows.push({ id: did, granularity: "day", label: ds.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }), start: ds, end: de, depth: 4, hasChildren: true, isCurrentPeriod: cur(ds, de) });
            if (!expanded.has(did)) continue;

            for (let h = 23; h >= 0; h--) {
              const hs = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate(), h);
              rows.push({ id: `${did}-H${h}`, granularity: "hour", label: `${String(h).padStart(2, "0")}:00`, start: hs, end: new Date(hs.getTime() + MS_HOUR), depth: 5, hasChildren: false, isCurrentPeriod: cur(hs, new Date(hs.getTime() + MS_HOUR)) });
            }
          }
        }
      }
    }
  }
  return rows;
}

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

function fmtDate(s: string | null | undefined): string {
  if (!s) return "–";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── PDCA / status visual config ───────────────────────────────────────────────
const PDCA: Record<string, { label: string; dot: string; bg: string; text: string; badge: string }> = {
  planted:  { label: "Plan",  dot: "bg-sky-400",     bg: "bg-sky-500/12 border-sky-400/35",     text: "text-sky-300",    badge: "bg-sky-500/20 text-sky-300"    },
  growing:  { label: "Do",    dot: "bg-amber-400",   bg: "bg-amber-500/12 border-amber-400/35", text: "text-amber-300",  badge: "bg-amber-500/20 text-amber-300"  },
  blooming: { label: "Check", dot: "bg-orange-400",  bg: "bg-orange-500/12 border-orange-400/35", text: "text-orange-300", badge: "bg-orange-500/20 text-orange-300" },
  harvested:{ label: "Act",   dot: "bg-emerald-400", bg: "bg-emerald-500/12 border-emerald-400/35", text: "text-emerald-300", badge: "bg-emerald-500/20 text-emerald-300" },
};

const T_TEXT: Record<string, string> = {
  plan: "text-muted-foreground/50", doing: "text-amber-300",
  check: "text-orange-300", next_plan: "text-emerald-300",
};

const ROW_MIN: Record<Granularity, string> = {
  year: "min-h-[44px]", quarter: "min-h-[40px]", month: "min-h-[36px]",
  week: "min-h-[32px]", day: "min-h-[28px]", hour: "min-h-[24px]",
};
const FONT: Record<Granularity, string> = {
  year: "font-bold text-sm", quarter: "font-semibold text-xs", month: "text-xs",
  week: "text-[11px]", day: "text-[11px]", hour: "text-[10px]",
};
const INDENT = [0, 10, 20, 30, 40, 50];

// ── Sub-components ─────────────────────────────────────────────────────────────
function NowRow({ colCount, colW }: { colCount: number; colW: number }) {
  return (
    <div className="flex items-center relative z-10" style={{ height: 22 }}>
      <div className="sticky left-0 z-20 flex items-center justify-end pr-2 bg-background border-r border-border/20" style={{ width: LABEL_W, minWidth: LABEL_W, height: 22 }}>
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-400" style={{ textShadow: "0 0 12px rgba(251,191,36,1)" }}>NOW</span>
      </div>
      <div className="h-[2px]" style={{ width: colCount * colW, background: "linear-gradient(90deg, rgba(251,191,36,0.9) 0%, rgba(251,191,36,0.35) 60%, transparent 100%)", boxShadow: "0 0 8px rgba(251,191,36,0.4)" }} />
    </div>
  );
}

function MilestoneCard({ m, onEdit }: { m: Milestone; onEdit: (e: React.MouseEvent) => void }) {
  const s = PDCA[m.status] ?? PDCA.planted;
  const nowTs = Date.now();
  const planEnd = m.plannedEndDate ? new Date(m.plannedEndDate).getTime() : null;
  const actEnd  = m.actualEndDate  ? new Date(m.actualEndDate).getTime()  : null;
  const isOverdue = planEnd && planEnd < nowTs && m.status !== "harvested";

  return (
    <div
      onClick={onEdit}
      className={`group relative rounded border text-[10px] px-1.5 py-1 cursor-pointer hover:brightness-125 transition-all ${s.bg}`}
    >
      <div className="flex items-start gap-1">
        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <div className="min-w-0 flex-1">
          <div className={`font-medium truncate leading-tight ${s.text}`}>{m.title}</div>
          {/* PDCA badge + stars */}
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-[8px] uppercase font-bold px-1 rounded ${s.badge}`}>{s.label}</span>
            {m.starsValue > 0 && (
              <span className="text-[8px] text-amber-400/60">{"★".repeat(m.starsValue)}</span>
            )}
          </div>
          {/* Planned span */}
          {(m.plannedStartDate || m.plannedEndDate) && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[8px] text-sky-400/60 font-medium">P</span>
              <span className="text-[8px] text-muted-foreground/40 truncate">
                {fmtDate(m.plannedStartDate)} → {fmtDate(m.plannedEndDate)}
              </span>
            </div>
          )}
          {/* Actual span */}
          {(m.actualStartDate || m.actualEndDate) && (
            <div className="flex items-center gap-1">
              <span className={`text-[8px] font-medium ${isOverdue ? "text-red-400/70" : "text-emerald-400/60"}`}>A</span>
              <span className={`text-[8px] truncate ${isOverdue ? "text-red-300/50" : "text-emerald-300/40"}`}>
                {fmtDate(m.actualStartDate)} → {fmtDate(m.actualEndDate)}
              </span>
              {isOverdue && <span className="text-[8px] text-red-400/70">⚠</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Milestone form (inside Sheet) ─────────────────────────────────────────────
const EMPTY_FORM = { title: "", description: "", status: "planted", starsValue: "1", plannedStartDate: "", plannedEndDate: "", actualStartDate: "", actualEndDate: "" };

function MilestoneForm({ state, onClose, onSaved }: { state: SheetState; onClose: () => void; onSaved: () => void }) {
  if (!state) return null;
  const { node, gameId } = state;
  const existing = state.mode === "edit" ? state.milestone : null;

  const [form, setForm] = useState(() => ({
    title:           existing?.title           ?? "",
    description:     existing?.description     ?? "",
    status:          existing?.status          ?? "planted",
    starsValue:      String(existing?.starsValue ?? 1),
    plannedStartDate: existing?.plannedStartDate ?? (state.mode === "create" ? isoDate(node.start) : ""),
    plannedEndDate:   existing?.plannedEndDate   ?? (state.mode === "create" ? isoDate(new Date(node.end.getTime() - MS_DAY)) : ""),
    actualStartDate:  existing?.actualStartDate  ?? "",
    actualEndDate:    existing?.actualEndDate    ?? "",
  }));

  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListMilestonesQueryKey(gameId) });
  }, [qc, gameId]);

  const create = useCreateMilestone({ mutation: { onSuccess: () => { invalidate(); onSaved(); } } });
  const update = useUpdateMilestone({ mutation: { onSuccess: () => { invalidate(); onSaved(); } } });
  const remove = useDeleteMilestone({ mutation: { onSuccess: () => { invalidate(); onSaved(); } } });

  const busy = create.isPending || update.isPending || remove.isPending;

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  function handleSubmit() {
    const data = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status as Milestone["status"],
      starsValue: Math.max(1, Math.min(5, Number(form.starsValue))),
      targetDate: form.plannedStartDate || isoDate(node.start),
      plannedStartDate: form.plannedStartDate || undefined,
      plannedEndDate:   form.plannedEndDate   || undefined,
      actualStartDate:  form.actualStartDate  || undefined,
      actualEndDate:    form.actualEndDate    || undefined,
    };
    if (!data.title) return;
    if (state.mode === "create") {
      create.mutate({ gameId, data: { ...data, starsValue: data.starsValue } });
    } else {
      update.mutate({ gameId, milestoneId: state.milestone.id, data });
    }
  }

  function handleDelete() {
    if (state.mode !== "edit") return;
    remove.mutate({ gameId, milestoneId: state.milestone.id });
  }

  const s = PDCA[form.status] ?? PDCA.planted;

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Period info */}
      <div className="text-[10px] text-muted-foreground/40 bg-card/30 rounded px-2 py-1.5">
        Period: <span className="text-foreground/60">{node.label}</span>
        <span className="mx-1 text-border/50">·</span>
        <span className="text-foreground/40">{isoDate(node.start)} → {isoDate(new Date(node.end.getTime() - MS_DAY))}</span>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label className="text-xs">Title *</Label>
        <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Milestone name…" autoFocus />
      </div>

      {/* Status + Stars row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">PDCA Status</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger className={`text-xs ${s.text}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PDCA).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">
                  <span className={v.text}>{v.label}</span>
                  <span className="ml-1.5 text-muted-foreground/40 text-[10px]">({k})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Stars (1-5)</Label>
          <Select value={form.starsValue} onValueChange={v => set("starsValue", v)}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5].map(n => (
                <SelectItem key={n} value={String(n)} className="text-xs text-amber-400">{"★".repeat(n)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Plan frame */}
      <div className="space-y-2">
        <Label className="text-xs text-sky-400/80">Plan Frame</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground/50">Start</Label>
            <Input type="date" value={form.plannedStartDate} onChange={e => set("plannedStartDate", e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground/50">End</Label>
            <Input type="date" value={form.plannedEndDate} onChange={e => set("plannedEndDate", e.target.value)} className="text-xs" />
          </div>
        </div>
      </div>

      {/* Actual frame */}
      <div className="space-y-2">
        <Label className="text-xs text-emerald-400/80">Actual Frame</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground/50">Start</Label>
            <Input type="date" value={form.actualStartDate} onChange={e => set("actualStartDate", e.target.value)} className="text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground/50">End</Label>
            <Input type="date" value={form.actualEndDate} onChange={e => set("actualEndDate", e.target.value)} className="text-xs" />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Optional notes…" rows={2} className="text-xs resize-none" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={handleSubmit} disabled={!form.title.trim() || busy} className="flex-1 text-xs" size="sm">
          {busy ? "Saving…" : state.mode === "create" ? "Create" : "Save"}
        </Button>
        <Button variant="outline" onClick={onClose} size="sm" className="text-xs">Cancel</Button>
        {state.mode === "edit" && (
          <Button variant="ghost" onClick={handleDelete} disabled={busy} size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GlobalTimeline() {
  const { data: allGames = [], isLoading } = useListGames();

  // ── Year range (manually configurable) ──────────────────────────────────────
  const currYear = new Date().getFullYear();
  const [yearRange, setYearRange] = useState<[number, number]>([currYear - 1, currYear + 3]);

  // ── Game filter ──────────────────────────────────────────────────────────────
  // "all" shows top-level games; a gameId shows that game + its sub-games
  const [filterGameId, setFilterGameId] = useState<"all" | number>("all");

  const topLevelGames = useMemo(() => allGames.filter(g => !g.parentGameId), [allGames]);

  const visibleGames = useMemo(() => {
    if (filterGameId === "all") return topLevelGames;
    const parent = allGames.find(g => g.id === filterGameId);
    if (!parent) return topLevelGames;
    const children = allGames.filter(g => g.parentGameId === filterGameId);
    return [parent, ...children];
  }, [allGames, topLevelGames, filterGameId]);

  // ── Fetch milestones + tasks for all visible games ───────────────────────────
  const msResults = useQueries({ queries: visibleGames.map(g => getListMilestonesQueryOptions(g.id)) });
  const tkResults = useQueries({ queries: visibleGames.map(g => getListTasksQueryOptions(g.id)) });

  const gameData = useMemo(
    () => visibleGames.map((g, i) => ({
      game: g,
      milestones: (msResults[i]?.data ?? []) as Milestone[],
      tasks:      (tkResults[i]?.data ?? []) as Task[],
    })),
    [visibleGames, msResults, tkResults]
  );

  // ── Time tree ────────────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded);
  const toggle = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Extend year range if data falls outside
  const { y0, y1 } = useMemo(() => {
    let mn = yearRange[0], mx = yearRange[1];
    for (const { milestones, tasks } of gameData) {
      for (const m of milestones) {
        for (const d of [m.targetDate, m.plannedStartDate, m.plannedEndDate, m.actualStartDate, m.actualEndDate]) {
          if (d) { const y = new Date(d).getFullYear(); mn = Math.min(mn, y); mx = Math.max(mx, y); }
        }
      }
      for (const t of tasks) if (t.dueDate) { const y = new Date(t.dueDate).getFullYear(); mn = Math.min(mn, y); mx = Math.max(mx, y); }
    }
    return { y0: mn, y1: mx };
  }, [gameData, yearRange]);

  const nodes = useMemo(() => computeNodes(expanded, y0, y1), [expanded, y0, y1]);

  // ── Event maps per game: nodeId → {milestones, tasks} ────────────────────────
  const eventMaps = useMemo(() =>
    gameData.map(({ milestones, tasks }) => {
      const map = new Map<string, { milestones: Milestone[]; tasks: Task[] }>();
      const put = (id: string) => { if (!map.has(id)) map.set(id, { milestones: [], tasks: [] }); return map.get(id)!; };
      for (const m of milestones) {
        const dateStr = m.plannedStartDate || m.targetDate;
        if (dateStr) { const n = nodeFor(new Date(dateStr).getTime(), nodes); if (n) put(n.id).milestones.push(m); }
      }
      for (const t of tasks) {
        if (t.dueDate) { const n = nodeFor(new Date(t.dueDate).getTime(), nodes); if (n) put(n.id).tasks.push(t); }
      }
      return map;
    }),
    [gameData, nodes]
  );

  // ── NOW divider + flat rows ──────────────────────────────────────────────────
  const nowTs = Date.now();
  const rows = useMemo(() => {
    type Row = { kind: "now" } | { kind: "node"; node: TimeNode };
    const r: Row[] = [];
    let inserted = false;
    for (const node of nodes) {
      if (!inserted && node.end.getTime() <= nowTs) { r.push({ kind: "now" }); inserted = true; }
      r.push({ kind: "node", node });
    }
    if (!inserted) r.push({ kind: "now" });
    return r;
  }, [nodes, nowTs]);

  // ── CRUD sheet ────────────────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<SheetState>(null);
  const openCreate = useCallback((node: TimeNode, gameId: number) =>
    setSheet({ mode: "create", node, gameId }), []);
  const openEdit = useCallback((node: TimeNode, gameId: number, milestone: Milestone) =>
    setSheet({ mode: "edit", node, gameId, milestone }), []);
  const closeSheet = () => setSheet(null);

  // ── Column width ─────────────────────────────────────────────────────────────
  const colW = Math.max(COL_MIN, Math.min(COL_MAX,
    Math.floor((typeof window !== "undefined" ? window.innerWidth : 1280) - LABEL_W) / Math.max(1, visibleGames.length)
  ));

  return (
    <div className="flex flex-col bg-background text-foreground" style={{ height: "100vh" }}>

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-border/40 bg-card/40 backdrop-blur sticky top-0 z-40 flex items-center gap-3 px-5 h-14 flex-wrap">
        <Link href="/" className="font-serif text-primary font-bold text-xl shrink-0">SF</Link>
        <div className="w-px h-5 bg-border/30" />
        <LayoutGrid size={13} className="text-primary/60 shrink-0" />
        <span className="text-sm font-bold uppercase tracking-widest text-foreground/80 shrink-0">Timeline</span>

        <div className="w-px h-5 bg-border/20" />

        {/* Year range picker */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wide">Years</span>
          <Input
            type="number"
            value={yearRange[0]}
            onChange={e => setYearRange(p => [Number(e.target.value), p[1]])}
            className="w-16 h-7 text-xs text-center px-1"
            min={1900} max={yearRange[1]}
          />
          <span className="text-muted-foreground/30 text-xs">→</span>
          <Input
            type="number"
            value={yearRange[1]}
            onChange={e => setYearRange(p => [p[0], Number(e.target.value)])}
            className="w-16 h-7 text-xs text-center px-1"
            min={yearRange[0]} max={2100}
          />
        </div>

        <div className="w-px h-5 bg-border/20" />

        {/* Game filter */}
        {allGames.length > 0 && (
          <Select value={String(filterGameId)} onValueChange={v => setFilterGameId(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="All games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All top-level games</SelectItem>
              {allGames.map(g => (
                <SelectItem key={g.id} value={String(g.id)} className="text-xs">
                  {g.parentGameId ? "  ↳ " : ""}{g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground/25 hidden lg:block">
          Click › to expand a period · Click a cell to add a milestone · Click a milestone to edit
        </span>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto">
        {isLoading && <div className="flex items-center justify-center h-32 text-muted-foreground/40 text-sm">Loading…</div>}

        {!isLoading && allGames.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground/40">
            <p className="text-sm">No games yet.</p>
            <Link href="/" className="text-primary text-sm hover:underline">← Create a game</Link>
          </div>
        )}

        {!isLoading && visibleGames.length > 0 && (
          <div style={{ minWidth: LABEL_W + colW * visibleGames.length }}>

            {/* ── Game header row ── */}
            <div className="flex sticky top-0 z-30 border-b border-border/30 bg-background/95 backdrop-blur">
              <div className="sticky left-0 z-40 bg-background/95 border-r border-border/20 flex items-end pb-2 pl-3" style={{ width: LABEL_W, minWidth: LABEL_W, height: 52 }}>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground/25 font-semibold">Period</span>
              </div>
              {visibleGames.map(g => (
                <Link key={g.id} href={`/game/${g.id}/roadmap`}
                  className="border-l border-border/20 px-3 py-2 hover:bg-muted/10 transition-colors"
                  style={{ width: colW, minWidth: colW }}>
                  <div className="flex items-center gap-1">
                    {g.parentGameId && <span className="text-[8px] text-muted-foreground/30">↳</span>}
                    <span className="text-xs font-semibold text-foreground/80 truncate hover:text-primary transition-colors">{g.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/30 mt-0.5 truncate">{g.mission?.slice(0, 38)}{(g.mission?.length ?? 0) > 38 ? "…" : ""}</div>
                </Link>
              ))}
            </div>

            {/* ── Timeline rows ── */}
            {rows.map((row, ri) => {
              if (row.kind === "now") return <NowRow key="now" colCount={visibleGames.length} colW={colW} />;

              const { node } = row;
              const isPast = node.end.getTime() <= nowTs;
              const isYear = node.granularity === "year";
              const timeColor = node.isCurrentPeriod
                ? "text-amber-300"
                : isPast
                ? "text-muted-foreground/25"
                : "text-muted-foreground/65";
              const rowBg = isPast
                ? "bg-background"
                : node.isCurrentPeriod
                ? "bg-amber-500/[0.03]"
                : "";

              return (
                <div key={node.id} className={`flex border-b ${isYear ? "border-border/25 bg-card/8" : "border-border/8"} ${rowBg} ${ROW_MIN[node.granularity]}`}>

                  {/* Time label */}
                  <div
                    className={`sticky left-0 z-10 flex items-start gap-1 py-1.5 bg-background border-r border-border/20 ${ROW_MIN[node.granularity]} ${isPast ? "opacity-60" : ""}`}
                    style={{ width: LABEL_W, minWidth: LABEL_W, paddingLeft: 10 + INDENT[node.depth] }}
                  >
                    {node.hasChildren ? (
                      <button onClick={() => toggle(node.id)} className="mt-0.5 shrink-0 text-muted-foreground/30 hover:text-primary transition-colors" title={expanded.has(node.id) ? "Collapse" : "Expand"}>
                        {expanded.has(node.id) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                    ) : <div style={{ width: 11 }} />}
                    <span className={`leading-tight ${FONT[node.granularity]} ${timeColor}`}>{node.label}</span>
                    {node.isCurrentPeriod && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0 animate-pulse" />
                    )}
                  </div>

                  {/* Game columns */}
                  {visibleGames.map((g, gi) => {
                    const cell = eventMaps[gi]?.get(node.id);
                    const ms = cell?.milestones ?? [];
                    const ts = cell?.tasks ?? [];

                    return (
                      <div
                        key={g.id}
                        className={`border-l border-border/8 px-1.5 py-1 group/cell relative ${isPast ? "opacity-70" : ""}`}
                        style={{ width: colW, minWidth: colW }}
                      >
                        {/* Milestones */}
                        {ms.map(m => (
                          <div key={m.id} className="mb-0.5">
                            <MilestoneCard
                              m={m}
                              onEdit={e => { e.stopPropagation(); openEdit(node, g.id, m); }}
                            />
                          </div>
                        ))}
                        {/* Tasks */}
                        {ts.slice(0, 2).map(t => (
                          <div key={t.id} className={`flex items-center gap-1 text-[10px] truncate px-1.5 py-[2px] rounded border border-border/10 bg-card/20 mb-0.5 ${T_TEXT[t.status] ?? "text-muted-foreground/40"}`}>
                            <CheckSquare size={8} className="shrink-0" />
                            <span className="truncate">{t.title}</span>
                          </div>
                        ))}
                        {ts.length > 2 && <div className="text-[9px] text-muted-foreground/30 pl-1">+{ts.length - 2} tasks</div>}

                        {/* Add button (shows on hover) */}
                        <button
                          onClick={() => openCreate(node, g.id)}
                          className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 transition-opacity w-4 h-4 rounded flex items-center justify-center bg-primary/20 hover:bg-primary/40 text-primary"
                          title="Add milestone here"
                        >
                          <Plus size={9} />
                        </button>
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

      {/* ── CRUD Sheet ── */}
      <Sheet open={!!sheet} onOpenChange={open => { if (!open) closeSheet(); }}>
        <SheetContent className="w-80 sm:w-96 overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-sm flex items-center gap-2">
              <Flag size={14} className="text-primary" />
              {sheet?.mode === "create" ? "New Milestone" : "Edit Milestone"}
            </SheetTitle>
          </SheetHeader>
          <MilestoneForm state={sheet} onClose={closeSheet} onSaved={closeSheet} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
