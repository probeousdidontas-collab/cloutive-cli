import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

/**
 * Get the Convex URL for the client.
 * In production, use the /convex proxy path to route through our worker.
 * In development, use the VITE_CONVEX_URL environment variable directly.
 */
function getConvexUrl(): string | undefined {
  const envUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  
  // In development, use the environment variable directly
  if (import.meta.env.DEV) {
    return envUrl;
  }
  
  // In production, use the proxy path if we're on the same origin
  // This allows the worker to proxy requests to Convex
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/convex`;
  }
  
  return envUrl;
}

const convexUrl = getConvexUrl();

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
