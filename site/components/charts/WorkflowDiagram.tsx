"use client";

import { useState } from "react";
import type { WorkflowStep } from "@/lib/workflow-data";

const TONE_BOX: Record<string, string> = {
  gray: "border-white/15 bg-white/[0.03]",
  blue: "border-signal-blue/40 bg-signal-blue/10",
  red: "border-signal-red/40 bg-signal-red/10",
  amber: "border-signal-amber/40 bg-signal-amber/10",
  green: "border-signal-green/40 bg-signal-green/10",
};

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

const PAID_IDS = new Set([9, 10]);

function Box({ step, dimmed }: { step: WorkflowStep; dimmed: boolean }) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-3.5 transition ${TONE_BOX[step.tone]} ${
        dimmed ? "opacity-50 saturate-50" : ""
      }`}
    >
      <span className="font-mono text-sm text-slate-300">{CIRCLED[step.id - 1]}</span>
      <p className="mt-1.5 text-xs font-semibold leading-snug text-white">{step.title}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{step.summary}</p>
    </div>
  );
}

function Arrow({ dir = "right" }: { dir?: "right" | "down"; label?: string }) {
  if (dir === "down") {
    return (
      <div className="flex items-center justify-center py-0.5 text-slate-600 lg:hidden">
        <span className="text-lg">↓</span>
      </div>
    );
  }
  return (
    <div className="hidden items-center justify-center px-0.5 text-slate-600 lg:flex">
      <span className="text-lg">→</span>
    </div>
  );
}

export default function WorkflowDiagram({ steps }: { steps: WorkflowStep[] }) {
  const [mode, setMode] = useState<"full" | "mvp">("mvp");
  const byId = new Map(steps.map((s) => [s.id, s]));
  const row1 = [1, 2, 3, 4].map((id) => byId.get(id)!);
  const row2 = [5, 6, 7].map((id) => byId.get(id)!);
  const row3 = [8, 9, 10].map((id) => byId.get(id)!);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-slate-500">
          {mode === "mvp"
            ? "무료 MVP 범위(①~⑧)만 강조해서 봅니다 — ⑨⑩은 유료 버전 범위로 흐리게 표시됩니다."
            : "전체 10단계를 동일한 비중으로 봅니다 — ⑨⑩(빨간 점선)은 유료 버전 범위입니다."}
        </p>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs">
          <button
            onClick={() => setMode("mvp")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === "mvp" ? "bg-pivot-500/20 text-pivot-500" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            무료 MVP(①~⑧)
          </button>
          <button
            onClick={() => setMode("full")}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              mode === "full" ? "bg-pivot-500/20 text-pivot-500" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            전체(유료 포함)
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
        {/* row 1 */}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          {row1.map((s, i) => (
            <div key={s.id} className="contents">
              <Box step={s} dimmed={false} />
              {i < row1.length - 1 && <Arrow />}
            </div>
          ))}
        </div>

        <Arrow dir="down" />
        <div className="hidden justify-start pl-2 lg:flex">
          <span className="my-1 text-slate-600">↓</span>
        </div>

        {/* row 2 */}
        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {row2.map((s, i) => (
            <div key={s.id} className="contents">
              <Box step={s} dimmed={false} />
              {i < row2.length - 1 && <Arrow />}
            </div>
          ))}
        </div>
        <p className="mt-1 pl-1 text-[10px] text-slate-600">⑥에서 Yes 판정만 ⑦로 흘러갑니다(CANDIDATE·No는 종료).</p>

        <Arrow dir="down" />
        <div className="hidden justify-start pl-2 lg:flex">
          <span className="my-1 text-slate-600">↓</span>
        </div>

        {/* row 3 — ⑨⑩ paid */}
        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {row3.map((s, i) => {
            const isPaidStart = mode === "full" && s.id === 9;
            const box = (
              <Box key={s.id} step={s} dimmed={mode === "mvp" && PAID_IDS.has(s.id)} />
            );
            if (isPaidStart) {
              return (
                <div key={s.id} className="contents">
                  <div className="rounded-xl border-2 border-dashed border-signal-red/50 p-1">
                    {box}
                  </div>
                  {i < row3.length - 1 && <Arrow />}
                </div>
              );
            }
            if (mode === "full" && s.id === 10) {
              return (
                <div key={s.id} className="contents">
                  <div className="rounded-xl border-2 border-dashed border-signal-red/50 p-1">
                    {box}
                  </div>
                </div>
              );
            }
            return (
              <div key={s.id} className="contents">
                {box}
                {i < row3.length - 1 && <Arrow />}
              </div>
            );
          })}
        </div>
        {mode === "full" && (
          <p className="mt-2 text-[11px] font-medium text-signal-red">
            빨간 점선 = 유료 버전 범위 (⑨ 고객 노출 결합 · ⑩ 대체공급국·지원정책 연계)
          </p>
        )}
      </div>
    </div>
  );
}
