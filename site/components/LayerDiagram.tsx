import { meta } from "@/lib/data";

const TONE = [
  { ring: "border-slate-400/30", dot: "bg-slate-300", text: "text-slate-300" },
  { ring: "border-signal-amber/40", dot: "bg-signal-amber", text: "text-signal-amber" },
  { ring: "border-signal-blue/40", dot: "bg-signal-blue", text: "text-signal-blue" },
  { ring: "border-pivot-500/40", dot: "bg-pivot-500", text: "text-pivot-500" },
];

/** 서비스의 3계층(+실행) 데이터 구조. 화면 어디서든 이 순서가 드러나야 한다. */
export default function LayerDiagram() {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {meta.layers.map((l, i) => {
        const t = TONE[i];
        return (
          <li key={l.tier} className={`relative rounded-xl border ${t.ring} bg-ink-800/60 p-4`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${t.dot}`} />
              <span className={`text-xs font-semibold tracking-wide ${t.text}`}>{l.tier}</span>
              <span className="ml-auto font-mono text-[11px] text-slate-600">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug text-white">{l.source}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{l.role}</p>
            <p className="mt-3 border-t border-white/10 pt-2 font-mono text-[11px] text-slate-500">
              {l.detail}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** 경보 발령 순서. 세 계층 임계값을 모두 넘을 때만 경보가 뜬다. */
export function AlertFlow({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {steps.map((s, i) => (
        <li
          key={s}
          className="flex flex-1 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-3"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-[11px] text-slate-300">
            {i + 1}
          </span>
          <span className="text-xs leading-snug text-slate-300">{s}</span>
        </li>
      ))}
    </ol>
  );
}
