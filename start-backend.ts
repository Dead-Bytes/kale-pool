/**
 * KALE Pool Backend Worker
 *
 * Cloudflare Worker version of the backend starter.
 * No filesystem, child_process, or local DB commands.
 */

export interface Env {
  DATABASE_URL: string;
  PORT: string;
  NODE_ENV: string;
  POOL_NAME: string;
  POOL_FEE: string;
  MIN_STAKE: string;
  MAX_STAKE: string;
  LOG_LEVEL: string;
  HEALTH_CHECK_ENDPOINT: string;
}

const BACKEND_BANNER = `
╔══════════════════════════════════════════════════════════════════════╗
║                         KALE POOL BACKEND                           ║
╚══════════════════════════════════════════════════════════════════════╝
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === env.HEALTH_CHECK_ENDPOINT) {
      return Response.json({
        status: "ok",
        service: "KALE Pool Backend Worker",
        pool: env.POOL_NAME,
        database: !!env.DATABASE_URL,
        timestamp: new Date().toISOString(),
      });
    }

    // Example root endpoint
    if (url.pathname === "/") {
      return new Response(
        `${BACKEND_BANNER}\n🚀 Backend running in ${env.NODE_ENV}\n`,
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    // Example API endpoint
    if (url.pathname.startsWith("/api")) {
      return Response.json({
        message: "KALE Backend API is live",
        pool: env.POOL_NAME,
        fee: env.POOL_FEE,
      });
    }

    // 404 handler
    return new Response("Not found", { status: 404 });
  },
};
