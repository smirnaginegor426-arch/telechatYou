import { describe, expect, it } from "vitest";

const normalizeUsernameInput = (value: string): string => value.trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();

const canAccessAdmin = (userRole?: string | null): boolean => userRole === "admin";
const isOfficialTesterRole = (role?: string | null): boolean => role === "official_tester";

describe("username normalization", () => {
  it("strips leading @ and whitespace", () => {
    expect(normalizeUsernameInput(" @alice ")).toBe("alice");
    expect(normalizeUsernameInput("@@bob")).toBe("bob");
  });

  it("keeps internal underscores and digits", () => {
    expect(normalizeUsernameInput("user_42")).toBe("user_42");
  });
});

describe("server-side role checks", () => {
  it("allows only admins", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("user")).toBe(false);
    expect(canAccessAdmin(undefined)).toBe(false);
  });

  it("detects official tester role", () => {
    expect(isOfficialTesterRole("official_tester")).toBe(true);
    expect(isOfficialTesterRole("admin")).toBe(false);
  });
});
