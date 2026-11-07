import { Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

// `./spotify` reads the worker env to build its Basic auth header; decoding a
// profile never reaches it, so an empty env is enough.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import { retryAfterSeconds, SpotifyProfile } from "./spotify";

describe("Spotify profile decoding", () => {
  const profile = {
    id: "user",
    display_name: null,
    uri: "spotify:user:user",
    external_urls: { spotify: "https://open.spotify.com/user/user" },
    followers: { total: 0 },
  };

  // Spotify returns `null` for an account with no email (for example a phone
  // signup), which a plain `Schema.optional(Schema.String)` rejects.
  it("accepts an account with no email", () => {
    const decoded = Schema.decodeUnknownSync(SpotifyProfile)({ ...profile, email: null });
    expect(decoded.email).toBeNull();
  });

  it("accepts a profile that omits the email", () => {
    const decoded = Schema.decodeUnknownSync(SpotifyProfile)(profile);
    expect(decoded.email).toBeUndefined();
  });
});

describe("Spotify Retry-After handling", () => {
  it("uses delta seconds and rounds up fractional delays", () => {
    expect(retryAfterSeconds("12.2")).toBe(13);
  });

  it("accepts HTTP dates and uses a safe fallback for malformed values", () => {
    const now = Date.parse("2026-11-03T00:00:00Z");
    expect(retryAfterSeconds("Tue, 03 Nov 2026 00:02:30 GMT", now)).toBe(150);
    expect(retryAfterSeconds("n/a", now)).toBe(60);
  });

  it("bounds zero, negative, and unreasonably long delays", () => {
    expect(retryAfterSeconds("0")).toBe(1);
    expect(retryAfterSeconds("-10")).toBe(1);
    expect(retryAfterSeconds("999999999")).toBe(7 * 24 * 60 * 60);
  });
});
