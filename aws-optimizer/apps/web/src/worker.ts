/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Worker entry point for the AWS Optimizer frontend.
 *
 * This worker proxies all Convex traffic through the deployed domain:
 * 1. /convex/* -> Convex cloud (queries, mutations, actions, WebSocket sync)
 * 2. /api/auth/* -> Convex site (Better Auth HTTP actions)
 * 3. /.well-known/* -> Convex site (JWKS/OpenID discovery)
 * 4. Everything else -> Static assets from dist directory
 */

export interface Env {
  ASSETS: Fetcher;
  VITE_CONVEX_URL: string;
}

const CONVEX_PROXY_PREFIX = '/convex';

const HOP_BY_HOP_HEADERS = ['connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade'];

function getConvexCloudUrl(env: Env): string {
  return env.VITE_CONVEX_URL || '';
}

function getConvexSiteUrl(env: Env): string {
  const convexUrl = env.VITE_CONVEX_URL || '';
  return convexUrl.replace('.convex.cloud', '.convex.site');
}

function createProxyHeaders(request: Request): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase()) && key.toLowerCase() !== 'host') {
      headers.set(key, value);
    }
  });

  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) {
    headers.set('CF-Connecting-IP', clientIp);
    headers.set('X-Forwarded-For', clientIp);
    headers.set('X-Real-IP', clientIp);
  }

  return headers;
}

async function proxyToConvexSite(request: Request, env: Env): Promise<Response> {
  const convexSiteUrl = getConvexSiteUrl(env);
  const requestId = crypto.randomUUID().slice(0, 8);

  if (!convexSiteUrl) {
    console.error(`[Worker:${requestId}] VITE_CONVEX_URL not configured`);
    return new Response('VITE_CONVEX_URL not configured', { status: 500 });
  }

  const url = new URL(request.url);
  const targetUrl = `${convexSiteUrl}${url.pathname}${url.search}`;

  console.log(`[Worker:${requestId}] -> SITE ${request.method} ${url.pathname}`);

  const headers = createProxyHeaders(request);

  try {
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      // @ts-expect-error - duplex is needed for streaming request bodies
      duplex: 'half',
      redirect: 'manual',
    });

    console.log(`[Worker:${requestId}] <- SITE ${proxyResponse.status}`);

    const responseHeaders = new Headers();

    proxyResponse.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP_HEADERS.includes(lower)) return;

      if (lower === 'set-cookie') {
        const rewrittenCookie = value.replace(/;\s*domain=[^;]*/gi, '');
        responseHeaders.append(key, rewrittenCookie);
      } else if (lower === 'location') {
        let location = value;
        if (location.startsWith(convexSiteUrl)) {
          location = location.replace(convexSiteUrl, url.origin);
        }
        responseHeaders.set(key, location);
      } else {
        responseHeaders.set(key, value);
      }
    });

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Worker:${requestId}] Site proxy error:`, error);
    return new Response('Bad Gateway: Failed to connect to Convex', { status: 502 });
  }
}

async function proxyToConvexCloud(request: Request, env: Env): Promise<Response> {
  const convexCloudUrl = getConvexCloudUrl(env);
  const requestId = crypto.randomUUID().slice(0, 8);

  if (!convexCloudUrl) {
    console.error(`[Worker:${requestId}] VITE_CONVEX_URL not configured`);
    return new Response('VITE_CONVEX_URL not configured', { status: 500 });
  }

  const url = new URL(request.url);
  const convexPath = url.pathname.slice(CONVEX_PROXY_PREFIX.length);
  const targetUrl = `${convexCloudUrl}${convexPath}${url.search}`;

  console.log(`[Worker:${requestId}] -> CLOUD ${request.method} ${convexPath}`);

  const headers = createProxyHeaders(request);

  try {
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      // @ts-expect-error - duplex is needed for streaming request bodies
      duplex: 'half',
      redirect: 'manual',
    });

    console.log(`[Worker:${requestId}] <- CLOUD ${proxyResponse.status}`);

    const responseHeaders = new Headers();
    proxyResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Worker:${requestId}] Cloud proxy error:`, error);
    return new Response('Bad Gateway: Failed to connect to Convex', { status: 502 });
  }
}

async function handleConvexWebSocket(request: Request, env: Env): Promise<Response> {
  const convexCloudUrl = getConvexCloudUrl(env);
  const requestId = crypto.randomUUID().slice(0, 8);

  if (!convexCloudUrl) {
    console.error(`[Worker:${requestId}] VITE_CONVEX_URL not configured`);
    return new Response('VITE_CONVEX_URL not configured', { status: 500 });
  }

  const url = new URL(request.url);
  const convexPath = url.pathname.slice(CONVEX_PROXY_PREFIX.length);
  const targetUrl = `${convexCloudUrl}${convexPath}${url.search}`;

  console.log(`[Worker:${requestId}] WS ${convexPath}`);

  const headers = new Headers();

  const headersToForward = [
    'sec-websocket-protocol',
    'sec-websocket-extensions',
    'sec-websocket-key',
    'sec-websocket-version',
    'origin',
    'upgrade',
    'connection',
  ];

  headersToForward.forEach(header => {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  });

  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) {
    headers.set('CF-Connecting-IP', clientIp);
    headers.set('X-Forwarded-For', clientIp);
    headers.set('X-Real-IP', clientIp);
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
    });

    if (response.status === 101) {
      console.log(`[Worker:${requestId}] WS OK`);
      return response;
    }

    console.error(`[Worker:${requestId}] WS FAIL ${response.status}`);
    return new Response(`WebSocket upgrade failed: ${response.status}`, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error(`[Worker:${requestId}] WebSocket error:`, error);
    return new Response('Failed to establish WebSocket connection', { status: 502 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        convexUrl: env.VITE_CONVEX_URL ? 'configured' : 'missing',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Debug endpoint
    if (url.pathname === '/api/debug-ip') {
      return new Response(JSON.stringify({
        'CF-Connecting-IP': request.headers.get('CF-Connecting-IP'),
        'X-Forwarded-For': request.headers.get('X-Forwarded-For'),
        'X-Real-IP': request.headers.get('X-Real-IP'),
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // /api/auth/* -> Convex site (Better Auth HTTP actions)
    if (url.pathname.startsWith('/api/auth')) {
      console.log(`[Worker] AUTH ${request.method} ${url.pathname}`);
      return proxyToConvexSite(request, env);
    }

    // /.well-known/* -> Convex site at /api/auth/.well-known/* (JWKS/OpenID discovery)
    if (url.pathname.startsWith('/.well-known')) {
      const rewrittenUrl = new URL(request.url);
      rewrittenUrl.pathname = `/api/auth${url.pathname}`;
      const rewrittenRequest = new Request(rewrittenUrl.toString(), request);
      return proxyToConvexSite(rewrittenRequest, env);
    }

    // /convex/* -> Convex cloud (HTTP + WebSocket)
    if (url.pathname.startsWith(CONVEX_PROXY_PREFIX)) {
      const upgradeHeader = request.headers.get('Upgrade');

      if (upgradeHeader?.toLowerCase() === 'websocket') {
        return handleConvexWebSocket(request, env);
      }

      return proxyToConvexCloud(request, env);
    }

    // Static assets
    return env.ASSETS.fetch(request);
  },
};
