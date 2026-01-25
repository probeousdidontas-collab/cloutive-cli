import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * Deployment configuration integration tests.
 * 
 * These tests verify the deployment files exist and are properly configured.
 * Run these before deployment to ensure everything is in place.
 */

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const APP_ROOT = resolve(__dirname, '..');

describe('Deployment Files', () => {
  describe('wrangler.jsonc', () => {
    it('should exist in the app root', () => {
      const wranglerPath = join(APP_ROOT, 'wrangler.jsonc');
      expect(existsSync(wranglerPath)).toBe(true);
    });

    it('should contain valid configuration', () => {
      const wranglerPath = join(APP_ROOT, 'wrangler.jsonc');
      const content = readFileSync(wranglerPath, 'utf-8');
      
      // Check for required fields (JSONC may have comments)
      expect(content).toContain('"name"');
      expect(content).toContain('"main"');
      expect(content).toContain('"assets"');
      expect(content).toContain('"VITE_CONVEX_URL"');
    });

    it('should have correct asset directory', () => {
      const wranglerPath = join(APP_ROOT, 'wrangler.jsonc');
      const content = readFileSync(wranglerPath, 'utf-8');
      
      expect(content).toContain('"directory": "./dist"');
    });

    it('should have SPA not_found_handling', () => {
      const wranglerPath = join(APP_ROOT, 'wrangler.jsonc');
      const content = readFileSync(wranglerPath, 'utf-8');
      
      expect(content).toContain('"not_found_handling": "single-page-application"');
    });
  });

  describe('worker.ts', () => {
    it('should exist in src directory', () => {
      const workerPath = join(APP_ROOT, 'src', 'worker.ts');
      expect(existsSync(workerPath)).toBe(true);
    });

    it('should export a default fetch handler', () => {
      const workerPath = join(APP_ROOT, 'src', 'worker.ts');
      const content = readFileSync(workerPath, 'utf-8');
      
      expect(content).toContain('export default');
      expect(content).toContain('async fetch(request: Request, env: Env)');
    });

    it('should handle /api/auth routes', () => {
      const workerPath = join(APP_ROOT, 'src', 'worker.ts');
      const content = readFileSync(workerPath, 'utf-8');
      
      expect(content).toContain('/api/auth');
      expect(content).toContain('proxyToConvexSite');
    });

    it('should handle /convex routes', () => {
      const workerPath = join(APP_ROOT, 'src', 'worker.ts');
      const content = readFileSync(workerPath, 'utf-8');
      
      expect(content).toContain('/convex');
      expect(content).toContain('proxyToConvexCloud');
    });

    it('should handle WebSocket upgrades', () => {
      const workerPath = join(APP_ROOT, 'src', 'worker.ts');
      const content = readFileSync(workerPath, 'utf-8');
      
      expect(content).toContain('websocket');
      expect(content).toContain('handleConvexWebSocket');
    });

    it('should serve static assets via ASSETS binding', () => {
      const workerPath = join(APP_ROOT, 'src', 'worker.ts');
      const content = readFileSync(workerPath, 'utf-8');
      
      expect(content).toContain('env.ASSETS.fetch');
    });
  });

  describe('deploy.sh', () => {
    it('should exist in the app root', () => {
      const deployPath = join(APP_ROOT, 'deploy.sh');
      expect(existsSync(deployPath)).toBe(true);
    });

    it('should be a file', () => {
      const deployPath = join(APP_ROOT, 'deploy.sh');
      const stats = statSync(deployPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should support staging and production environments', () => {
      const deployPath = join(APP_ROOT, 'deploy.sh');
      const content = readFileSync(deployPath, 'utf-8');
      
      expect(content).toContain('staging');
      expect(content).toContain('production');
    });

    it('should run typecheck before deployment', () => {
      const deployPath = join(APP_ROOT, 'deploy.sh');
      const content = readFileSync(deployPath, 'utf-8');
      
      expect(content).toContain('npm run typecheck');
    });

    it('should run tests before deployment', () => {
      const deployPath = join(APP_ROOT, 'deploy.sh');
      const content = readFileSync(deployPath, 'utf-8');
      
      expect(content).toContain('npm run test');
    });

    it('should build before deployment', () => {
      const deployPath = join(APP_ROOT, 'deploy.sh');
      const content = readFileSync(deployPath, 'utf-8');
      
      expect(content).toContain('npm run build');
    });
  });

  describe('package.json', () => {
    it('should have deploy scripts', () => {
      const packagePath = join(APP_ROOT, 'package.json');
      const content = JSON.parse(readFileSync(packagePath, 'utf-8'));
      
      expect(content.scripts).toHaveProperty('deploy');
      expect(content.scripts).toHaveProperty('deploy:staging');
      expect(content.scripts).toHaveProperty('deploy:production');
    });

    it('should have wrangler dev dependency', () => {
      const packagePath = join(APP_ROOT, 'package.json');
      const content = JSON.parse(readFileSync(packagePath, 'utf-8'));
      
      expect(content.devDependencies).toHaveProperty('wrangler');
    });

    it('should have @cloudflare/workers-types dev dependency', () => {
      const packagePath = join(APP_ROOT, 'package.json');
      const content = JSON.parse(readFileSync(packagePath, 'utf-8'));
      
      expect(content.devDependencies).toHaveProperty('@cloudflare/workers-types');
    });
  });

  describe('Build output', () => {
    it('should have dist directory configured as output', () => {
      const viteConfigPath = join(APP_ROOT, 'vite.config.ts');
      const content = readFileSync(viteConfigPath, 'utf-8');
      
      expect(content).toContain('outDir: "dist"');
    });
  });
});

describe('Environment Configuration', () => {
  it('should have VITE_CONVEX_URL in vite-env.d.ts', () => {
    const envDtsPath = join(APP_ROOT, 'src', 'vite-env.d.ts');
    const content = readFileSync(envDtsPath, 'utf-8');
    
    expect(content).toContain('VITE_CONVEX_URL');
  });

  it('should have .env.example with VITE_CONVEX_URL', () => {
    const envExamplePath = join(APP_ROOT, '.env.example');
    
    if (existsSync(envExamplePath)) {
      const content = readFileSync(envExamplePath, 'utf-8');
      expect(content).toContain('VITE_CONVEX_URL');
    }
  });
});
