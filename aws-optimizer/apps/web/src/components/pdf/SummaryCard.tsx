import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    minWidth: 120,
  },
  label: {
    fontSize: 7,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 9,
    marginTop: 2,
  },
});

interface SummaryCardProps {
  label: string;
  value: string;
  subtitle?: string;
  bgColor: string;
  textColor?: string;
}

export function SummaryCard({ label, value, subtitle, bgColor, textColor = "#ffffff" }: SummaryCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      <Text style={[styles.label, { color: textColor, opacity: 0.8 }]}>{label}</Text>
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: textColor, opacity: 0.7 }]}>{subtitle}</Text>
      )}
    </View>
  );
}
