import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { PageShell } from "../components/Layout";

type ContactForm = {
  full_name: string;
  phone: string;
  email: string;
  message: string;
};

const emptyForm: ContactForm = {
  full_name: "",
  phone: "",
  email: "",
  message: ""
};

export default function ContactPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputClass =
    "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-forest-400";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);

    try {
      await api.submitContact({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        message: form.message.trim()
      });
      setSent(true);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("contact.error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <PageShell>
      <main className="hero-bg px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div>
            <h1 className="text-5xl font-black">{t("contact.title")}</h1>
            <p className="mt-4 max-w-xl text-white/70">{t("contact.subtitle")}</p>
            <div className="mt-8 rounded-3xl bg-white/10 p-6 text-white/75">
              <p>{t("contact.location")}</p>
              <p className="mt-2">
                <a href="mailto:info@buggydhofar.com" className="transition hover:text-forest-300">
                  info@buggydhofar.com
                </a>
              </p>
            </div>
          </div>
          <form onSubmit={submit} className="glass rounded-[2rem] p-8">
            <div className="grid gap-4">
              <input
                required
                className={inputClass}
                placeholder={t("booking.fullName")}
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              />
              <input
                required
                className={inputClass}
                placeholder={t("booking.phone")}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
              <input
                required
                type="email"
                className={inputClass}
                placeholder={t("booking.email")}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
              <textarea
                required
                rows={5}
                className={inputClass}
                placeholder={t("contact.message")}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
              />
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
              />
              <button
                type="submit"
                disabled={sending}
                className="rounded-2xl bg-forest-500 px-6 py-4 font-bold text-white transition hover:bg-forest-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? t("contact.sending") : t("contact.send")}
              </button>
              {sent && <p className="text-forest-400">{t("contact.success")}</p>}
              {error && <p className="text-red-400">{error}</p>}
            </div>
          </form>
        </div>
      </main>
    </PageShell>
  );
}