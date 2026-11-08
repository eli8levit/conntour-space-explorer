// Forwards every request to the origin (env.ORIGIN), with a per-IP limit on history writes.

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ORIGIN: string;
  SEARCH_LIMITER?: RateLimiter;
}

function isLimited(method: string, path: string): boolean {
  if (method === "POST" && path === "/api/searches") return true;
  return method === "DELETE" && path.startsWith("/api/searches/");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (env.SEARCH_LIMITER && isLimited(request.method, url.pathname.replace(/\/+$/, "") || "/")) {
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.SEARCH_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response("Too many requests. Try again in a minute.", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
    }

    const target = new URL(url.pathname + url.search, env.ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
    headers.set("X-Forwarded-Host", url.host);

    // Pass method, headers and body through. Do not follow redirects: the browser does.
    return fetch(new Request(target, request), { headers, redirect: "manual" });
  },
};
