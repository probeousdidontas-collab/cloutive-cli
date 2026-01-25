import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

// Create client only if URL is available
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * ConvexClientProvider - Wraps the application to provide Convex client
 * 
 * Handles missing VITE_CONVEX_URL gracefully for development without backend.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    console.warn("VITE_CONVEX_URL is not set. Running without Convex backend.");
    // Create a placeholder client for UI development without backend
    const placeholderClient = new ConvexReactClient("https://placeholder.convex.cloud");
    return <ConvexProvider client={placeholderClient}>{children}</ConvexProvider>;
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
