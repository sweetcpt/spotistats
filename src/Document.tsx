import { HydrationScript } from "@solidjs/web";
import type { JSX } from "@solidjs/web";

/**
 * The HTML shell for the app.
 *
 * Start mode renders this on the server and hydrates it on the client. The
 * client entry script is injected into `<head>` automatically, so the shell
 * only lists the site-wide tags and the hydration script.
 */
export default function Document(props: { children?: JSX.Element }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1DB954" />
        <meta name="color-scheme" content="light" />
        <meta name="application-name" content="Spotistats" />
        <meta name="apple-mobile-web-app-title" content="Spotistats" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="google-site-verification"
          content="MTlWOXe7tGo0JJtX_8kPy0dSA6OOP8UasZF2X-L1Y-M"
        />
        <link rel="icon" href="/favicon.ico?v=2" />
        <link rel="apple-touch-icon" href="/assets/logo-256.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preconnect" href="https://api.spotify.com" />
        <link rel="dns-prefetch" href="https://api.spotify.com" />
        {/* Must run before the async client entry, which start mode injects here. */}
        <HydrationScript />
      </head>
      <body>
        <noscript>
          <main class="min-h-screen bg-[#f0ede8] p-8 md:p-16 text-[#0a0a0a]">
            <section class="max-w-xl border-4 border-[#0a0a0a] bg-[#f8f5ef] p-6 shadow-[8px_8px_0_#0a0a0a]">
              <div class="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#5c5c5c]">
                需要启用 JavaScript
              </div>
              <p class="mb-4 text-4xl font-black uppercase tracking-tighter">
                Spotistats 需要 JavaScript
              </p>
              <p class="text-sm leading-7 text-[#555]">
                这个应用会在浏览器里连接 Spotify，并用 JavaScript 加载你的音乐数据。请先启用 JavaScript，再刷新页面。
              </p>
            </section>
          </main>
        </noscript>
        {props.children}
      </body>
    </html>
  );
}
