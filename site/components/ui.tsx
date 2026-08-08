import type { ReactNode } from "react";
import type { Grade } from "@/lib/data";

export function PageHeader({
  step,
  title,
  lead,
  children,
}: {
  step: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <p className="kicker">{step}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
      {lead && <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-400">{lead}</p>}
      {children}
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {hint && <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "red" | "amber" | "pivot";
}) {
  const toneClass = {
    default: "text-white",
    red: "text-signal-red",
    amber: "text-signal-amber",
    pivot: "text-pivot-500",
  }[tone];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`stat-value mt-1 ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}

const GRADE_STYLE: Record<Grade, string> = {
  RED: "border-signal-red/40 bg-signal-red/10 text-signal-red",
  YELLOW: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
  GREEN: "border-signal-green/40 bg-signal-green/10 text-signal-green",
};

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span className={`chip ${GRADE_STYLE[grade]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {grade}
    </span>
  );
}

/**
 * 데이터가 없는 항목. 0을 대입하지 않고 사유와 함께 '산출 불가'로 표기한다.
 */
export function Unavailable({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-4 py-3">
      <p className="text-sm font-semibold text-slate-300">산출 불가</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{reason}</p>
    </div>
  );
}

export function SourceTag({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
      <span className="text-slate-400">출처 · </span>
      {children}
    </p>
  );
}
