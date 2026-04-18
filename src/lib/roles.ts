// src/lib/roles.ts
export type Role =
  | "admin"
  | "doctor"
  | "assistant"
  | "sales"
  | "patient"
  | "supplier";

export const STAFF_ROLES: Role[] = ["admin", "doctor", "assistant", "sales"];
export const ALL_ROLES: Role[] = [
  "admin",
  "doctor",
  "assistant",
  "sales",
  "patient",
  "supplier",
];
export const isAssistant = (r: Role | null) => r === "assistant";
export function isStaff(role?: string | null) {
  return role ? STAFF_ROLES.includes(role as Role) : false;
}

/** Where each role should land after login */
const PORTALS: Record<Role, string> = {
  admin: "/dashboard",   
  doctor: "/dashboard",
  assistant: "/dashboard",
  sales: "/dashboard",
  patient: "/dashboard",
  supplier: "/dashboard", 
};

export function portalPathFromRole(role?: string | null) {
  if (!role) return "/account";
  const r = role as Role;
  return PORTALS[r] ?? "/account";
}

/** Helper if you pass ?redirect=… in URLs */
export function resolveAfterLogin(role?: string | null, redirect?: string | null) {
  return redirect || portalPathFromRole(role);
}
