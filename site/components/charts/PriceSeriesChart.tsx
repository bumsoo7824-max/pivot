"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtYm } from "@/lib/data";

type Row = { ym: string; value: number | null; mom?: number | null };

/** 한국은행 수입물가지수 월별 계열. 일일 가격이 아니다. */
export default function PriceSeriesChart({
  series,
  color = "#f5a524",
  height = 240,
  label = "수입물가지수",
}: {
  series: Row[];
  color?: string;
  height?: number;
  label?: string;
}) {
  const gradId = `grad-${label.replace(/\W/g, "")}-${color.slice(1)}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="ym"
            tickFormatter={fmtYm}
            tick={{ fill: "#7c8aa5", fontSize: 10 }}
            stroke="rgba(255,255,255,0.12)"
            minTickGap={18}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#7c8aa5", fontSize: 10 }}
            stroke="rgba(255,255,255,0.12)"
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "#1a2340",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `${fmtYm(String(v))} (관측월)`}
            formatter={(v) => [typeof v === "number" ? v.toFixed(2) : "산출 불가", label]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
