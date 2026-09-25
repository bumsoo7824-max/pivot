"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RecallRound } from "@/lib/workflow-data";

/** 라운드별 이벤트 수준 재현율(%) — 검증셋이 바뀔 때마다 숫자가 크게 달라진다는 게
 * 이 프로젝트의 핵심 교훈이라, 라운드 순서 그대로(가로축) 막대로 보여준다. */
export default function RecallRoundsChart({ rounds }: { rounds: RecallRound[] }) {
  const data = rounds.map((r) => ({ ...r, label: `R${r.round}` }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#7c8aa5", fontSize: 11 }}
            stroke="rgba(255,255,255,0.12)"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#7c8aa5", fontSize: 11 }}
            stroke="rgba(255,255,255,0.12)"
            width={36}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              background: "#1a2340",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.dataset ?? ""}
            formatter={(value, _name, item) => [
              `${value}% — ${item.payload.note}`,
              "재현율",
            ]}
          />
          <Bar dataKey="recall" radius={[4, 4, 0, 0]} fill="#2dd4bf" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
