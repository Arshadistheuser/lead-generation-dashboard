"use client";

import { ResponsiveContainer } from "recharts";

interface ChartContainerProps {
  children: React.ReactElement;
  height?: number;
}

export function ChartContainer({ children, height = 300 }: ChartContainerProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}
