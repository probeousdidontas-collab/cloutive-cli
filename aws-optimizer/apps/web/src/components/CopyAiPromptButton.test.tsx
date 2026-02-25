import { describe, test, expect } from "vitest";
import { buildBugReportPrompt, buildFeedbackPrompt } from "./CopyAiPromptButton";

describe("buildBugReportPrompt", () => {
  test("should include title, severity, and description", () => {
    const prompt = buildBugReportPrompt({
      _id: "1",
      title: "Login fails on Safari",
      description: "Users see 500 error",
      severity: "high",
      status: "open",
      reporterName: "John",
      reporterEmail: "john@test.com",
      url: "/login",
      browserInfo: "Safari 17",
      createdAt: Date.now(),
    });

    expect(prompt).toContain("Fix the following bug");
    expect(prompt).toContain("Login fails on Safari");
    expect(prompt).toContain("high");
    expect(prompt).toContain("Users see 500 error");
  });

  test("should include AI fields when present", () => {
    const prompt = buildBugReportPrompt({
      _id: "1",
      title: "Bug",
      description: "Desc",
      severity: "low",
      status: "open",
      reporterName: "John",
      reporterEmail: "john@test.com",
      url: "/page",
      browserInfo: "Chrome",
      createdAt: Date.now(),
      aiSummary: "Summary text",
      aiRootCauseAnalysis: "Root cause text",
      aiSuggestedFix: "Fix text",
    });

    expect(prompt).toContain("Summary text");
    expect(prompt).toContain("Root cause text");
    expect(prompt).toContain("Fix text");
  });

  test("should omit AI fields when absent", () => {
    const prompt = buildBugReportPrompt({
      _id: "1",
      title: "Bug",
      description: "Desc",
      severity: "low",
      status: "open",
      reporterName: "John",
      reporterEmail: "john@test.com",
      url: "/page",
      browserInfo: "Chrome",
      createdAt: Date.now(),
    });

    expect(prompt).not.toContain("AI Summary");
    expect(prompt).not.toContain("Root Cause Analysis");
    expect(prompt).not.toContain("Suggested Fix");
  });

  test("should include console errors when present", () => {
    const prompt = buildBugReportPrompt({
      _id: "1",
      title: "Bug",
      description: "Desc",
      severity: "low",
      status: "open",
      reporterName: "John",
      reporterEmail: "john@test.com",
      url: "/page",
      browserInfo: "Chrome",
      createdAt: Date.now(),
      consoleErrors: "TypeError: undefined",
    });

    expect(prompt).toContain("TypeError: undefined");
  });
});

describe("buildFeedbackPrompt", () => {
  test("should include title, priority, and description with correct type label", () => {
    const prompt = buildFeedbackPrompt({
      _id: "1",
      type: "feature_request",
      title: "Add dark mode",
      description: "Users want dark mode",
      priority: "important",
      status: "open",
      reporterName: "Jane",
      reporterEmail: "jane@test.com",
      url: "/settings",
      createdAt: Date.now(),
    });

    expect(prompt).toContain("Implement the following feature request");
    expect(prompt).toContain("Add dark mode");
    expect(prompt).toContain("important");
    expect(prompt).toContain("Users want dark mode");
  });

  test("should use correct label for change_request type", () => {
    const prompt = buildFeedbackPrompt({
      _id: "1",
      type: "change_request",
      title: "Change button color",
      description: "Desc",
      priority: "nice_to_have",
      status: "open",
      reporterName: "Jane",
      reporterEmail: "jane@test.com",
      url: "/page",
      createdAt: Date.now(),
    });

    expect(prompt).toContain("Implement the following change request");
  });

  test("should include AI fields and action items when present", () => {
    const prompt = buildFeedbackPrompt({
      _id: "1",
      type: "feature_request",
      title: "Feature",
      description: "Desc",
      priority: "important",
      status: "open",
      reporterName: "Jane",
      reporterEmail: "jane@test.com",
      url: "/page",
      createdAt: Date.now(),
      aiSummary: "Summary here",
      aiImpactAnalysis: "Impact here",
      aiActionItems: ["Add toggle", "Update CSS"],
    });

    expect(prompt).toContain("Summary here");
    expect(prompt).toContain("Impact here");
    expect(prompt).toContain("- Add toggle");
    expect(prompt).toContain("- Update CSS");
  });

  test("should omit AI fields when absent", () => {
    const prompt = buildFeedbackPrompt({
      _id: "1",
      type: "general",
      title: "Feedback",
      description: "Desc",
      priority: "nice_to_have",
      status: "open",
      reporterName: "Jane",
      reporterEmail: "jane@test.com",
      url: "/page",
      createdAt: Date.now(),
    });

    expect(prompt).not.toContain("AI Summary");
    expect(prompt).not.toContain("Impact Analysis");
    expect(prompt).not.toContain("Action Items");
  });
});
