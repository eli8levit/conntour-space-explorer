// Forwards every request to the origin (env.ORIGIN), with a per-IP limit on history writes.

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ORIGIN: string;
  /** Shared with the origin's nginx guard (deploy/nginx/origin-guard.conf.template). */
  ORIGIN_SECRET: string;
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
    // Proves to the origin that this request came through the Worker (and its rate limit).
    // `set` also overwrites any value a client tried to send.
    headers.set("X-Origin-Secret", env.ORIGIN_SECRET);
    // The visitor's IP, for the origin's own write limit (nginx limit_req). The origin
    // trusts it only because it trusts the secret above.
    headers.set("X-Client-IP", request.headers.get("CF-Connecting-IP") ?? "unknown");

    // Pass method, headers and body through. Do not follow redirects: the browser does.
    return fetch(new Request(target, request), { headers, redirect: "manual" });
  },
};
