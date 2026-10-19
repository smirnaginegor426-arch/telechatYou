import { describe, expect, it } from "vitest";
import { normalizeHomeserverUrl } from "./matrix-e2ee";

describe("normalizeHomeserverUrl", () => {
  it("normalizes an HTTPS homeserver origin", () => {
    expect(normalizeHomeserverUrl("https://matrix.example.org/")).toBe("https://matrix.example.org");
  });

  it("allows plain HTTP only on local development hosts", () => {
    expect(normalizeHomeserverUrl("http://localhost:8008/")).toBe("http://localhost:8008");
    expect(normalizeHomeserverUrl("http://127.0.0.1:8008")).toBe("http://127.0.0.1:8008");
    expect(() => normalizeHomeserverUrl("http://matrix.example.org")).toThrow(/HTTPS/);
  });

  it("rejects credentials and URL parameters in the homeserver address", () => {
    expect(() => normalizeHomeserverUrl("https://name:password@matrix.example.org")).toThrow();
    expect(() => normalizeHomeserverUrl("https://matrix.example.org?token=secret")).toThrow();
    expect(() => normalizeHomeserverUrl("https://matrix.example.org/#private")).toThrow();
  });

  it("rejects malformed homeserver URLs", () => {
    expect(() => normalizeHomeserverUrl("not-a-url")).toThrow();
    expect(() => normalizeHomeserverUrl("")).toThrow();
  });
});
