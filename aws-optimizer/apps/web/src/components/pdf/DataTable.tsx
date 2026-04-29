import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  table: {
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cell: {
    padding: 6,
    fontSize: 8,
    color: "#374151",
  },
  headerCell: {
    padding: 6,
    fontSize: 8,
    fontWeight: "bold",
    color: "#1e293b",
  },
});

/* eslint-disable @typescript-eslint/no-explicit-any --
   Polymorphic PDF cell formatter API — callers declare their own value/row types in the lambda. */
interface Column {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
  render?: (value: any, row: any) => string;
  color?: (value: any, row: any) => string;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function DataTable({ columns, data }: DataTableProps) {
  return (
    <View style={styles.table}>
      <View style={styles.headerRow}>
        {columns.map((col) => (
          <Text
            key={col.key}
            style={[
              styles.headerCell,
              { flex: col.width ?? 1, textAlign: col.align ?? "left" },
            ]}
          >
            {col.label}
          </Text>
        ))}
      </View>
      {data.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={[styles.row, rowIndex % 2 === 1 ? { backgroundColor: "#fafbfc" } : {}]}
        >
          {columns.map((col) => {
            const rawValue = row[col.key];
            const displayValue = col.render ? col.render(rawValue, row) : String(rawValue ?? "");
            const textColor = col.color ? col.color(rawValue, row) : "#374151";
            return (
              <Text
                key={col.key}
                style={[
                  styles.cell,
                  {
                    flex: col.width ?? 1,
                    textAlign: col.align ?? "left",
                    color: textColor,
                    fontWeight: col.key === "name" || col.key === "account" ? "bold" : "normal",
                  },
                ]}
              >
                {displayValue}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}
