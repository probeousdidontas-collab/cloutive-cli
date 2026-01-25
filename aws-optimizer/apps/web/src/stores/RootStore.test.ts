import { describe, test, expect, beforeEach } from "vitest";
import { RootStore, getRootStore, _resetRootStore } from "./RootStore";

describe("RootStore", () => {
  beforeEach(() => {
    _resetRootStore();
  });

  test("should create RootStore instance", () => {
    const store = new RootStore();
    expect(store).toBeInstanceOf(RootStore);
  });

  test("should have sidebarOpen state initialized to true", () => {
    const store = new RootStore();
    expect(store.sidebarOpen).toBe(true);
  });

  test("should toggle sidebar state", () => {
    const store = new RootStore();
    expect(store.sidebarOpen).toBe(true);
    store.toggleSidebar();
    expect(store.sidebarOpen).toBe(false);
    store.toggleSidebar();
    expect(store.sidebarOpen).toBe(true);
  });

  test("should have dispose method", () => {
    const store = new RootStore();
    expect(typeof store.dispose).toBe("function");
    // Should not throw
    store.dispose();
  });
});

describe("getRootStore singleton", () => {
  beforeEach(() => {
    _resetRootStore();
  });

  test("should return singleton instance", () => {
    const store1 = getRootStore();
    const store2 = getRootStore();
    expect(store1).toBe(store2);
  });

  test("should create new instance after reset", () => {
    const store1 = getRootStore();
    _resetRootStore();
    const store2 = getRootStore();
    expect(store1).not.toBe(store2);
  });
});
