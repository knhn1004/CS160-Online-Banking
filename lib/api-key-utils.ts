import { createHash, randomBytes } from "crypto";

/**
 * Generates a new API key with the format cs_160xxx... (where xxx is random)
 * Returns the full key string
 */
export function generateApiKey(): string {
  // Generate random suffix (32 bytes = 64 hex characters)
  const randomSuffix = randomBytes(32).toString("hex");
  // Format: cs_160 + random hex string
  return `cs_160${randomSuffix}`;
}

/**
 * Hashes an API key using SHA-256 for secure storage
 * @param key The plaintext API key
 * @returns The hashed key as a hex string
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Verifies an API key against a stored hash
 * @param key The plaintext API key to verify
 * @param hash The stored hash to compare against
 * @returns true if the key matches the hash
 */
export function verifyApiKey(key: string, hash: string): boolean {
  const keyHash = hashApiKey(key);
  return keyHash === hash;
}

/**
 * Extracts the prefix from an API key (first 10 characters)
 * Used for display purposes only
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 10);
}
