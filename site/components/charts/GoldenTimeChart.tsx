"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtYm, importPrice } from "@/lib/data";

/**
 * 같은 관측월을 두 통계가 어떻게 따라가는지 겹쳐 본다.
 * 두 계열 모두 202501=100 으로 맞춰 수준이 아니라 움직임을 비교한다.
 * 공표 시점 차이(골든타임)는 아래 ReleaseCalendar 가 일 단위로 따로 보여준다.
 */
export default function GoldenTimeChart() {
  const data = importPrice.lead_lag;

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 12, left: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="ym"
            tickFormatter={fmtYm}
            tick={{ fill: "#7c8aa5", fontSize: 11 }}
            stroke="rgba(255,255,255,0.12)"
            minTickGap={16}
          />
          <YAxis
            tick={{ fill: "#7c8aa5", fontSize: 11 }}
            stroke="rgba(255,255,255,0.12)"
            domain={["auto", "auto"]}
            width={48}
            label={{
              value: "지수 (202501=100)",
              angle: -90,
              position: "insideLeft",
              fill: "#5c6a85",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              background: "#1a2340",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `${fmtYm(String(v))} 관측분`}
            formatter={(value, name) => [
              typeof value === "number" ? value.toFixed(1) : "산출 불가",
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 18 }} iconType="plainline" />
          <Line
            type="monotone"
            dataKey="ecos_value"
            name={`한국은행 수입물가지수 (익월 +${importPrice.release_lag.ecos_days}일 공표)`}
            stroke="#f5a524"
            strokeWidth={2.2}
            dot={{ r: 2.5, fill: "#f5a524" }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="customs_value"
            name={`관세청 수입단가지수 (익월 +${importPrice.release_lag.customs_days}일 확인)`}
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 2.5, fill: "#94a3b8" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 관측월이 끝난 뒤 30일을 실제 비율대로 그려 공표 시차를 보여준다. */
export function ReleaseCalendar() {
  const { ecos_days, customs_days, golden_time_days } = importPrice.release_lag;
  const W = 900;
  const H = 132;
  const pad = 56;
  const span = 30; // 익월 30일치
  const x = (d: number) => pad + (d / span) * (W - pad * 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px] w-full">
        {/* 골든타임 구간 */}
        <rect
          x={x(ecos_days)}
          y={30}
          width={x(customs_days) - x(ecos_days)}
          height={40}
          fill="#2dd4bf"
          fillOpacity={0.16}
          stroke="#2dd4bf"
          strokeOpacity={0.5}
          strokeDasharray="4 4"
        />
        <text
          x={(x(ecos_days) + x(customs_days)) / 2}
          y={22}
          textAnchor="middle"
          fill="#2dd4bf"
          fontSize={12}
          fontWeight={600}
        >
          골든타임 {golden_time_days}일
        </text>

        {/* 기준선 */}
        <line x1={pad} y1={50} x2={W - pad} y2={50} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
        {[0, 5, 10, 15, 20, 25, 30].map((d) => (
          <g key={d}>
            <line x1={x(d)} y1={46} x2={x(d)} y2={54} stroke="rgba(255,255,255,0.2)" />
            <text x={x(d)} y={70} textAnchor="middle" fill="#5c6a85" fontSize={10}>
              +{d}일
            </text>
          </g>
        ))}

        {/* 관측월 종료 */}
        <circle cx={x(0)} cy={50} r={4} fill="#4b5871" />
        <text x={x(0)} y={94} textAnchor="middle" fill="#8b98ad" fontSize={11}>
          관측월 종료
        </text>

        {/* ECOS 공표 */}
        <circle cx={x(ecos_days)} cy={50} r={5.5} fill="#f5a524" />
        <text x={x(ecos_days)} y={94} textAnchor="middle" fill="#f5a524" fontSize={11} fontWeight={600}>
          수입물가지수 공표
        </text>
        <text x={x(ecos_days)} y={110} textAnchor="middle" fill="#7c8aa5" fontSize={10}>
          익월 초
        </text>

        {/* 관세청 확인 */}
        <circle cx={x(customs_days)} cy={50} r={5.5} fill="#94a3b8" />
        <text x={x(customs_days)} y={94} textAnchor="middle" fill="#c3ccdd" fontSize={11} fontWeight={600}>
          관세청 통계 확인
        </text>
        <text x={x(customs_days)} y={110} textAnchor="middle" fill="#7c8aa5" fontSize={10}>
          익월 중순
        </text>
      </svg>
    </div>
  );
}
