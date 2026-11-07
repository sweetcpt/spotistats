import { expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: {
    SPOTIFY_TOKEN_ENCRYPTION_KEY:
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  },
}));

import { decryptRefreshToken, encryptRefreshToken } from "./token-crypto";

it("encrypts refresh tokens with a random nonce and user-bound authentication", async () => {
  const first = await encryptRefreshToken("spotify-user-1", "refresh-secret");
  const second = await encryptRefreshToken("spotify-user-1", "refresh-secret");

  expect(first).toMatch(/^v1:/);
  expect(first).not.toContain("refresh-secret");
  expect(second).not.toBe(first);
  await expect(
    decryptRefreshToken("spotify-user-1", first),
  ).resolves.toEqual({ token: "refresh-secret", encrypted: true });
  await expect(
    decryptRefreshToken("spotify-user-2", first),
  ).rejects.toThrow();
});

it("marks old plaintext rows for encryption during the next sync", async () => {
  await expect(
    decryptRefreshToken("spotify-user-1", "legacy-refresh-token"),
  ).resolves.toEqual({ token: "legacy-refresh-token", encrypted: false });
});
