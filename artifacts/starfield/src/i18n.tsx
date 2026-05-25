import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "en" | "zh";

const T = {
  en: {
    // Nav
    roadmap: "Roadmap",
    tasks: "Tasks",
    kpis: "KPIs",
    risks: "Risks",
    crew: "Crew",
    // Roadmap
    roadmapSubtitle: (m: number, t: number) => `${m} milestones · ${t} tasks`,
    addMilestone: "Milestone",
    noMilestones: "No milestones yet.",
    plantFirst: "Plant First Milestone",
    plantMilestone: "Plant a Milestone",
    milestoneTitle: "Title",
    milestoneTitlePlaceholder: "What landmark will you reach?",
    milestoneDesc: "Description",
    milestoneDate: "Target Date",
    cancel: "Cancel",
    save: "Save",
    planted: "Planted",
    growing: "Growing",
    blooming: "Blooming",
    harvested: "Harvested",
    addTask: "Add Task",
    addFirstTask: "Add first task for this milestone",
    addTaskTitle: "Add a Task",
    taskTitle: "Title",
    taskTitlePlaceholder: "What needs to be done?",
    taskDesc: "Description",
    priority: "Priority",
    stakeholder: "Stakeholder",
    kpiImpact: "KPI Impact",
    unassigned: "Unassigned",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
    plan: "Plan",
    doing: "Doing",
    check: "Check",
    done: "Done",
    backlog: "Backlog — Unassigned",
    tasks_done: (d: number, t: number) => `${d}/${t}`,
    kpisForMilestone: "KPIs for this Milestone",
    addKpi: "Add KPI",
    noKpisLinked: "No KPIs linked yet. Add one to track progress.",
    kpiName: "KPI Name",
    kpiNamePlaceholder: "e.g. Monthly Active Users",
    kpiUnit: "Unit",
    kpiTarget: "Target",
    createKpi: "Create KPI",
    addKpiToMilestone: "Add KPI to Milestone",
    noneKpi: "None",
    status: "Status",
    editMilestone: "Edit milestone",
    values: "Values",
    manageValues: "Company Values",
    valuePlaceholder: "Enter a slogan or value...",
    addValue: "Add",
    noValues: "No values defined yet.",
    deleteValue: "Remove",
    valuesHint: "These rotate as glowing text at the top of the app.",
  },
  zh: {
    roadmap: "路线图",
    tasks: "任务",
    kpis: "关键指标",
    risks: "风险",
    crew: "团队",
    roadmapSubtitle: (m: number, t: number) => `${m} 个里程碑 · ${t} 个任务`,
    addMilestone: "里程碑",
    noMilestones: "暂无里程碑。",
    plantFirst: "创建第一个里程碑",
    plantMilestone: "创建里程碑",
    milestoneTitle: "名称",
    milestoneTitlePlaceholder: "将达到什么目标？",
    milestoneDesc: "描述",
    milestoneDate: "目标日期",
    cancel: "取消",
    save: "保存",
    planted: "已种下",
    growing: "成长中",
    blooming: "盛开",
    harvested: "已收获",
    addTask: "添加任务",
    addFirstTask: "为此里程碑添加第一个任务",
    addTaskTitle: "添加任务",
    taskTitle: "名称",
    taskTitlePlaceholder: "需要做什么？",
    taskDesc: "描述",
    priority: "优先级",
    stakeholder: "负责人",
    kpiImpact: "KPI 影响",
    unassigned: "未分配",
    low: "低",
    medium: "中",
    high: "高",
    critical: "紧急",
    plan: "计划",
    doing: "进行中",
    check: "检查",
    done: "完成",
    backlog: "待办 — 未关联里程碑",
    tasks_done: (d: number, t: number) => `${d}/${t}`,
    kpisForMilestone: "关联 KPI",
    addKpi: "添加 KPI",
    noKpisLinked: "暂无关联 KPI，请添加以跟踪进展。",
    kpiName: "KPI 名称",
    kpiNamePlaceholder: "例如：月活跃用户数",
    kpiUnit: "单位",
    kpiTarget: "目标值",
    createKpi: "创建 KPI",
    addKpiToMilestone: "为里程碑添加 KPI",
    noneKpi: "无",
    status: "状态",
    editMilestone: "编辑里程碑",
    values: "价值观",
    manageValues: "公司价值观",
    valuePlaceholder: "输入口号或价值观…",
    addValue: "添加",
    noValues: "暂无价值观。",
    deleteValue: "删除",
    valuesHint: "这些将作为发光文字在应用顶部循环展示。",
  },
} as const;

type Translations = typeof T.en;

const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}>({ lang: "en", setLang: () => {}, t: T.en });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("sf-lang") as Lang) ?? "en");
  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem("sf-lang", l); };
  return (
    <LangContext.Provider value={{ lang, setLang, t: T[lang] as Translations }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() { return useContext(LangContext); }

// ── Company Values / Slogans ──────────────────────────────────────────────────
const ValuesContext = createContext<{
  values: string[];
  setValues: (v: string[]) => void;
}>({ values: [], setValues: () => {} });

export function ValuesProvider({ gameId, children }: { gameId: string | number; children: ReactNode }) {
  const key = `sf-values-${gameId}`;
  const [values, setValuesState] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
  });
  const setValues = (v: string[]) => { setValuesState(v); localStorage.setItem(key, JSON.stringify(v)); };
  useEffect(() => {
    try { setValuesState(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch {}
  }, [key]);
  return <ValuesContext.Provider value={{ values, setValues }}>{children}</ValuesContext.Provider>;
}

export function useValues() { return useContext(ValuesContext); }
