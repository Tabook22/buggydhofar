import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Eye, Pencil, Shield, Trash2, UserPlus } from "lucide-react";
import { api, isAdminAuthError } from "../api/client";
import {
  ADMIN_MODULES,
  AdminAction,
  AdminModule,
  AdminPermissions,
  emptyPermissions,
  normalizePermissions,
  stripNonViewPermissions
} from "../lib/adminPermissions";

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

type StaffRole = "admin" | "normal";

type AdminUser = {
  id: number;
  username: string;
  role: string;
  is_super_admin: boolean;
  permissions: AdminPermissions;
  created_at: string;
};

type UserForm = {
  username: string;
  password: string;
  role: StaffRole;
  permissions: AdminPermissions;
};

function moduleLabelKey(module: AdminModule) {
  return `admin.permModule_${module}`;
}

function manageableRole(role: string): StaffRole {
  return role === "normal" ? "normal" : "admin";
}

function formatCreatedAt(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

function listModules(user: AdminUser): AdminModule[] {
  return ADMIN_MODULES.filter((module) => module !== "users");
}

function enabledActions(permissions: AdminPermissions, module: AdminModule, viewOnly: boolean): AdminAction[] {
  const actions: AdminAction[] = [];
  if (permissions[module].view) actions.push("view");
  if (!viewOnly) {
    if (permissions[module].create) actions.push("create");
    if (permissions[module].edit) actions.push("edit");
    if (permissions[module].delete) actions.push("delete");
  }
  return actions;
}

function actionLabelKey(action: AdminAction) {
  if (action === "view") return "admin.permView";
  if (action === "create") return "admin.permAdd";
  if (action === "edit") return "admin.permEdit";
  return "admin.permDelete";
}

function UserPermissionsMatrix({
  user,
  t
}: {
  user: AdminUser;
  t: (key: string) => string;
}) {
  const viewOnly = user.role === "normal";
  const modules = listModules(user);
  const actions: AdminAction[] = viewOnly ? ["view"] : ["view", "create", "edit", "delete"];

  if (user.is_super_admin) {
    return (
      <p className="text-sm text-forest-200">{t("admin.userAllAccess")}</p>
    );
  }

  const hasAny = modules.some((module) => enabledActions(user.permissions, module, viewOnly).length > 0);
  if (!hasAny) {
    return <p className="text-sm text-white/50">{t("admin.userNoAccess")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-white/5 text-white/60">
          <tr>
            <th className="p-2 text-start">{t("admin.permArea")}</th>
            {actions.map((action) => (
              <th key={action} className="p-2 text-center">
                {t(actionLabelKey(action))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr key={module} className="border-t border-white/10">
              <td className="p-2 font-medium">{t(moduleLabelKey(module))}</td>
              {actions.map((action) => (
                <td key={action} className="p-2 text-center">
                  <span
                    className={
                      user.permissions[module][action]
                        ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-forest-500/25 text-forest-200"
                        : "inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/25"
                    }
                  >
                    {user.permissions[module][action] ? "✓" : "—"}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminUsersPanel({
  token,
  onAuthFailure,
  embedded = false
}: {
  token: string;
  onAuthFailure: (message?: string) => void;
  embedded?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>({
    username: "",
    password: "",
    role: "admin",
    permissions: emptyPermissions()
  });

  const isNormalRole = form.role === "normal";

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGet<AdminUser[]>("/api/admin/users", token);
      setUsers(data.map((user) => ({ ...user, permissions: normalizePermissions(user.permissions) })));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.usersLoadFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    } finally {
      setLoading(false);
    }
  }, [token, onAuthFailure, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function resetForm() {
    setEditingId(null);
    setForm({ username: "", password: "", role: "admin", permissions: emptyPermissions() });
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEdit(user: AdminUser) {
    const role = manageableRole(user.role);
    setEditingId(user.id);
    setExpandedId(user.id);
    setForm({
      username: user.username,
      password: "",
      role,
      permissions:
        role === "normal"
          ? stripNonViewPermissions(normalizePermissions(user.permissions))
          : normalizePermissions(user.permissions)
    });
    setStatus(null);
    scrollToForm();
  }

  function toggleView(user: AdminUser) {
    setExpandedId((current) => (current === user.id ? null : user.id));
  }

  function setRole(role: StaffRole) {
    setForm((current) => ({
      ...current,
      role,
      permissions: role === "normal" ? stripNonViewPermissions(current.permissions) : current.permissions
    }));
  }

  function togglePermission(module: AdminModule, action: keyof AdminPermissions[AdminModule]) {
    if (isNormalRole && action !== "view") return;
    setForm((current) => {
      const next = normalizePermissions(current.permissions);
      const enabled = !next[module][action];
      next[module][action] = enabled;
      if (action !== "view" && enabled) {
        next[module].view = true;
      }
      if (action === "view" && !enabled) {
        next[module].create = false;
        next[module].edit = false;
        next[module].delete = false;
      }
      return { ...current, permissions: next };
    });
  }

  function roleLabel(role: string, isSuperAdmin: boolean) {
    if (isSuperAdmin) return t("admin.superAdmin");
    if (role === "normal") return t("admin.roleNormal");
    return t("admin.roleAdmin");
  }

  function accessSummary(user: AdminUser) {
    if (user.is_super_admin) return t("admin.userAllAccess");
    const viewOnly = user.role === "normal";
    const parts = listModules(user)
      .map((module) => {
        const actions = enabledActions(user.permissions, module, viewOnly);
        if (!actions.length) return null;
        const actionText = actions.map((action) => t(actionLabelKey(action))).join(", ");
        return `${t(moduleLabelKey(module))} (${actionText})`;
      })
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : t("admin.userNoAccess");
  }

  async function submitUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const permissions =
      form.role === "normal" ? stripNonViewPermissions(form.permissions) : form.permissions;
    try {
      if (editingId) {
        const payload: {
          username: string;
          role: StaffRole;
          password?: string;
          permissions: AdminPermissions;
        } = {
          username: form.username.trim(),
          role: form.role,
          permissions
        };
        if (form.password.trim()) {
          payload.password = form.password;
        }
        await api.adminSend(`/api/admin/users/${editingId}`, token, "PATCH", payload);
        setStatus(t("admin.userUpdated"));
      } else {
        if (!form.password.trim()) {
          setStatus(t("admin.userPasswordRequired"));
          setSaving(false);
          return;
        }
        await api.adminSend("/api/admin/users", token, "POST", {
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          permissions
        });
        setStatus(t("admin.userCreated"));
      }
      resetForm();
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.userSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user: AdminUser) {
    if (user.is_super_admin) return;
    if (!window.confirm(t("admin.userDeleteConfirm", { username: user.username }))) return;
    setStatus(null);
    try {
      await api.adminSend(`/api/admin/users/${user.id}`, token, "DELETE");
      if (editingId === user.id) resetForm();
      if (expandedId === user.id) setExpandedId(null);
      setStatus(t("admin.userDeleted"));
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.userDeleteFailed"));
    }
  }

  const editableModules = ADMIN_MODULES.filter((module) => module !== "users");
  const permissionActions = isNormalRole
    ? (["view"] as const)
    : (["view", "create", "edit", "delete"] as const);

  return (
    <section className={embedded ? "" : "mt-6 rounded-[2rem] bg-white/5 p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{t("admin.usersTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/60">{t("admin.usersSubtitle")}</p>
        </div>
      </div>

      {status && (
        <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/85">{status}</p>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{t("admin.usersListTitle")}</h3>
          {!loading && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
              {t("admin.usersCount", { count: users.length })}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-white/50">{t("admin.loading")}</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-white/50">{t("admin.noUsers")}</p>
          ) : (
            users.map((user) => {
              const isExpanded = expandedId === user.id;
              const isEditing = editingId === user.id;
              return (
                <div
                  key={user.id}
                  className={`rounded-2xl border bg-white/5 ${isEditing ? "border-forest-400/50" : "border-white/10"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-white">{user.username}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            user.is_super_admin
                              ? "bg-forest-500/20 text-forest-200"
                              : user.role === "normal"
                                ? "bg-sky-500/15 text-sky-200"
                                : "bg-white/10 text-white/70"
                          }`}
                        >
                          {user.is_super_admin && <Shield size={12} className="me-1 inline" />}
                          {roleLabel(user.role, user.is_super_admin)}
                        </span>
                        {isEditing && (
                          <span className="rounded-full bg-forest-500/15 px-2 py-0.5 text-xs text-forest-200">
                            {t("admin.editingUser")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-white/45">
                        {t("admin.userCreatedAt", { date: formatCreatedAt(user.created_at, i18n.language) })}
                      </p>
                      <p className="mt-2 text-sm text-white/65">{accessSummary(user)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleView(user)}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80"
                      >
                        <Eye size={14} />
                        {isExpanded ? t("admin.hideAccess") : t("admin.viewAccess")}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {!user.is_super_admin && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(user)}
                            className="inline-flex items-center gap-1 rounded-xl border border-forest-400/30 px-3 py-2 text-sm text-forest-300"
                          >
                            <Pencil size={14} />
                            {t("admin.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteUser(user)}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-400/20 px-3 py-2 text-sm text-red-300"
                          >
                            <Trash2 size={14} />
                            {t("admin.delete")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/10 px-4 pb-4 pt-3">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">
                        {t("admin.userAccessDetails")}
                      </p>
                      <UserPermissionsMatrix user={user} t={t} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={submitUser}
        className={`mt-6 rounded-2xl border bg-black/20 p-5 ${
          editingId ? "border-forest-400/40" : "border-white/10"
        }`}
      >
        <h3 className="text-lg font-bold">
          {editingId ? t("admin.editUser") : t("admin.addUser")}
        </h3>
        {editingId && (
          <p className="mt-1 text-sm text-white/50">{t("admin.editUserHint")}</p>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className={inputClass}
            required
            placeholder={t("admin.username")}
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
          />
          <input
            className={inputClass}
            type="password"
            placeholder={editingId ? t("admin.newPasswordOptional") : t("admin.password")}
            required={!editingId}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <select
            className={inputClass}
            value={form.role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
          >
            <option value="admin">{t("admin.roleAdmin")}</option>
            <option value="normal">{t("admin.roleNormal")}</option>
          </select>
        </div>
        {isNormalRole && (
          <p className="mt-3 text-xs text-white/50">{t("admin.roleNormalHint")}</p>
        )}

        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="p-3 text-start">{t("admin.permArea")}</th>
                <th className="p-3 text-center">{t("admin.permView")}</th>
                {!isNormalRole && (
                  <>
                    <th className="p-3 text-center">{t("admin.permAdd")}</th>
                    <th className="p-3 text-center">{t("admin.permEdit")}</th>
                    <th className="p-3 text-center">{t("admin.permDelete")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {editableModules.map((module) => (
                <tr key={module} className="border-t border-white/10">
                  <td className="p-3 font-semibold">{t(moduleLabelKey(module))}</td>
                  {permissionActions.map((action) => (
                    <td key={action} className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={form.permissions[module][action]}
                        onChange={() => togglePermission(module, action)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-forest-500 px-5 py-3 font-bold disabled:opacity-60"
          >
            <UserPlus size={16} />
            {saving ? t("admin.saving") : editingId ? t("admin.saveUser") : t("admin.createUser")}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 px-5 py-3 font-bold">
              {t("admin.cancel")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}