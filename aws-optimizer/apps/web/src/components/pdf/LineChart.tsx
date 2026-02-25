import { View, Text, StyleSheet, Svg, Line, Circle } from "@react-pdf/renderer";

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
});

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  title?: string;
  width?: number;
  height?: number;
  color?: string;
}

export function LineChart({
  data,
  title,
  width = 450,
  height = 150,
  color = "#6366f1",
}: LineChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = 0;
  const valueRange = maxValue - minValue || 1;

  const getX = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - ((val - minValue) / valueRange) * chartHeight;

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minValue + (valueRange * (4 - i)) / 4;
    return { value: Math.round(val), y: getY(val) };
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

        {/* Connecting lines between points */}
        {data.length > 1 &&
          data.slice(1).map((d, i) => (
            <Line
              key={`line-${i}`}
              x1={getX(i)}
              y1={getY(data[i].value)}
              x2={getX(i + 1)}
              y2={getY(d.value)}
              stroke={color}
              strokeWidth={2}
            />
          ))}

        {/* Data points */}
        {data.map((d, i) => (
          <Circle
            key={`point-${i}`}
            cx={getX(i)}
            cy={getY(d.value)}
            r={3}
            fill={color}
          />
        ))}
      </Svg>
      {/* X-axis labels rendered outside SVG for reliable text */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: padding.left, marginTop: -5 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ fontSize: 7, color: "#6b7280", textAlign: "center" }}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}
