import { Link, useRoute } from "wouter";
import { useState, useEffect } from "react";
import { useLang, useValues } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Sparkles } from "lucide-react";

// ── Rotating Slogans Banner ───────────────────────────────────────────────────
function SlogansBanner() {
  const { values } = useValues();
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (values.length < 2) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % values.length);
        setVisible(true);
      }, 600);
    }, 4500);
    return () => clearInterval(interval);
  }, [values.length]);

  if (values.length === 0) return null;

  const slogan = values[idx % values.length];

  return (
    <div className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, rgba(6,9,20,0.95) 0%, rgba(6,13,25,0.85) 100%)", borderBottom: "1px solid rgba(96,165,250,0.08)" }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.3), rgba(167,139,250,0.3), transparent)" }} />
        {/* Tiny stars */}
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{ width: Math.random() * 1.5 + 0.5 + "px", height: Math.random() * 1.5 + 0.5 + "px",
              top: Math.random() * 100 + "%", left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.5 + 0.1 }} />
        ))}
      </div>
      <div className="relative flex items-center justify-center py-2 px-6 min-h-[32px]">
        <p
          className="text-[11px] tracking-[0.2em] text-center font-light select-none"
          style={{
            color: "rgba(147,197,253,0.7)",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.6s ease",
            textShadow: "0 0 20px rgba(96,165,250,0.5), 0 0 40px rgba(96,165,250,0.2)",
            letterSpacing: "0.18em",
          }}
        >
          {slogan}
        </p>
      </div>
    </div>
  );
}

// ── Values Manager Dialog ─────────────────────────────────────────────────────
function ValuesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { values, setValues } = useValues();
  const { t } = useLang();
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    setValues([...values, v]);
    setDraft("");
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            {t.manageValues}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{t.valuesHint}</p>
        <div className="flex gap-2 mt-1">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder={t.valuePlaceholder}
            className="text-sm"
          />
          <Button size="sm" onClick={add} className="gap-1 shrink-0">
            <Plus size={12} /> {t.addValue}
          </Button>
        </div>
        {values.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 text-center py-4">{t.noValues}</p>
        ) : (
          <ul className="flex flex-col gap-1.5 mt-1 max-h-56 overflow-y-auto">
            {values.map((v, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 group">
                <span className="text-sm text-foreground/80 flex-1">{v}</span>
                <button onClick={() => setValues(values.filter((_, j) => j !== i))}
                  className="text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Game Layout ───────────────────────────────────────────────────────────────
export default function GameLayout({ children }: { children?: React.ReactNode }) {
  const [, params] = useRoute("/game/:gameId/*?");
  const [, routeParams] = useRoute("/game/:gameId/:page");
  const gameId = params?.gameId;
  const page = routeParams?.page ?? "roadmap";
  const { lang, setLang, t } = useLang();
  const [valuesOpen, setValuesOpen] = useState(false);

  if (!gameId) return null;

  const navLinks = [
    { href: `/game/${gameId}/roadmap`,  label: t.roadmap, id: "roadmap" },
    { href: `/game/${gameId}/tasks`,    label: t.tasks,   id: "tasks" },
    { href: `/game/${gameId}/kpis`,     label: t.kpis,    id: "kpis" },
    { href: `/game/${gameId}/risks`,    label: t.risks,   id: "risks" },
    { href: `/game/${gameId}/players`,  label: t.crew,    id: "players" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Slogans banner */}
      <SlogansBanner />

      {/* Nav */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="px-6 h-14 flex items-center gap-6">
          <Link href="/" className="font-serif text-primary font-bold text-xl mr-4">SF</Link>
          <nav className="flex items-center gap-1 text-sm flex-1">
            {navLinks.map(link => (
              <Link key={link.id} href={link.href}
                className={`px-3 py-1.5 rounded-md transition-colors ${page === link.id || (link.id === "roadmap" && page === undefined) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: values + lang toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setValuesOpen(true)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted/30">
              <Sparkles size={11} />
              <span>{t.values}</span>
            </button>
            <div className="flex items-center rounded-md border border-border/40 overflow-hidden text-[11px]">
              <button onClick={() => setLang("en")}
                className={`px-2.5 py-1 transition-colors ${lang === "en" ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}>
                EN
              </button>
              <div className="w-px h-4 bg-border/40" />
              <button onClick={() => setLang("zh")}
                className={`px-2.5 py-1 transition-colors ${lang === "zh" ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}>
                中
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <ValuesDialog open={valuesOpen} onClose={() => setValuesOpen(false)} />
    </div>
  );
}
