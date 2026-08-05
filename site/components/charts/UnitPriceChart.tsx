"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtYm } from "@/lib/data";

/** 관세청 원자료에서 계산한 월별 수입 단가(USD/톤). 42개월 실측 계열. */
export default function UnitPriceChart({
  series,
  height = 260,
}: {
  series: { ym: string; unit_price: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={series} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="ym"
            tickFormatter={fmtYm}
            tick={{ fill: "#7c8aa5", fontSize: 10 }}
            stroke="rgba(255,255,255,0.12)"
            minTickGap={24}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#7c8aa5", fontSize: 10 }}
            stroke="rgba(255,255,255,0.12)"
            width={60}
            tickFormatter={(v) => Number(v).toLocaleString("ko-KR")}
          />
          <Tooltip
            contentStyle={{
              background: "#1a2340",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `${fmtYm(String(v))} (관측월)`}
            formatter={(v) => [
              `${Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 0 })} USD/톤`,
              "수입 단가",
            ]}
          />
          <Line
            type="monotone"
            dataKey="unit_price"
            stroke="#57a6ff"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
