/**
 * Server-side identity and permission helpers.
 * All role/permission checks must occur here on the server.
 */

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

export function canManageUser(
  adminRole: string | undefined,
  targetUserId: number,
  currentUserId: number
): boolean {
  // admins can manage anyone except themselves without care,
  // or themselves only if explicitly allowed elsewhere
  if (adminRole !== "admin") return false;
  return true;
}
