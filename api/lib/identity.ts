/**
 * Server-side identity and permission helpers.
 * All role/permission checks must occur here on the server.
 */

export const USER_ROLES = ["user", "admin", "official_tester"] as const;

export function normalizeUsernameInput(value: string): string {
  return value
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function canAccessAdmin(userRole?: string | null): boolean {
  return userRole === "admin";
}

export function isOfficialTesterRole(role?: string | null): boolean {
  return role === "official_tester";
}

export function hasAnyRole(userRole: string | null | undefined, allowed: readonly string[]): boolean {
  return !!userRole && allowed.includes(userRole);
}
