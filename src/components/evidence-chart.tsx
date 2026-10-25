"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export function EvidenceChart({
  data,
  vertical = false,
}: {
  data: { name: string; count: number }[];
  vertical?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout={vertical ? "vertical" : "horizontal"}
        margin={{ left: 10, right: 20 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={!vertical}
          vertical={vertical}
        />
        <XAxis
          type={vertical ? "number" : "category"}
          dataKey={vertical ? undefined : "name"}
          allowDecimals={false}
        />
        <YAxis
          type={vertical ? "category" : "number"}
          dataKey={vertical ? "name" : undefined}
          width={vertical ? 130 : 40}
          allowDecimals={false}
          tick={{ fontSize: 11 }}
        />
        <Tooltip />
        <Bar
          dataKey="count"
          fill={vertical ? "#547968" : "#80988b"}
          radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
