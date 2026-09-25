// 뉴스 조기경보 워크플로우 전용 데이터 모듈. site/lib/data.ts(기존 9개 페이지가 쓰는 파일)는
// 건드리지 않는다 — 이 파일은 workflow.json 하나만 읽고, /workflow 페이지에서만 import된다.
import workflowJson from "@data/workflow.json";

export type StepTone = "gray" | "blue" | "red" | "amber" | "green";
export type StepStatus = "done" | "partial" | "reference_only" | "planned";

export type WorkflowStep = {
  id: number;
  title: string;
  tone: StepTone;
  status: StepStatus;
  summary: string;
  detail: string | null;
};

export type RecallRound = {
  round: string;
  dataset: string;
  recall: number;
  note: string;
};

export type RoundMiss = { cause: string; count: number };

export type LiveCounters = {
  as_of: string;
  generated_at: string;
  cumulative: { total_events: number; total_relevant: number; total_candidate: number };
  today: { new_events: number; new_relevant: number; new_candidate: number };
  last_runs: {
    run_at: string;
    source: string;
    fetched: number;
    new: number;
    new_relevant: number;
    err: string | null;
  }[];
} | null;

export const workflow = workflowJson as unknown as {
  as_of: string;
  generated_at: string;
  source: string;
  steps: WorkflowStep[];
  recall_rounds: RecallRound[];
  round12_misses: RoundMiss[];
  operations: {
    schedule: string;
    field_run_window: string;
    niche_miss_policy: string;
  };
  next_tasks: string[];
  live: LiveCounters;
};

export const STATUS_META: Record<StepStatus, { label: string; cls: string }> = {
  done: { label: "완료", cls: "border-signal-green/40 bg-signal-green/10 text-signal-green" },
  partial: { label: "부분 완료", cls: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber" },
  reference_only: { label: "참고용", cls: "border-white/15 bg-white/5 text-slate-400" },
  planned: { label: "예정", cls: "border-pivot-500/40 bg-pivot-500/10 text-pivot-500" },
};

export const TONE_RING: Record<StepTone, string> = {
  gray: "border-slate-400/30",
  blue: "border-signal-blue/40",
  red: "border-signal-red/40",
  amber: "border-signal-amber/40",
  green: "border-signal-green/40",
};

export const TONE_DOT: Record<StepTone, string> = {
  gray: "bg-slate-300",
  blue: "bg-signal-blue",
  red: "bg-signal-red",
  amber: "bg-signal-amber",
  green: "bg-signal-green",
};
