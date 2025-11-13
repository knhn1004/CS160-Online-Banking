import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  getKeyPrefix,
} from "./api-key-utils";

describe("api-key-utils", () => {
  describe("generateApiKey", () => {
    it("should generate a key with cs_160 prefix", () => {
      const key = generateApiKey();
      expect(key).toMatch(/^cs_160/);
      expect(key.length).toBeGreaterThan(10);
    });

    it("should generate unique keys", () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("hashApiKey", () => {
    it("should hash a key consistently", () => {
      const key = "cs_160test123";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different keys", () => {
      const key1 = "cs_160test123";
      const key2 = "cs_160test456";
      const hash1 = hashApiKey(key1);
      const hash2 = hashApiKey(key2);
      expect(hash1).not.toBe(hash2);
    });

    it("should produce a hex string", () => {
      const key = "cs_160test123";
      const hash = hashApiKey(key);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("verifyApiKey", () => {
    it("should verify a correct key", () => {
      const key = "cs_160test123";
      const hash = hashApiKey(key);
      expect(verifyApiKey(key, hash)).toBe(true);
    });

    it("should reject an incorrect key", () => {
      const key = "cs_160test123";
      const hash = hashApiKey(key);
      const wrongKey = "cs_160test456";
      expect(verifyApiKey(wrongKey, hash)).toBe(false);
    });
  });

  describe("getKeyPrefix", () => {
    it("should return first 10 characters", () => {
      const key = "cs_160test123456789";
      const prefix = getKeyPrefix(key);
      expect(prefix).toBe("cs_160test");
      expect(prefix.length).toBe(10);
    });

    it("should handle short keys", () => {
      const key = "cs_160";
      const prefix = getKeyPrefix(key);
      expect(prefix).toBe("cs_160");
    });
  });
});
