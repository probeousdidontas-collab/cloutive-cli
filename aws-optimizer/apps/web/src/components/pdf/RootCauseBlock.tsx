import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

interface UsageTypeCost {
  name: string;
  previousCost: number;
  currentCost: number;
  change: number;
}

interface RootCauseService {
  serviceName: string;
  previousCost: number;
  currentCost: number;
  change: number;
  usageTypes: UsageTypeCost[];
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 8,
  },
  serviceBlock: {
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    padding: 8,
    borderRadius: 4,
  },
  serviceName: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 2,
  },
  costChange: {
    fontSize: 8,
    color: "#374151",
    marginBottom: 4,
  },
  usageType: {
    marginLeft: 8,
    marginBottom: 2,
    borderLeftWidth: 2,
    borderLeftColor: "#fca5a5",
    paddingLeft: 6,
  },
  usageTypeName: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
  },
  usageTypeCost: {
    fontSize: 7,
    color: "#6b7280",
  },
});

interface RootCauseBlockProps {
  services: RootCauseService[];
}

export function RootCauseBlock({ services }: RootCauseBlockProps) {
  if (services.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Root Cause Analysis - Top Cost Increases</Text>
      {services.map((svc, i) => (
        <View key={i} style={styles.serviceBlock}>
          <Text style={styles.serviceName}>{svc.serviceName}</Text>
          <Text style={styles.costChange}>
            Cost Change: ${svc.previousCost.toLocaleString()} → ${svc.currentCost.toLocaleString()} (+${svc.change.toLocaleString()})
          </Text>
          {svc.usageTypes.map((ut, j) => (
            <View key={j} style={styles.usageType}>
              <Text style={styles.usageTypeName}>{ut.name}</Text>
              <Text style={styles.usageTypeCost}>
                Cost: ${ut.previousCost.toLocaleString()} → ${ut.currentCost.toLocaleString()} (+${ut.change.toLocaleString()})
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
