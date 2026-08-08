"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { allDetailHs4, blindspots, fmtPct, fmtUsd, type BlindspotPoint } from "@/lib/data";

const SECTORS = Object.keys(blindspots.sector_counts);
const HAS_DETAIL = new Set(allDetailHs4());

export default function BlindspotScatter() {
  const router = useRouter();
  const [sector, setSector] = useState<string>("전체");

  const goToItem = (payload?: BlindspotPoint) => {
    if (payload && HAS_DETAIL.has(payload.hs4)) router.push(`/items/${payload.hs4}/`);
  };

  const points = useMemo(
    () =>
      blindspots.points
        .filter((p) => sector === "전체" || p.sector === sector)
        .map((p) => ({ ...p, z: Math.max(1, Math.log10(p.import_usd))})),
    [sector],
  );

  const blind = points.filter((p) => p.is_blindspot && !p.gov_managed);
  const gov = points.filter((p) => p.gov_managed);
  const below = points.filter((p) => !p.is_blindspot && !p.gov_managed);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["전체", ...SECTORS].map((s) => (
          <button
            key={s}
            onClick={() => setSector(s)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              sector === s
                ? "border-pivot-500/50 bg-pivot-600/20 text-pivot-500"
                : "border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {s}
            {s !== "전체" && (
              <span className="ml-1.5 font-mono text-[10px] text-slate-500">
                {blindspots.sector_counts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="h-[460px] w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 12, right: 20, bottom: 32, left: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />
            <XAxis
              type="number"
              dataKey="hhi"
              name="HHI"
              domain={[0, 1]}
              tick={{ fill: "#7c8aa5", fontSize: 11 }}
              stroke="rgba(255,255,255,0.12)"
              label={{
                value: "HHI (수입 집중도)",
                position: "insideBottom",
                offset: -20,
                fill: "#5c6a85",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="top_share"
              name="1위국 비중"
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              tick={{ fill: "#7c8aa5", fontSize: 11 }}
              stroke="rgba(255,255,255,0.12)"
              width={52}
              label={{
                value: "1위국 비중",
                angle: -90,
                position: "insideLeft",
                fill: "#5c6a85",
                fontSize: 11,
              }}
            />
            <ZAxis type="number" dataKey="z" range={[24, 220]} />
            <ReferenceLine
              x={blindspots.reference_lines.hhi}
              stroke="#f0526d"
              strokeDasharray="5 4"
              strokeOpacity={0.7}
              label={{
                value: `참조선 HHI ${blindspots.reference_lines.hhi}`,
                position: "top",
                fill: "#f0526d",
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={blindspots.reference_lines.top_share}
              stroke="#f0526d"
              strokeDasharray="5 4"
              strokeOpacity={0.7}
              label={{
                value: `참조선 1위국 비중 ${blindspots.reference_lines.top_share}`,
                position: "insideBottomRight",
                fill: "#f0526d",
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.2)" }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as (BlindspotPoint & { z: number }) | undefined;
                if (!p) return null;
                return (
                  <div className="max-w-xs rounded-lg border border-white/15 bg-ink-700/95 p-3 text-xs shadow-xl">
                    <p className="font-mono text-[11px] text-pivot-500">HS {p.hs4}</p>
                    <p className="mt-1 font-semibold leading-snug text-white">{p.name}</p>
                    <dl className="mt-2 space-y-0.5 text-slate-300">
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">HHI</dt>
                        <dd className="font-mono">{p.hhi.toFixed(4)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">1위국</dt>
                        <dd>
                          {p.top_country} {fmtPct(p.top_share)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">수입액</dt>
                        <dd className="font-mono">{fmtUsd(p.import_usd)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">업종</dt>
                        <dd>{p.sector ?? "미상"}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-slate-500">
                      {p.gov_managed
                        ? "핵심전략기술 연계 추정 — 정부 관리 품목"
                        : p.is_blindspot
                          ? `사각지대 원본 목록 · 위험등급 ${p.grade ?? "미상"}`
                          : "사각지대 목록 밖"}
                    </p>
                    {HAS_DETAIL.has(p.hs4) && (
                      <p className="mt-1.5 text-[11px] font-medium text-pivot-500">
                        클릭하면 품목 상세로 이동 →
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Scatter
              name="사각지대"
              data={blind}
              fill="#2dd4bf"
              fillOpacity={0.75}
              isAnimationActive={false}
              onClick={(d) => goToItem(d as unknown as BlindspotPoint)}
              style={{ cursor: "pointer" }}
            >
              {blind.map((p) => (
                <Cell
                  key={p.hs4}
                  fill={p.top_country === "중국" ? "#f0526d" : "#2dd4bf"}
                  fillOpacity={0.72}
                />
              ))}
            </Scatter>
            <Scatter
              name="사각지대 목록 밖"
              data={below}
              fill="#4b5871"
              fillOpacity={0.5}
              isAnimationActive={false}
              onClick={(d) => goToItem(d as unknown as BlindspotPoint)}
              style={{ cursor: "pointer" }}
            />
            <Scatter
              name="정부 관리 품목 추정"
              data={gov}
              fill="#94a3b8"
              fillOpacity={0.85}
              shape="cross"
              isAnimationActive={false}
              onClick={(d) => goToItem(d as unknown as BlindspotPoint)}
              style={{ cursor: "pointer" }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-slate-500">
        <span>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-signal-red align-middle" />
          사각지대 · 1위국 중국 {blind.filter((p) => p.top_country === "중국").length}
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-pivot-500 align-middle" />
          사각지대 · 그 외 국가 {blind.filter((p) => p.top_country !== "중국").length}
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-slate-600 align-middle" />
          사각지대 목록 밖 {below.length}
        </span>
        <span>
          <span className="mr-1.5 align-middle text-slate-400">✛</span>
          정부 관리 품목 추정 {gov.length}
        </span>
        <span>원 크기 = 수입액(로그 스케일)</span>
      </div>
    </div>
  );
}
