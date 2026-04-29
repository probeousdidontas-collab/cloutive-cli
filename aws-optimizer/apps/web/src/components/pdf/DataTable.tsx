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

type StringKey<TRow> = Extract<keyof TRow, string>;

// Discriminated union: each column variant binds `key` to the matching `value` type.
// This lets callers write `render: (v: number) => …` for a numeric column without casts.
export type Column<TRow> = {
  [K in StringKey<TRow>]: {
    key: K;
    label: string;
    width?: number;
    align?: "left" | "right" | "center";
    render?: (value: TRow[K], row: TRow) => string;
    color?: (value: TRow[K], row: TRow) => string;
  };
}[StringKey<TRow>];

interface DataTableProps<TRow> {
  columns: Column<TRow>[];
  data: TRow[];
}

export function DataTable<TRow>({ columns, data }: DataTableProps<TRow>) {
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
            // The mapped union correlates `col.key` to the value type per variant,
            // but TS can't carry that correlation through `row[col.key]` here —
            // erase to a single concrete shape for the call.
            type AnyKeyCol = {
              key: StringKey<TRow>;
              width?: number;
              align?: "left" | "right" | "center";
              render?: (value: TRow[StringKey<TRow>], row: TRow) => string;
              color?: (value: TRow[StringKey<TRow>], row: TRow) => string;
            };
            const c = col as AnyKeyCol;
            const rawValue = row[c.key];
            const displayValue = c.render ? c.render(rawValue, row) : String(rawValue ?? "");
            const textColor = c.color ? c.color(rawValue, row) : "#374151";
            return (
              <Text
                key={c.key}
                style={[
                  styles.cell,
                  {
                    flex: c.width ?? 1,
                    textAlign: c.align ?? "left",
                    color: textColor,
                    fontWeight: c.key === "name" || c.key === "account" ? "bold" : "normal",
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
