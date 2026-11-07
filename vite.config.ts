import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import solid from "@solidjs/vite-plugin";
import { defineConfig, type Plugin } from "vite";

// These values are public build configuration. No upstream deployment values
// are included as defaults; production builds supply them through CI.
process.env.VITE_SPOTIFY_CLIENT_ID ??= "";
process.env.VITE_SITE_URL ??= "";
process.env.VITE_POSTHOG_KEY ??= "";

/**
 * `cf build` runs the Solid client build twice: an early client build, the
 * Worker/SSR build, then the deployable client build. The Solid server bundle
 * bakes the client asset manifest at build time, so the one it sees during the
 * middle build does not match the final client hashes.
 *
 * Patch the Worker bundle with the final client manifest after the last client
 * build, and keep the conventional `dist/client` manifest in sync for preview.
 */
function solidClientManifest(): Plugin {
  return {
    name: "solid-client-manifest",
    apply: "build",
    closeBundle() {
      const environment = this.environment;
      if (environment?.name !== "client") return;

      const outDir = environment.config.build.outDir;
      const manifestPath = path.join(outDir, ".vite/manifest.json");
      if (!existsSync(manifestPath)) return;

      const bundlePath = path.resolve(outDir, "../bundle/index.js");
      if (!existsSync(bundlePath)) return;

      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
        string,
        unknown
      >;
      manifest._base = environment.config.base || "/";

      const code = readFileSync(bundlePath, "utf8");
      const marker = code.indexOf("virtual:solid-manifest");
      if (marker < 0) {
        throw new Error("Could not find the Solid client manifest in the Worker bundle.");
      }

      // Newer Solid plugin builds emit a runtime resolver while the Worker is
      // bundled, then the final client manifest becomes available later in the
      // Cloudflare build. Replace that resolver with the completed manifest.
      const resolver = /var\s+([A-Za-z0-9_$]+)\s*=\s*registry\s*&&\s*registry\[[^\]]+\]\s*\|\|[\s\S]*?;(?=\n)/.exec(
        code.slice(marker),
      );
      let withManifest: string;

      if (resolver) {
        const start = marker + resolver.index;
        const replacement = `var ${resolver[1]} = ${JSON.stringify(manifest)};`;
        withManifest = `${code.slice(0, start)}${replacement}${code.slice(start + resolver[0].length)}`;
      } else {
        // Keep support for the earlier plugin output, which emitted an object
        // literal directly instead of the runtime bridge resolver.
        const declarationStart = code.indexOf("var ", marker);
        const declaration =
          declarationStart < 0
            ? null
            : /^var\s+([A-Za-z0-9_$]+)\s*=\s*\{/.exec(code.slice(declarationStart));
        const declarationEnd = declaration
          ? code.indexOf("\n};", declarationStart)
          : -1;
        if (!declaration || declarationEnd < 0) {
          throw new Error(
            "Could not find the Solid client manifest in the Worker bundle.",
          );
        }

        // The fallback build names the virtual manifest variable after the
        // plugin's internal alias. A build that found a client manifest inlines
        // it as `manifest` instead.
        const replacement = `var ${declaration[1]} = ${JSON.stringify(manifest)};\n`;
        withManifest = `${code.slice(0, declarationStart)}${replacement}${code.slice(declarationEnd + "\n};".length)}`;
      }

      // Solid appends a `$$moduleUrl` export to every SSR module. The Worker
      // entry re-exports it, but Workers module exports must be functions or
      // handlers. Drop it from the entry's export list.
      const patched = withManifest.replace(
        /export\s*\{([^}]*)\}\s*;/g,
        (_match, exports: string) => {
          const kept = exports
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "$$moduleUrl");
          return kept.length > 0 ? `export { ${kept.join(", ")} };` : "";
        },
      );

      writeFileSync(bundlePath, patched);

      const distManifest = path.resolve("dist/client/.vite/manifest.json");
      mkdirSync(path.dirname(distManifest), { recursive: true });
      writeFileSync(distManifest, JSON.stringify(manifest));

      const siteUrl = process.env.VITE_SITE_URL?.replace(/\/+$/, "");
      if (siteUrl) {
        const publicDir = path.resolve(outDir);
        const sitemap = ["/", "/privacy", "/security"]
          .map((route) => `  <url><loc>${siteUrl}${route}</loc></url>`)
          .join("\n");
        writeFileSync(
          path.join(publicDir, "sitemap.xml"),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap}\n</urlset>\n`,
        );

        const robotsPath = path.join(publicDir, "robots.txt");
        const robots = existsSync(robotsPath)
          ? readFileSync(robotsPath, "utf8").replace(/^Sitemap:.*\n?/gim, "").trimEnd()
          : "User-agent: *\nAllow: /";
        writeFileSync(robotsPath, `${robots}\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

        const repository = (
          process.env.VITE_GITHUB_REPOSITORY ??
          process.env.GITHUB_REPOSITORY ??
          "sweetcpt/spotistats"
        ).replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "");
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
          throw new Error("VITE_GITHUB_REPOSITORY must be owner/repository.");
        }
        const securityPath = path.join(publicDir, ".well-known/security.txt");
        mkdirSync(path.dirname(securityPath), { recursive: true });
        const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .replace(/\.\d{3}Z$/, "Z");
        writeFileSync(
          securityPath,
          `Contact: https://github.com/${repository}/security/advisories/new\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: ${siteUrl}/.well-known/security.txt\nPolicy: ${siteUrl}/security\n`,
        );
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
  },
  // PostHog error tracking fetches a served bundle's source map to symbolicate
  // production stack traces. Only the client needs them: without one every
  // report arrives minified, which made the `SpotifyApiError` triage a guess.
  environments: {
    client: {
      build: { sourcemap: true },
    },
  },
  plugins: [
    // Start mode with SSR. The plugin owns the client entry, the document
    // shell and the server render. `externalServer` hands the Worker entry to
    // us, because the worker also runs the sync queue and the cron trigger.
    solid({
      ssr: true,
      start: {
        externalServer: true,
        app: "./src/App.tsx",
        document: "./src/Document.tsx",
        middleware: "./src/server/middleware.ts",
      },
    }),
    // Map the Worker to Solid's `ssr` environment so the server render and the
    // Effect API run in workerd, with the D1 and queue bindings.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    solidClientManifest(),
  ],
});
