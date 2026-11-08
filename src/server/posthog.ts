import { env } from "cloudflare:workers";

/** Optional same-origin proxy for a PostHog project configured by the owner. */

const pathPrefix = "/ph";
const allowedMethods = new Set(["GET", "POST"]);

/** Same-origin and platform headers that must not reach a third party. */
const privateHeaders = new Set([
  "cookie",
  "authorization",
  "x-forwarded-for",
  "x-real-ip",
]);

export function isPostHogPath(pathname: string): boolean {
  return Boolean(env.VITE_POSTHOG_KEY) &&
    (pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`));
}

export function proxyPostHog(request: Request): Promise<Response> {
  if (!env.VITE_POSTHOG_KEY) {
    return Promise.resolve(new Response("未找到", { status: 404 }));
  }
  if (!allowedMethods.has(request.method)) {
    return Promise.resolve(new Response("请求方法不允许", { status: 405 }));
  }

  const url = new URL(request.url);
  const hostname = url.pathname.startsWith(`${pathPrefix}/static/`)
    ? "us-assets.i.posthog.com"
    : "us.i.posthog.com";

  const target = new URL(url);
  target.protocol = "https:";
  target.hostname = hostname;
  target.port = "443";
  target.pathname = url.pathname.slice(pathPrefix.length) || "/";

  const headers = new Headers(request.headers);
  for (const name of privateHeaders) headers.delete(name);
  for (const name of [...headers.keys()]) {
    if (name.startsWith("cf-")) headers.delete(name);
  }
  headers.set("host", hostname);
  headers.delete("accept-encoding");

  return fetch(target, {
    method: request.method,
    headers,
    body: request.body,
  });
}
