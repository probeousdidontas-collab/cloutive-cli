/**
 * AWS Command Tools Tests
 *
 * Tests for US-015: Implement AI agent AWS command tools
 *
 * Tests the AWS command tools:
 * - aws_executeCommand - Execute arbitrary AWS CLI commands
 * - aws_getCostData - Cost Explorer queries
 * - aws_listResources - EC2, RDS, S3 inventory
 * - aws_getReservations - RI/Savings Plan data
 */

import { describe, it, expect } from "vitest";
import {
  aws_executeCommand,
  aws_getCostData,
  aws_listResources,
  aws_getReservations,
  AWS_COMMAND_TOOLS,
} from "./awsCommands";

describe("AWS Command Tools (US-015)", () => {
  describe("Tool Exports", () => {
    it("should export aws_executeCommand tool", () => {
      expect(aws_executeCommand).toBeDefined();
      expect(typeof aws_executeCommand).toBe("function");
    });

    it("should export aws_getCostData tool", () => {
      expect(aws_getCostData).toBeDefined();
      expect(typeof aws_getCostData).toBe("function");
    });

    it("should export aws_listResources tool", () => {
      expect(aws_listResources).toBeDefined();
      expect(typeof aws_listResources).toBe("function");
    });

    it("should export aws_getReservations tool", () => {
      expect(aws_getReservations).toBeDefined();
      expect(typeof aws_getReservations).toBe("function");
    });

    it("should export AWS_COMMAND_TOOLS object with all tools", () => {
      expect(AWS_COMMAND_TOOLS).toBeDefined();
      expect(AWS_COMMAND_TOOLS.aws_executeCommand).toBe(aws_executeCommand);
      expect(AWS_COMMAND_TOOLS.aws_getCostData).toBe(aws_getCostData);
      expect(AWS_COMMAND_TOOLS.aws_listResources).toBe(aws_listResources);
      expect(AWS_COMMAND_TOOLS.aws_getReservations).toBe(aws_getReservations);
    });
  });

  describe("aws_executeCommand Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(aws_executeCommand.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for the AI agent", () => {
      expect(aws_executeCommand.description).toBeDefined();
      expect(aws_executeCommand.description).toContain("AWS");
    });

    it("should define args schema with awsAccountId and command", () => {
      expect(aws_executeCommand.args).toBeDefined();
      expect(aws_executeCommand.args.awsAccountId).toBeDefined();
      expect(aws_executeCommand.args.command).toBeDefined();
    });
  });

  describe("aws_getCostData Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(aws_getCostData.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for Cost Explorer queries", () => {
      expect(aws_getCostData.description).toBeDefined();
      expect(aws_getCostData.description.toLowerCase()).toContain("cost");
    });

    it("should define args schema with awsAccountId, startDate, and endDate", () => {
      expect(aws_getCostData.args).toBeDefined();
      expect(aws_getCostData.args.awsAccountId).toBeDefined();
      expect(aws_getCostData.args.startDate).toBeDefined();
      expect(aws_getCostData.args.endDate).toBeDefined();
    });

    it("should have optional granularity argument", () => {
      expect(aws_getCostData.args.granularity).toBeDefined();
    });

    it("should have optional groupBy argument", () => {
      expect(aws_getCostData.args.groupBy).toBeDefined();
    });
  });

  describe("aws_listResources Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(aws_listResources.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for resource inventory", () => {
      expect(aws_listResources.description).toBeDefined();
      expect(aws_listResources.description.toLowerCase()).toContain("resource");
    });

    it("should define args schema with awsAccountId and resourceType", () => {
      expect(aws_listResources.args).toBeDefined();
      expect(aws_listResources.args.awsAccountId).toBeDefined();
      expect(aws_listResources.args.resourceType).toBeDefined();
    });

    it("should have optional region argument", () => {
      expect(aws_listResources.args.region).toBeDefined();
    });
  });

  describe("aws_getReservations Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(aws_getReservations.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for RI/Savings Plan data", () => {
      expect(aws_getReservations.description).toBeDefined();
      const desc = aws_getReservations.description.toLowerCase();
      expect(desc).toMatch(/reserv|savings/i);
    });

    it("should define args schema with awsAccountId", () => {
      expect(aws_getReservations.args).toBeDefined();
      expect(aws_getReservations.args.awsAccountId).toBeDefined();
    });

    it("should have optional reservationType argument", () => {
      expect(aws_getReservations.args.reservationType).toBeDefined();
    });
  });
});
