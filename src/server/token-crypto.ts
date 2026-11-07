import { env } from "cloudflare:workers";

const prefix = "v1:";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const associatedData = (spotifyUserId: string) =>
  encoder.encode(`spotistats:spotify-refresh-token:${spotifyUserId}:v1`);

const encodeBase64Url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const encryptionKey = async () => {
  const encodedKey = env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error("Missing refresh-token encryption key");

  const rawKey = decodeBase64Url(encodedKey);
  if (rawKey.length !== 32) {
    throw new Error("Refresh-token encryption key must contain 32 bytes");
  }

  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
};

/** Encrypt a Spotify refresh token before it is written to D1. */
export async function encryptRefreshToken(
  spotifyUserId: string,
  refreshToken: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: associatedData(spotifyUserId),
    },
    await encryptionKey(),
    encoder.encode(refreshToken),
  );
  return `${prefix}${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypt a stored refresh token. Plaintext rows are reported as legacy so
 * the caller can re-encrypt them after the next successful token refresh.
 */
export async function decryptRefreshToken(
  spotifyUserId: string,
  storedValue: string,
): Promise<{ token: string; encrypted: boolean }> {
  if (!storedValue.startsWith(prefix)) {
    return { token: storedValue, encrypted: false };
  }

  const [ivPart, ciphertextPart, ...extra] = storedValue.slice(prefix.length).split(".");
  if (!ivPart || !ciphertextPart || extra.length > 0) {
    throw new Error("Stored refresh token has an invalid encrypted format");
  }

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64Url(ivPart),
      additionalData: associatedData(spotifyUserId),
    },
    await encryptionKey(),
    decodeBase64Url(ciphertextPart),
  );
  return { token: decoder.decode(plaintext), encrypted: true };
}
