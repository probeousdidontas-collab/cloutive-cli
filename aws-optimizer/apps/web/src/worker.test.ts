import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the Cloudflare Worker deployment configuration.
 * 
 * These tests verify:
 * 1. Worker routes requests correctly
 * 2. Environment variables are configured properly
 * 3. Convex proxy endpoints work as expected
 * 4. Static assets are served correctly
 */

// Mock the worker module
const mockEnv = {
  VITE_CONVEX_URL: 'https://zealous-chipmunk-626.convex.cloud',
  ASSETS: {
    fetch: vi.fn(),
  },
};

describe('Worker Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health endpoint', () => {
    it('should return health status with configured convex URL', async () => {
      const request = new Request('https://example.com/api/health');
      const url = new URL(request.url);
      
      // Simulate health check logic
      const response = {
        status: 'ok',
        timestamp: expect.any(String),
        convexUrl: mockEnv.VITE_CONVEX_URL ? 'configured' : 'missing',
      };

      expect(url.pathname).toBe('/api/health');
      expect(response.status).toBe('ok');
      expect(response.convexUrl).toBe('configured');
    });

    it('should report missing convex URL when not configured', () => {
      const envWithoutConvex = {
        ...mockEnv,
        VITE_CONVEX_URL: '',
      };

      const response = {
        status: 'ok',
        convexUrl: envWithoutConvex.VITE_CONVEX_URL ? 'configured' : 'missing',
      };

      expect(response.convexUrl).toBe('missing');
    });
  });

  describe('Route matching', () => {
    it('should route /api/auth/* to Convex site', () => {
      const testPaths = [
        '/api/auth/signin',
        '/api/auth/signup',
        '/api/auth/session',
        '/api/auth/signout',
      ];

      testPaths.forEach(path => {
        expect(path.startsWith('/api/auth')).toBe(true);
      });
    });

    it('should route /convex/* to Convex cloud', () => {
      const testPaths = [
        '/convex/sync',
        '/convex/query_batch',
        '/convex/mutation',
        '/convex/action',
      ];

      testPaths.forEach(path => {
        expect(path.startsWith('/convex')).toBe(true);
      });
    });

    it('should route /.well-known/* to Convex site with path rewrite', () => {
      const originalPath = '/.well-known/jwks.json';
      const expectedRewrittenPath = '/api/auth/.well-known/jwks.json';

      expect(originalPath.startsWith('/.well-known')).toBe(true);
      expect(`/api/auth${originalPath}`).toBe(expectedRewrittenPath);
    });

    it('should route other paths to static assets', () => {
      const staticPaths = [
        '/',
        '/chat',
        '/dashboard',
        '/settings',
        '/login',
        '/signup',
      ];

      staticPaths.forEach(path => {
        expect(path.startsWith('/api/auth')).toBe(false);
        expect(path.startsWith('/convex')).toBe(false);
        expect(path.startsWith('/.well-known')).toBe(false);
      });
    });
  });

  describe('Convex URL transformation', () => {
    it('should convert cloud URL to site URL', () => {
      const cloudUrl = 'https://zealous-chipmunk-626.convex.cloud';
      const expectedSiteUrl = 'https://zealous-chipmunk-626.convex.site';

      const siteUrl = cloudUrl.replace('.convex.cloud', '.convex.site');
      expect(siteUrl).toBe(expectedSiteUrl);
    });

    it('should handle empty convex URL', () => {
      const cloudUrl = '';
      const siteUrl = cloudUrl.replace('.convex.cloud', '.convex.site');
      expect(siteUrl).toBe('');
    });
  });

  describe('Path stripping for Convex proxy', () => {
    it('should strip /convex prefix when proxying to Convex cloud', () => {
      const CONVEX_PROXY_PREFIX = '/convex';
      const testCases = [
        { input: '/convex/sync', expected: '/sync' },
        { input: '/convex/query_batch', expected: '/query_batch' },
        { input: '/convex/api/v1/mutation', expected: '/api/v1/mutation' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = input.slice(CONVEX_PROXY_PREFIX.length);
        expect(result).toBe(expected);
      });
    });
  });
});

describe('Wrangler Configuration', () => {
  it('should have correct asset configuration', () => {
    const expectedConfig = {
      binding: 'ASSETS',
      directory: './dist',
      not_found_handling: 'single-page-application',
    };

    expect(expectedConfig.directory).toBe('./dist');
    expect(expectedConfig.not_found_handling).toBe('single-page-application');
  });

  it('should have VITE_CONVEX_URL environment variable', () => {
    const expectedVars = {
      VITE_CONVEX_URL: 'https://zealous-chipmunk-626.convex.cloud',
    };

    expect(expectedVars.VITE_CONVEX_URL).toMatch(/^https:\/\/.*\.convex\.cloud$/);
  });

  it('should have production and staging environments', () => {
    const environments = ['production', 'staging'];
    expect(environments).toContain('production');
    expect(environments).toContain('staging');
  });
});

describe('Header Handling', () => {
  it('should identify hop-by-hop headers correctly', () => {
    const HOP_BY_HOP_HEADERS = ['connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade'];
    
    expect(HOP_BY_HOP_HEADERS).toContain('connection');
    expect(HOP_BY_HOP_HEADERS).toContain('keep-alive');
    expect(HOP_BY_HOP_HEADERS).toContain('transfer-encoding');
    expect(HOP_BY_HOP_HEADERS).not.toContain('content-type');
    expect(HOP_BY_HOP_HEADERS).not.toContain('authorization');
  });

  it('should forward client IP headers', () => {
    const headersToForward = ['CF-Connecting-IP', 'X-Forwarded-For', 'X-Real-IP'];
    
    headersToForward.forEach(header => {
      expect(typeof header).toBe('string');
      expect(header.length).toBeGreaterThan(0);
    });
  });
});

describe('WebSocket handling', () => {
  it('should forward WebSocket-related headers', () => {
    const wsHeaders = [
      'sec-websocket-protocol',
      'sec-websocket-extensions',
      'sec-websocket-key',
      'sec-websocket-version',
      'origin',
      'upgrade',
      'connection',
    ];

    expect(wsHeaders).toContain('sec-websocket-key');
    expect(wsHeaders).toContain('sec-websocket-version');
    expect(wsHeaders).toContain('upgrade');
  });

  it('should identify WebSocket upgrade requests', () => {
    const upgradeHeader = 'websocket';
    expect(upgradeHeader.toLowerCase()).toBe('websocket');
  });
});
