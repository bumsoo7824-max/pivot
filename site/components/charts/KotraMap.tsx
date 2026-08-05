"use client";

import { useState } from "react";
import { kotraMap } from "@/lib/data";

const W = 960;
const H = 460;

// 등장방형도법. 좌표는 국가 중심점 근사값이라 마커 위치는 개략적이다.
const project = (lat: number, lon: number) => ({
  x: ((lon + 180) / 360) * W,
  y: ((90 - lat) / 180) * H,
});

export default function KotraMap({ highlight = [] }: { highlight?: string[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...kotraMap.countries.map((c) => c.count));
  const r = (n: number) => 3 + Math.sqrt(n / max) * 26;
  const active = kotraMap.countries.find((c) => c.name === hover);

  return (
    <div>
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[680px] w-full">
          {/* 경위도 격자 — 배경 지도 대신 위치 감각만 준다 */}
          <g stroke="rgba(255,255,255,0.07)" strokeWidth={1}>
            {[-120, -60, 0, 60, 120].map((lon) => (
              <line key={lon} x1={project(0, lon).x} y1={0} x2={project(0, lon).x} y2={H} />
            ))}
            {[60, 30, 0, -30, -60].map((lat) => (
              <line key={lat} x1={0} y1={project(lat, 0).y} x2={W} y2={project(lat, 0).y} />
            ))}
          </g>
          <line
            x1={0}
            y1={project(0, 0).y}
            x2={W}
            y2={project(0, 0).y}
            stroke="rgba(255,255,255,0.16)"
            strokeDasharray="4 6"
          />

          {kotraMap.countries.map((c) => {
            const { x, y } = project(c.lat, c.lon);
            const isHi = highlight.includes(c.name);
            const isHover = hover === c.name;
            return (
              <g key={c.name} onMouseEnter={() => setHover(c.name)} onMouseLeave={() => setHover(null)}>
                <circle
                  cx={x}
                  cy={y}
                  r={r(c.count)}
                  fill={isHi ? "#2dd4bf" : "#57a6ff"}
                  fillOpacity={isHover ? 0.55 : isHi ? 0.38 : 0.2}
                  stroke={isHi ? "#2dd4bf" : "#57a6ff"}
                  strokeOpacity={isHi ? 0.9 : 0.45}
                  strokeWidth={isHi ? 1.6 : 1}
                  className="cursor-pointer transition-all"
                />
                {(c.count > 900 || isHi) && (
                  <text
                    x={x}
                    y={y - r(c.count) - 5}
                    textAnchor="middle"
                    className="pointer-events-none"
                    fill={isHi ? "#2dd4bf" : "#9fb0c9"}
                    fontSize={11}
                  >
                    {c.name} {c.count.toLocaleString("ko-KR")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
        <span>원 크기 = 해외법인 수</span>
        {highlight.length > 0 && (
          <span>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-pivot-500 align-middle" />
            대체 공급국 후보
          </span>
        )}
        <span className="text-slate-600">
          마커 위치는 국가 중심점 근사값이며 국경선을 그리지 않는다
        </span>
        {active && (
          <span className="ml-auto rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
            {active.name} · {active.region} · 해외법인{" "}
            <b className="font-mono text-white">{active.count.toLocaleString("ko-KR")}</b>사
          </span>
        )}
      </div>
    </div>
  );
}
