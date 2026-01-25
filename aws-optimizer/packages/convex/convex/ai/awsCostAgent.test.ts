/**
 * AWS Cost Agent Tests
 *
 * Tests for US-014: Set up AI Agent with OpenRouter
 *
 * Tests the awsCostAgent configuration:
 * - Agent is properly configured with OpenRouter
 * - System instructions are comprehensive
 * - maxSteps is set to 100
 * - Agent is exported for use in chat handlers
 */

import { describe, it, expect } from "vitest";
import { awsCostAgent, AWS_COST_AGENT_CONFIG } from "./awsCostAgent";

describe("AWS Cost Agent Configuration (US-014)", () => {
  describe("Agent Configuration", () => {
    it("should export awsCostAgent instance", () => {
      expect(awsCostAgent).toBeDefined();
    });

    it("should have agent name set to 'AWSCostOptimizer'", () => {
      expect(AWS_COST_AGENT_CONFIG.name).toBe("AWSCostOptimizer");
    });

    it("should use anthropic/claude-sonnet-4 model via OpenRouter", () => {
      expect(AWS_COST_AGENT_CONFIG.model).toBe("anthropic/claude-sonnet-4");
    });

    it("should have maxSteps set to 100 for complex workflows", () => {
      expect(AWS_COST_AGENT_CONFIG.maxSteps).toBe(100);
    });
  });

  describe("System Instructions", () => {
    it("should have comprehensive system instructions", () => {
      expect(AWS_COST_AGENT_CONFIG.instructions).toBeDefined();
      expect(AWS_COST_AGENT_CONFIG.instructions.length).toBeGreaterThan(500);
    });

    it("should include AWS cost optimization context", () => {
      const instructions = AWS_COST_AGENT_CONFIG.instructions.toLowerCase();
      expect(instructions).toContain("aws");
      expect(instructions).toContain("cost");
    });

    it("should include guidance for cost analysis", () => {
      const instructions = AWS_COST_AGENT_CONFIG.instructions.toLowerCase();
      expect(instructions).toContain("analysis");
    });

    it("should include guidance for recommendations", () => {
      const instructions = AWS_COST_AGENT_CONFIG.instructions.toLowerCase();
      expect(instructions).toContain("recommend");
    });

    it("should include security considerations", () => {
      const instructions = AWS_COST_AGENT_CONFIG.instructions.toLowerCase();
      expect(instructions).toContain("security");
    });

    it("should include guidance for working with multiple accounts", () => {
      const instructions = AWS_COST_AGENT_CONFIG.instructions.toLowerCase();
      expect(instructions).toContain("account");
    });
  });
});
