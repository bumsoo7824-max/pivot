"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { blindspots } from "@/lib/data";

export default function TopCountryBar() {
  const total = blindspots.blindspot_count;
  const entries = Object.entries(blindspots.top_country_counts).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 12);
  const restCount = entries.slice(12).reduce((s, [, v]) => s + v, 0);
  const data = [
    ...top.map(([country, count]) => ({ country, count, share: count / total })),
    ...(restCount
      ? [{ country: `기타 ${entries.length - 12}개국`, count: restCount, share: restCount / total }]
      : []),
  ];

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 12 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#7c8aa5", fontSize: 11 }}
            stroke="rgba(255,255,255,0.12)"
          />
          <YAxis
            type="category"
            dataKey="country"
            width={96}
            tick={{ fill: "#c3ccdd", fontSize: 12 }}
            stroke="rgba(255,255,255,0.12)"
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#1a2340",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [`${v}개 품목`, "사각지대"]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.country} fill={d.country === "중국" ? "#f0526d" : "#3b4a6b"} />
            ))}
            <LabelList
              dataKey="share"
              position="right"
              formatter={(v: unknown) => `${((v as number) * 100).toFixed(1)}%`}
              style={{ fill: "#8b98ad", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
