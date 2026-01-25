import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env files (.env, .env.local, etc.) - needed to access VITE_CONVEX_URL in config
  const env = loadEnv(mode, process.cwd(), '');

  // Get the Convex site URL from env, converting .cloud to .site
  // This proxy is for LOCAL DEVELOPMENT only - in production, requests go through Cloudflare Worker
  const convexSiteUrl = env.VITE_CONVEX_URL?.replace('.convex.cloud', '.convex.site') || '';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5174, // Different port from pruva-admin
      proxy: {
        // Proxy auth requests to Convex site URL to avoid CORS in development
        '/api/auth': {
          target: convexSiteUrl,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
