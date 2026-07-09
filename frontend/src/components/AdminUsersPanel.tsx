import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Eye, Shield, Trash2, UserPlus } from "lucide-react";
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

function formFromUser(user: AdminUser): UserForm {
  const role = manageableRole(user.role);
  return {
    username: user.username,
    password: "",
    role,
    permissions:
      role === "normal"
        ? stripNonViewPermissions(normalizePermissions(user.permissions))
        : normalizePermissions(user.permissions)
  };
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
    return <p className="text-sm text-forest-200">{t("admin.userAllAccess")}</p>;
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

function PermissionsEditor({
  form,
  isNormalRole,
  onToggle,
  t
}: {
  form: UserForm;
  isNormalRole: boolean;
  onToggle: (module: AdminModule, action: keyof AdminPermissions[AdminModule]) => void;
  t: (key: string) => string;
}) {
  const editableModules = ADMIN_MODULES.filter((module) => module !== "users");
  const permissionActions = isNormalRole
    ? (["view"] as const)
    : (["view", "create", "edit", "delete"] as const);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-white/5 text-white/60">
          <tr>
            <th className="p-2 text-start">{t("admin.permArea")}</th>
            <th className="p-2 text-center">{t("admin.permView")}</th>
            {!isNormalRole && (
              <>
                <th className="p-2 text-center">{t("admin.permAdd")}</th>
                <th className="p-2 text-center">{t("admin.permEdit")}</th>
                <th className="p-2 text-center">{t("admin.permDelete")}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {editableModules.map((module) => (
            <tr key={module} className="border-t border-white/10">
              <td className="p-2 font-semibold">{t(moduleLabelKey(module))}</td>
              {permissionActions.map((action) => (
                <td key={action} className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={form.permissions[module][action]}
                    onChange={() => onToggle(module, action)}
                  />
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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editForm, setEditForm] = useState<UserForm | null>(null);
  const [addForm, setAddForm] = useState<UserForm>({
    username: "",
    password: "",
    role: "admin",
    permissions: emptyPermissions()
  });

  const isEditingAdd = showAddForm && editingId === null;
  const isNormalEditRole = editForm?.role === "normal";
  const isNormalAddRole = addForm.role === "normal";

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

  function resetAddForm() {
    setShowAddForm(false);
    setAddForm({ username: "", password: "", role: "admin", permissions: emptyPermissions() });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  function selectUser(user: AdminUser) {
    if (user.is_super_admin) {
      setExpandedId((current) => (current === user.id ? null : user.id));
      cancelEdit();
      return;
    }
    setShowAddForm(false);
    setEditingId(user.id);
    setExpandedId(null);
    setEditForm(formFromUser(user));
    setStatus(null);
  }

  function toggleView(user: AdminUser, event: React.MouseEvent) {
    event.stopPropagation();
    if (editingId === user.id) return;
    setExpandedId((current) => (current === user.id ? null : user.id));
  }

  function setEditRole(role: StaffRole) {
    setEditForm((current) => {
      if (!current) return current;
      return {
        ...current,
        role,
        permissions: role === "normal" ? stripNonViewPermissions(current.permissions) : current.permissions
      };
    });
  }

  function setAddRole(role: StaffRole) {
    setAddForm((current) => ({
      ...current,
      role,
      permissions: role === "normal" ? stripNonViewPermissions(current.permissions) : current.permissions
    }));
  }

  function toggleEditPermission(module: AdminModule, action: keyof AdminPermissions[AdminModule]) {
    if (!editForm || (isNormalEditRole && action !== "view")) return;
    setEditForm((current) => {
      if (!current) return current;
      const next = normalizePermissions(current.permissions);
      const enabled = !next[module][action];
      next[module][action] = enabled;
      if (action !== "view" && enabled) next[module].view = true;
      if (action === "view" && !enabled) {
        next[module].create = false;
        next[module].edit = false;
        next[module].delete = false;
      }
      return { ...current, permissions: next };
    });
  }

  function toggleAddPermission(module: AdminModule, action: keyof AdminPermissions[AdminModule]) {
    if (isNormalAddRole && action !== "view") return;
    setAddForm((current) => {
      const next = normalizePermissions(current.permissions);
      const enabled = !next[module][action];
      next[module][action] = enabled;
      if (action !== "view" && enabled) next[module].view = true;
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

  async function saveEdit(event: FormEvent, userId: number) {
    event.preventDefault();
    if (!editForm) return;
    setSaving(true);
    setStatus(null);
    const permissions =
      editForm.role === "normal" ? stripNonViewPermissions(editForm.permissions) : editForm.permissions;
    try {
      const payload: {
        username: string;
        role: StaffRole;
        password?: string;
        permissions: AdminPermissions;
      } = {
        username: editForm.username.trim(),
        role: editForm.role,
        permissions
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }
      await api.adminSend(`/api/admin/users/${userId}`, token, "PATCH", payload);
      setStatus(t("admin.userUpdated"));
      cancelEdit();
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.userSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveNewUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const permissions =
      addForm.role === "normal" ? stripNonViewPermissions(addForm.permissions) : addForm.permissions;
    try {
      if (!addForm.password.trim()) {
        setStatus(t("admin.userPasswordRequired"));
        setSaving(false);
        return;
      }
      await api.adminSend("/api/admin/users", token, "POST", {
        username: addForm.username.trim(),
        password: addForm.password,
        role: addForm.role,
        permissions
      });
      setStatus(t("admin.userCreated"));
      resetAddForm();
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.userSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user: AdminUser, event: React.MouseEvent) {
    event.stopPropagation();
    if (user.is_super_admin) return;
    if (!window.confirm(t("admin.userDeleteConfirm", { username: user.username }))) return;
    setStatus(null);
    try {
      await api.adminSend(`/api/admin/users/${user.id}`, token, "DELETE");
      if (editingId === user.id) cancelEdit();
      if (expandedId === user.id) setExpandedId(null);
      setStatus(t("admin.userDeleted"));
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.userDeleteFailed"));
    }
  }

  return (
    <section className={embedded ? "" : "mt-6 rounded-[2rem] bg-white/5 p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{t("admin.usersTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/60">{t("admin.usersSubtitle")}</p>
          <p className="mt-1 text-xs text-white/45">{t("admin.clickUserToEdit")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            cancelEdit();
            setExpandedId(null);
            setShowAddForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-forest-500 px-4 py-2 text-sm font-bold"
        >
          <UserPlus size={16} />
          {t("admin.addUser")}
        </button>
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
              const isEditing = editingId === user.id && editForm !== null;
              const canEdit = !user.is_super_admin;

              return (
                <div
                  key={user.id}
                  className={`rounded-2xl border bg-white/5 transition-colors ${
                    isEditing ? "border-forest-400/60 ring-1 ring-forest-400/20" : "border-white/10"
                  } ${canEdit ? "cursor-pointer hover:border-white/25" : ""}`}
                  onClick={() => selectUser(user)}
                  onKeyDown={(event) => {
                    if (canEdit && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      selectUser(user);
                    }
                  }}
                  role={canEdit ? "button" : undefined}
                  tabIndex={canEdit ? 0 : undefined}
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
                      {!isEditing && <p className="mt-2 text-sm text-white/65">{accessSummary(user)}</p>}
                    </div>

                    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={(event) => toggleView(user, event)}
                          className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80"
                        >
                          <Eye size={14} />
                          {isExpanded ? t("admin.hideAccess") : t("admin.viewAccess")}
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(event) => deleteUser(user, event)}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-400/20 px-3 py-2 text-sm text-red-300"
                        >
                          <Trash2 size={14} />
                          {t("admin.delete")}
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && editForm && (
                    <form
                      className="border-t border-forest-400/20 px-4 pb-4 pt-4"
                      onSubmit={(event) => saveEdit(event, user.id)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <p className="mb-4 text-sm text-white/70">{t("admin.editUserHint")}</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/50">{t("admin.username")}</span>
                          <input
                            className={inputClass}
                            required
                            value={editForm.username}
                            onChange={(event) => setEditForm({ ...editForm, username: event.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/50">{t("admin.changePassword")}</span>
                          <input
                            className={inputClass}
                            type="password"
                            placeholder={t("admin.newPasswordOptional")}
                            value={editForm.password}
                            onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs text-white/50">{t("admin.userRoleLabel")}</span>
                          <select
                            className={inputClass}
                            value={editForm.role}
                            onChange={(event) => setEditRole(event.target.value as StaffRole)}
                          >
                            <option value="admin">{t("admin.roleAdmin")}</option>
                            <option value="normal">{t("admin.roleNormal")}</option>
                          </select>
                        </label>
                      </div>
                      {isNormalEditRole && (
                        <p className="mt-3 text-xs text-white/50">{t("admin.roleNormalHint")}</p>
                      )}
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                          {t("admin.userAccessDetails")}
                        </p>
                        <PermissionsEditor
                          form={editForm}
                          isNormalRole={isNormalEditRole}
                          onToggle={toggleEditPermission}
                          t={t}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-2xl bg-forest-500 px-5 py-3 font-bold disabled:opacity-60"
                        >
                          {saving ? t("admin.saving") : t("admin.saveUser")}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            cancelEdit();
                          }}
                          className="rounded-2xl border border-white/10 px-5 py-3 font-bold"
                        >
                          {t("admin.cancel")}
                        </button>
                      </div>
                    </form>
                  )}

                  {isExpanded && !isEditing && (
                    <div className="border-t border-white/10 px-4 pb-4 pt-3" onClick={(event) => event.stopPropagation()}>
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

      {isEditingAdd && (
        <form
          onSubmit={saveNewUser}
          className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5"
        >
          <h3 className="text-lg font-bold">{t("admin.addUser")}</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">{t("admin.username")}</span>
              <input
                className={inputClass}
                required
                value={addForm.username}
                onChange={(event) => setAddForm({ ...addForm, username: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">{t("admin.password")}</span>
              <input
                className={inputClass}
                type="password"
                required
                value={addForm.password}
                onChange={(event) => setAddForm({ ...addForm, password: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-white/50">{t("admin.userRoleLabel")}</span>
              <select
                className={inputClass}
                value={addForm.role}
                onChange={(event) => setAddRole(event.target.value as StaffRole)}
              >
                <option value="admin">{t("admin.roleAdmin")}</option>
                <option value="normal">{t("admin.roleNormal")}</option>
              </select>
            </label>
          </div>
          {isNormalAddRole && (
            <p className="mt-3 text-xs text-white/50">{t("admin.roleNormalHint")}</p>
          )}
          <div className="mt-4">
            <PermissionsEditor
              form={addForm}
              isNormalRole={isNormalAddRole}
              onToggle={toggleAddPermission}
              t={t}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-forest-500 px-5 py-3 font-bold disabled:opacity-60"
            >
              <UserPlus size={16} />
              {saving ? t("admin.saving") : t("admin.createUser")}
            </button>
            <button type="button" onClick={resetAddForm} className="rounded-2xl border border-white/10 px-5 py-3 font-bold">
              {t("admin.cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}