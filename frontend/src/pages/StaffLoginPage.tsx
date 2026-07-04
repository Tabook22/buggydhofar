import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ScanLine } from "lucide-react";
import { api, STAFF_TOKEN_KEY } from "../api/client";

const inputClass = "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none focus:border-forest-400";

export default function StaffLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [login, setLogin] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await api.staffLogin(login.username, login.password);
      localStorage.setItem(STAFF_TOKEN_KEY, response.access_token);
      navigate("/staff/scan", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("staff.loginFailed"));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-forest-950 p-4 text-white">
      <form onSubmit={submitLogin} className="glass w-full max-w-md rounded-[2rem] p-8">
        <ScanLine className="mx-auto text-forest-400" size={48} />
        <h1 className="mt-4 text-center text-3xl font-black">{t("staff.portalTitle")}</h1>
        <p className="mt-2 text-center text-sm text-white/60">{t("staff.portalSubtitle")}</p>
        {error && <p className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>}
        <div className="mt-6 space-y-4">
          <input
            className={inputClass}
            value={login.username}
            onChange={(event) => setLogin({ ...login, username: event.target.value })}
            placeholder={t("admin.username")}
            autoComplete="username"
            required
          />
          <input
            className={inputClass}
            type="password"
            value={login.password}
            onChange={(event) => setLogin({ ...login, password: event.target.value })}
            placeholder={t("admin.password")}
            autoComplete="current-password"
            required
          />
          <button type="submit" className="w-full rounded-2xl bg-forest-500 px-5 py-3 font-bold">
            {t("staff.signIn")}
          </button>
        </div>
      </form>
    </main>
  );
}
