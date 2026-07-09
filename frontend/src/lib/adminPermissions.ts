export type AdminAction = "view" | "create" | "edit" | "delete";

export type AdminModule =
  | "overview"
  | "bookings"
  | "promo"
  | "transfer"
  | "content"
  | "fleet"
  | "paths"
  | "vehicles"
  | "users";

export type AdminModulePermissions = Record<AdminAction, boolean>;

export type AdminPermissions = Record<AdminModule, AdminModulePermissions>;

export type AdminSession = {
  username: string;
  role: string;
  is_super_admin: boolean;
  permissions: AdminPermissions;
};

export const ADMIN_SESSION_KEY = "khareef-admin-session";

export const ADMIN_MODULES: AdminModule[] = [
  "overview",
  "bookings",
  "promo",
  "transfer",
  "content",
  "fleet",
  "paths",
  "vehicles",
  "users"
];

export const TAB_MODULE_MAP: Record<string, AdminModule> = {
  overview: "overview",
  bookings: "bookings",
  promo: "promo",
  transfer: "transfer",
  content: "content",
  fleet: "fleet",
  paths: "paths",
  vehicles: "vehicles",
  users: "users"
};

const ACTIONS: AdminAction[] = ["view", "create", "edit", "delete"];

export function emptyPermissions(): AdminPermissions {
  return Object.fromEntries(
    ADMIN_MODULES.map((module) => [module, { view: false, create: false, edit: false, delete: false }])
  ) as AdminPermissions;
}

export function fullPermissions(): AdminPermissions {
  return Object.fromEntries(
    ADMIN_MODULES.map((module) => [module, { view: true, create: true, edit: true, delete: true }])
  ) as AdminPermissions;
}

export function normalizePermissions(raw: Partial<AdminPermissions> | null | undefined): AdminPermissions {
  const base = emptyPermissions();
  if (!raw) return base;
  for (const module of ADMIN_MODULES) {
    const moduleValue = raw[module];
    if (!moduleValue) continue;
    for (const action of ACTIONS) {
      base[module][action] = Boolean(moduleValue[action]);
    }
  }
  return base;
}

export function can(session: AdminSession | null, module: AdminModule, action: AdminAction): boolean {
  if (!session) return false;
  if (session.is_super_admin) return true;
  if (session.role === "normal" && action !== "view") return false;
  return Boolean(session.permissions[module]?.[action]);
}

export function stripNonViewPermissions(permissions: AdminPermissions): AdminPermissions {
  const next = normalizePermissions(permissions);
  for (const module of ADMIN_MODULES) {
    next[module].create = false;
    next[module].edit = false;
    next[module].delete = false;
  }
  return next;
}

export function isSuperAdminSession(session: AdminSession | null): boolean {
  if (!session) return false;
  return session.is_super_admin || session.role === "super_admin";
}

export function canViewTab(session: AdminSession | null, tabId: string): boolean {
  const module = TAB_MODULE_MAP[tabId];
  if (!module) return false;
  if (module === "users") return isSuperAdminSession(session);
  return can(session, module, "view");
}

export function saveAdminSession(session: AdminSession) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function loadAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    return {
      username: parsed.username || "",
      role: parsed.role || "admin",
      is_super_admin: Boolean(parsed.is_super_admin),
      permissions: normalizePermissions(parsed.permissions)
    };
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function sessionFromAuth(response: {
  username: string;
  role: string;
  is_super_admin?: boolean;
  permissions?: AdminPermissions | null;
}): AdminSession {
  const isSuper = Boolean(response.is_super_admin) || response.role === "super_admin";
  return {
    username: response.username,
    role: response.role,
    is_super_admin: isSuper,
    permissions: isSuper ? fullPermissions() : normalizePermissions(response.permissions || undefined)
  };
}