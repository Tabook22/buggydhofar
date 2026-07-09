import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Shield, Trash2, UserPlus } from "lucide-react";
import { api, isAdminAuthError } from "../api/client";
import {
  ADMIN_MODULES,
  AdminModule,
  AdminPermissions,
  emptyPermissions,
  normalizePermissions
} from "../lib/adminPermissions";

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

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
  permissions: AdminPermissions;
};

function moduleLabelKey(module: AdminModule) {
  return `admin.permModule_${module}`;
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
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>({
    username: "",
    password: "",
    permissions: emptyPermissions()
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGet<AdminUser[]>("/api/admin/users", token);
      setUsers(data);
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
    setForm({ username: "", password: "", permissions: emptyPermissions() });
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: "",
      permissions: normalizePermissions(user.permissions)
    });
    setStatus(null);
  }

  function togglePermission(module: AdminModule, action: keyof AdminPermissions[AdminModule]) {
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

  async function submitUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      if (editingId) {
        const payload: { username: string; password?: string; permissions: AdminPermissions } = {
          username: form.username.trim(),
          permissions: form.permissions
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
          permissions: form.permissions
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
      setStatus(t("admin.userDeleted"));
      await loadUsers();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.userDeleteFailed"));
    }
  }

  const editableModules = ADMIN_MODULES.filter((module) => module !== "users");

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

      <form onSubmit={submitUser} className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <h3 className="text-lg font-bold">{editingId ? t("admin.editUser") : t("admin.addUser")}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="p-3 text-start">{t("admin.permArea")}</th>
                <th className="p-3 text-center">{t("admin.permView")}</th>
                <th className="p-3 text-center">{t("admin.permAdd")}</th>
                <th className="p-3 text-center">{t("admin.permEdit")}</th>
                <th className="p-3 text-center">{t("admin.permDelete")}</th>
              </tr>
            </thead>
            <tbody>
              {editableModules.map((module) => (
                <tr key={module} className="border-t border-white/10">
                  <td className="p-3 font-semibold">{t(moduleLabelKey(module))}</td>
                  {(["view", "create", "edit", "delete"] as const).map((action) => (
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

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-white/50">{t("admin.loading")}</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-white/50">{t("admin.noUsers")}</p>
        ) : (
          users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-4">
              <div>
                <p className="font-bold text-white">
                  {user.username}
                  {user.is_super_admin && (
                    <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-forest-500/20 px-2 py-0.5 text-xs text-forest-200">
                      <Shield size={12} />
                      {t("admin.superAdmin")}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-white/50">{t("admin.userRole", { role: user.role })}</p>
              </div>
              <div className="flex gap-2">
                {!user.is_super_admin && (
                  <>
                    <button type="button" onClick={() => startEdit(user)} className="text-forest-400">
                      {t("admin.edit")}
                    </button>
                    <button type="button" onClick={() => deleteUser(user)} className="inline-flex items-center gap-1 text-red-300">
                      <Trash2 size={14} />
                      {t("admin.delete")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}