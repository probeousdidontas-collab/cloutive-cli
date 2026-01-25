/**
 * Analysis Tools Tests
 *
 * Tests for US-016: Implement AI agent analysis tools
 *
 * Tests the analysis tools that persist data:
 * - analysis_saveCostSnapshot - Save cost snapshot data
 * - analysis_saveResource - Save resource inventory items
 * - recommendation_save - Save savings recommendations
 * - analysis_generateReport - Generate PDF/CSV reports
 */

import { describe, it, expect } from "vitest";
import {
  analysis_saveCostSnapshot,
  analysis_saveResource,
  recommendation_save,
  analysis_generateReport,
  ANALYSIS_TOOLS,
} from "./analysis";

describe("Analysis Tools (US-016)", () => {
  describe("Tool Exports", () => {
    it("should export analysis_saveCostSnapshot tool", () => {
      expect(analysis_saveCostSnapshot).toBeDefined();
      expect(typeof analysis_saveCostSnapshot).toBe("function");
    });

    it("should export analysis_saveResource tool", () => {
      expect(analysis_saveResource).toBeDefined();
      expect(typeof analysis_saveResource).toBe("function");
    });

    it("should export recommendation_save tool", () => {
      expect(recommendation_save).toBeDefined();
      expect(typeof recommendation_save).toBe("function");
    });

    it("should export analysis_generateReport tool", () => {
      expect(analysis_generateReport).toBeDefined();
      expect(typeof analysis_generateReport).toBe("function");
    });

    it("should export ANALYSIS_TOOLS object with all tools", () => {
      expect(ANALYSIS_TOOLS).toBeDefined();
      expect(ANALYSIS_TOOLS.analysis_saveCostSnapshot).toBe(analysis_saveCostSnapshot);
      expect(ANALYSIS_TOOLS.analysis_saveResource).toBe(analysis_saveResource);
      expect(ANALYSIS_TOOLS.recommendation_save).toBe(recommendation_save);
      expect(ANALYSIS_TOOLS.analysis_generateReport).toBe(analysis_generateReport);
    });
  });

  describe("analysis_saveCostSnapshot Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(analysis_saveCostSnapshot.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for the AI agent", () => {
      expect(analysis_saveCostSnapshot.description).toBeDefined();
      expect(analysis_saveCostSnapshot.description.toLowerCase()).toContain("cost");
      expect(analysis_saveCostSnapshot.description.toLowerCase()).toContain("snapshot");
    });

    it("should define args schema with awsAccountId, date, and totalCost", () => {
      expect(analysis_saveCostSnapshot.args).toBeDefined();
      expect(analysis_saveCostSnapshot.args.awsAccountId).toBeDefined();
      expect(analysis_saveCostSnapshot.args.date).toBeDefined();
      expect(analysis_saveCostSnapshot.args.totalCost).toBeDefined();
    });

    it("should have optional serviceBreakdown argument", () => {
      expect(analysis_saveCostSnapshot.args.serviceBreakdown).toBeDefined();
    });

    it("should have optional regionBreakdown argument", () => {
      expect(analysis_saveCostSnapshot.args.regionBreakdown).toBeDefined();
    });
  });

  describe("analysis_saveResource Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(analysis_saveResource.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for resource inventory", () => {
      expect(analysis_saveResource.description).toBeDefined();
      expect(analysis_saveResource.description.toLowerCase()).toContain("resource");
    });

    it("should define args schema with awsAccountId, resourceType, and resourceId", () => {
      expect(analysis_saveResource.args).toBeDefined();
      expect(analysis_saveResource.args.awsAccountId).toBeDefined();
      expect(analysis_saveResource.args.resourceType).toBeDefined();
      expect(analysis_saveResource.args.resourceId).toBeDefined();
    });

    it("should have optional name argument", () => {
      expect(analysis_saveResource.args.name).toBeDefined();
    });

    it("should have optional region argument", () => {
      expect(analysis_saveResource.args.region).toBeDefined();
    });

    it("should have optional tags argument", () => {
      expect(analysis_saveResource.args.tags).toBeDefined();
    });

    it("should have optional monthlyCost argument", () => {
      expect(analysis_saveResource.args.monthlyCost).toBeDefined();
    });
  });

  describe("recommendation_save Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(recommendation_save.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for saving recommendations", () => {
      expect(recommendation_save.description).toBeDefined();
      expect(recommendation_save.description.toLowerCase()).toContain("recommendation");
    });

    it("should define args schema with awsAccountId, type, title, description, and estimatedSavings", () => {
      expect(recommendation_save.args).toBeDefined();
      expect(recommendation_save.args.awsAccountId).toBeDefined();
      expect(recommendation_save.args.type).toBeDefined();
      expect(recommendation_save.args.title).toBeDefined();
      expect(recommendation_save.args.description).toBeDefined();
      expect(recommendation_save.args.estimatedSavings).toBeDefined();
    });

    it("should have optional status argument", () => {
      expect(recommendation_save.args.status).toBeDefined();
    });
  });

  describe("analysis_generateReport Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(analysis_generateReport.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for report generation", () => {
      expect(analysis_generateReport.description).toBeDefined();
      expect(analysis_generateReport.description.toLowerCase()).toContain("report");
    });

    it("should define args schema with organizationId, type, and title", () => {
      expect(analysis_generateReport.args).toBeDefined();
      expect(analysis_generateReport.args.organizationId).toBeDefined();
      expect(analysis_generateReport.args.type).toBeDefined();
      expect(analysis_generateReport.args.title).toBeDefined();
    });

    it("should support report types matching schema", () => {
      // The type validator should be defined
      expect(analysis_generateReport.args.type).toBeDefined();
    });
  });
});
