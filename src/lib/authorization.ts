/**
 * How long a stored Spotify authorization lasts.
 *
 * Spotify expires refresh tokens six months after the user authorised the app,
 * and refreshing does not extend the clock, so a sync that is not reauthorised
 * before then stops with `400 invalid_grant` from the token endpoint.
 * https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration
 *
 * The expiry is derived from `consented_at`, which `enable` resets on every
 * reconnect, so a fresh authorization starts a fresh window.
 */

/** Six months, matching the inactivity window `disableInactive` already uses. */
export const refreshTokenLifetimeMs = 1000 * 60 * 60 * 24 * 183;

/** How long before expiry the account page starts asking for a reconnect. */
export const reconnectWarningMs = 1000 * 60 * 60 * 24 * 14;

/** When the authorization behind `consentedAt` lapses, or `null` without one. */
export function authorizationExpiry(consentedAt: number | null): number | null {
  return consentedAt === null ? null : consentedAt + refreshTokenLifetimeMs;
}

/** Whether the account page should warn that a reconnect is due. */
export function authorizationNeedsReconnect(
  consentedAt: number | null,
  now: number,
): boolean {
  const expiresAt = authorizationExpiry(consentedAt);
  return expiresAt !== null && expiresAt - now <= reconnectWarningMs;
}

/**
 * The OAuth error code Spotify puts in a token-endpoint body. The body is the
 * RFC 6749 error object, so the code is stable enough to branch on.
 */
export function spotifyErrorCode(body: string): string | null {
  return /"error"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? null;
}

/**
 * Spotify reporting the app's own credentials as invalid. That is a server
 * misconfiguration rather than a lapsed user authorization, so it must not
 * disable the account and demand a reconnect that cannot fix it.
 */
export function isClientCredentialFailure(body: string): boolean {
  return spotifyErrorCode(body) === "invalid_client";
}

/** The account-page explanation for an authorization Spotify will not accept. */
export function reauthMessage(body = ""): string {
  switch (spotifyErrorCode(body)) {
    case "invalid_grant":
      return "Spotify 已让该账户保存的授权过期：刷新令牌有效期为六个月。重新连接 Spotify 统计即可继续同步。";
    case "invalid_client":
      return "Spotify 拒绝了应用的凭据，同步已暂停，修复后会自动恢复。";
    default:
      return "Spotify 已不接受该账户保存的授权。重新连接 Spotify 统计即可继续同步。";
  }
}
