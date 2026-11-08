import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { Api, UpstreamError } from "~/api";

import { Spotify, type SpotifyProfile } from "./spotify";
import { Tracking } from "./tracking";
import { readDiscoveryHistory, readKnownTracks } from "./discovery";
import { readInsights } from "./insights";

/**
 * Resolves the Spotify user behind a bearer token. A token Spotify rejects
 * becomes a declared 401, so the client can log the user out cleanly.
 */
const resolveUser = (authorization: string | undefined) =>
  Effect.gen(function* () {
    if (!authorization) return yield* Effect.fail(new HttpApiError.Unauthorized({}));
    const spotify = yield* Spotify;
    return yield* spotify.profile(authorization.replace(/^Bearer\s+/i, ""));
  }).pipe(
    Effect.catchTag("SpotifyUnauthorized", () =>
      Effect.fail(new HttpApiError.Unauthorized({})),
    ),
    Effect.catchTag("UpstreamError", (error) =>
      Effect.fail(
        error.status === 401 ? new HttpApiError.Unauthorized({}) : error,
      ),
    ),
  );

/** Runs a handler with the authenticated Spotify user in scope. */
const withUser = <A, E, R>(
  headers: { readonly authorization?: string | undefined },
  handler: (user: SpotifyProfile) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const user = yield* resolveUser(headers.authorization);
    return yield* handler(user);
  });

export const AccountGroupLive = HttpApiBuilder.group(Api, "account", (handlers) =>
  handlers
    .handle("discoveryHistory", ({ headers }) =>
      withUser(headers, (user) => Effect.gen(function* () {
        return yield* readDiscoveryHistory(yield* SqlClient, user.id);
      })),
    )
    .handle("discoveryKnown", ({ headers, payload }) =>
      withUser(headers, (user) => Effect.gen(function* () {
        return yield* readKnownTracks(yield* SqlClient, user.id, payload.ids);
      })),
    )
    .handle("status", ({ headers }) =>
      withUser(headers, (user) =>
        Effect.gen(function* () {
          const tracking = yield* Tracking;
          yield* tracking.markRead(user.id);
          return yield* tracking.status(user.id);
        }),
      ),
    )
    .handle("insights", ({ headers, query }) =>
      withUser(headers, (user) =>
        Effect.gen(function* () {
          const tracking = yield* Tracking;
          return yield* tracking.insights(user.id, {
            tzOffset: query.tzOffset ?? 0,
            range: query.range ?? "all",
            fromMs: query.fromMs ?? null,
            toMs: query.toMs ?? null,
          });
        }),
      ),
    )
    .handle("exportJson", ({ headers }) =>
      withUser(headers, (user) =>
        Effect.gen(function* () {
          const tracking = yield* Tracking;
          return yield* tracking.exportJson(user.id);
        }),
      ),
    )
    .handle("exportCsv", ({ headers }) =>
      withUser(headers, (user) =>
        Effect.gen(function* () {
          const tracking = yield* Tracking;
          return yield* tracking.exportCsv(user.id);
        }),
      ),
    )
    .handle("refresh", ({ headers }) =>
      withUser(headers, (user) =>
        Effect.gen(function* () {
          const tracking = yield* Tracking;
          const queued = yield* tracking.enqueueRefresh(user.id);
          return { queued } satisfies { queued: boolean };
        }),
      ),
    )
    .handle("disable", ({ headers }) =>
      withUser(headers, (user) =>
        Effect.gen(function* () {
          const tracking = yield* Tracking;
          yield* tracking.disable(user.id);
          return yield* tracking.status(user.id);
        }),
      ),
    )
    .handle("deleteData", ({ headers }) =>
      withUser(headers, (user) =>
        Effect.gen(function* () {
          const tracking = yield* Tracking;
          yield* tracking.deleteData(user.id);
          return yield* tracking.status(user.id);
        }),
      ),
    ),
);

const publicDatabaseError = (message: string) => (cause: {
  readonly message: string;
}) =>
  new UpstreamError({
    service: "database",
    message: `${message}: ${cause.message}`,
    status: null,
  });

/**
 * Serves the read-only statistics page without a Spotify session.
 *
 * Only the single enabled account's aggregates leave D1. No profile, token,
 * raw listen rows or export endpoints are exposed here.
 */
export const PublicGroupLive = HttpApiBuilder.group(Api, "public", (handlers) =>
  handlers.handle("insights", ({ query }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const rows = yield* sql<{ spotifyUserId: string }>`
        SELECT spotify_user_id AS spotifyUserId
        FROM spotify_tracking_users
        WHERE enabled = 1
        ORDER BY consented_at DESC
        LIMIT 1
      `.pipe(Effect.mapError(publicDatabaseError("读取统计账户失败")));

      const spotifyUserId = rows[0]?.spotifyUserId;
      if (!spotifyUserId) {
        return yield* Effect.fail(
          new UpstreamError({
            service: "database",
            message: "尚未启用听歌统计",
            status: null,
          }),
        );
      }

      return yield* readInsights(sql, spotifyUserId, {
        tzOffset: query.tzOffset ?? 0,
        range: query.range ?? "all",
        fromMs: query.fromMs ?? null,
        toMs: query.toMs ?? null,
      });
    }),
  ),
);
