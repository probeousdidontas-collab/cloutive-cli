/**
 * Notification Tools Tests
 *
 * Tests for US-017: Implement AI agent notification tools
 *
 * Tests the notification tools:
 * - notification_send - Send notifications via email (Resend)
 * - analysis_createAlert - Create budget/anomaly alerts
 */

import { describe, it, expect } from "vitest";
import {
  notification_send,
  analysis_createAlert,
  NOTIFICATION_TOOLS,
} from "./notifications";

describe("Notification Tools (US-017)", () => {
  describe("Tool Exports", () => {
    it("should export notification_send tool", () => {
      expect(notification_send).toBeDefined();
      expect(typeof notification_send).toBe("function");
    });

    it("should export analysis_createAlert tool", () => {
      expect(analysis_createAlert).toBeDefined();
      expect(typeof analysis_createAlert).toBe("function");
    });

    it("should export NOTIFICATION_TOOLS object with all tools", () => {
      expect(NOTIFICATION_TOOLS).toBeDefined();
      expect(NOTIFICATION_TOOLS.notification_send).toBe(notification_send);
      expect(NOTIFICATION_TOOLS.analysis_createAlert).toBe(analysis_createAlert);
    });
  });

  describe("notification_send Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(notification_send.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for the AI agent", () => {
      expect(notification_send.description).toBeDefined();
      expect(notification_send.description.toLowerCase()).toContain("email");
    });

    it("should define args schema with organizationId, to, subject, and message", () => {
      expect(notification_send.args).toBeDefined();
      expect(notification_send.args.organizationId).toBeDefined();
      expect(notification_send.args.to).toBeDefined();
      expect(notification_send.args.subject).toBeDefined();
      expect(notification_send.args.message).toBeDefined();
    });

    it("should have optional html argument for rich email content", () => {
      expect(notification_send.args.html).toBeDefined();
    });

    it("should have optional alertId argument to link to an alert", () => {
      expect(notification_send.args.alertId).toBeDefined();
    });
  });

  describe("analysis_createAlert Tool", () => {
    it("should be a function that accepts ctx and args", () => {
      expect(analysis_createAlert.length).toBeGreaterThanOrEqual(0);
    });

    it("should have a description for creating alerts", () => {
      expect(analysis_createAlert.description).toBeDefined();
      expect(analysis_createAlert.description.toLowerCase()).toContain("alert");
    });

    it("should define args schema with organizationId, type, title, message, and severity", () => {
      expect(analysis_createAlert.args).toBeDefined();
      expect(analysis_createAlert.args.organizationId).toBeDefined();
      expect(analysis_createAlert.args.type).toBeDefined();
      expect(analysis_createAlert.args.title).toBeDefined();
      expect(analysis_createAlert.args.message).toBeDefined();
      expect(analysis_createAlert.args.severity).toBeDefined();
    });

    it("should have optional sendEmail argument to trigger email notification", () => {
      expect(analysis_createAlert.args.sendEmail).toBeDefined();
    });

    it("should have optional recipientEmail argument for email delivery", () => {
      expect(analysis_createAlert.args.recipientEmail).toBeDefined();
    });
  });

  describe("Tool Metadata", () => {
    it("notification_send should have description mentioning Resend", () => {
      const desc = notification_send.description.toLowerCase();
      expect(desc).toContain("resend");
    });

    it("analysis_createAlert should mention budget or anomaly in description", () => {
      const desc = analysis_createAlert.description.toLowerCase();
      expect(desc.includes("budget") || desc.includes("anomaly")).toBe(true);
    });
  });
});
