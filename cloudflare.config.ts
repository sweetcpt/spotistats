import { bindings, defineConfig, triggers } from "cf/config";

const workerName = "spotistats-personal-20261103";
const databaseName = `${workerName}-db`;
const queueName = `${workerName}-sync`;
const localDatabaseId = "00000000-0000-4000-8000-000000000001";

export default defineConfig(({ isPreview, mode }) => ({
  // Omit an account ID so cf uses the account selected by its authenticated
  // profile. This project must never inherit another Spotistats owner's ID.
  worker: {
    name: workerName,
    workersDev: true,
    compatibilityDate: "2026-04-24",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "src/server/index.ts",
    observability: {
      enabled: true,
    },
    // Worker Previews reject `triggers`, so the scheduled sync and queue
    // consumer exist only on the production Worker.
    triggers: isPreview
      ? []
      : [
          triggers.scheduled({ schedule: "*/15 * * * *" }),
          triggers.queue({
            maxBatchSize: 10,
            maxBatchTimeout: 30,
            name: queueName,
          }),
        ],
    env: {
      VITE_SPOTIFY_CLIENT_ID: bindings.text(
        process.env.VITE_SPOTIFY_CLIENT_ID ?? "",
      ),
      VITE_SITE_URL: bindings.text(process.env.VITE_SITE_URL ?? ""),
      VITE_POSTHOG_KEY: bindings.text(process.env.VITE_POSTHOG_KEY ?? ""),
      SPOTIFY_CLIENT_SECRET: bindings.secret(),
      SPOTIFY_TOKEN_ENCRYPTION_KEY: bindings.secret(),
      DB: bindings.d1({
        name: databaseName,
        ...(mode === "development" ? { id: localDatabaseId } : {}),
      }),
      SPOTIFY_SYNC_QUEUE: bindings.queue({ name: queueName }),
    },
  },
}));
