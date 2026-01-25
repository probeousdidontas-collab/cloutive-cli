import { describe, test, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreProvider } from "./StoreProvider";
import { useStores } from "./useStores";
import { _resetRootStore } from "./RootStore";

describe("StoreProvider and useStores", () => {
  beforeEach(() => {
    _resetRootStore();
  });

  test("useStores should throw when used outside StoreProvider", () => {
    expect(() => {
      renderHook(() => useStores());
    }).toThrow("useStores must be used within a StoreProvider");
  });

  test("useStores should return RootStore when used inside StoreProvider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoreProvider>{children}</StoreProvider>
    );

    const { result } = renderHook(() => useStores(), { wrapper });
    expect(result.current).toBeDefined();
    expect(result.current.sidebarOpen).toBe(true);
  });

  test("useStores should return same store instance on multiple calls", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoreProvider>{children}</StoreProvider>
    );

    const { result: result1 } = renderHook(() => useStores(), { wrapper });
    const { result: result2 } = renderHook(() => useStores(), { wrapper });
    expect(result1.current).toBe(result2.current);
  });
});

describe("Store exports", () => {
  test("should export all required items from index", async () => {
    const storeExports = await import("./index");
    expect(storeExports.RootStore).toBeDefined();
    expect(storeExports.getRootStore).toBeDefined();
    expect(storeExports._resetRootStore).toBeDefined();
    expect(storeExports.StoreProvider).toBeDefined();
    expect(storeExports.useStores).toBeDefined();
  });
});
