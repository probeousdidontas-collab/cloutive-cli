import React from "react";
import { View, Text, StyleSheet, Svg, Rect, Line } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 8,
    backgroundColor: "#fafbfc",
    borderRadius: 4,
  },
  title: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    marginBottom: 2,
  },
  legendText: {
    fontSize: 6,
    color: "#6b7280",
  },
});

const COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#3b82f6", "#06b6d4",
  "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#84cc16",
];

interface StackedBarChartProps {
  data: Array<{ month: string; accounts: Record<string, number>; total: number }>;
  title?: string;
  width?: number;
  height?: number;
}

export function StackedBarChart({
  data,
  title,
  width = 450,
  height = 200,
}: StackedBarChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 20, bottom: 10, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Get all unique account names in order
  const allAccounts = new Set<string>();
  for (const d of data) {
    for (const key of Object.keys(d.accounts)) {
      allAccounts.add(key);
    }
  }
  const accountNames = Array.from(allAccounts);

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const barWidth = (chartWidth / data.length) * 0.7;
  const barGap = (chartWidth / data.length) * 0.3;

  const getX = (i: number) => padding.left + i * (barWidth + barGap) + barGap / 2;
  const getBarHeight = (val: number) => (val / maxTotal) * chartHeight;

  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = (maxTotal * (4 - i)) / 4;
    return { value: Math.round(val), y: padding.top + (i / 4) * chartHeight };
  });

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <Line
            key={`grid-${i}`}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
        ))}

        {/* Stacked bars */}
        {data.map((d, monthIdx) => {
          let yOffset = 0;
          return accountNames.map((accName, accIdx) => {
            const value = d.accounts[accName] || 0;
            if (value === 0) return null;
            const barH = getBarHeight(value);
            const y = padding.top + chartHeight - yOffset - barH;
            yOffset += barH;
            return (
              <Rect
                key={`bar-${monthIdx}-${accIdx}`}
                x={getX(monthIdx)}
                y={y}
                width={barWidth}
                height={Math.max(barH, 0.5)}
                fill={COLORS[accIdx % COLORS.length]}
              />
            );
          });
        })}
      </Svg>

      {/* X-axis labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: padding.left }}>
        {data.map((d, i) => (
          <Text key={i} style={{ fontSize: 7, color: "#6b7280", textAlign: "center" }}>{d.month}</Text>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        {accountNames.slice(0, 10).map((name, i) => (
          <View key={name} style={styles.legendItem}>
            <View style={{ width: 8, height: 8, backgroundColor: COLORS[i % COLORS.length], borderRadius: 1, marginRight: 3 }} />
            <Text style={styles.legendText}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
