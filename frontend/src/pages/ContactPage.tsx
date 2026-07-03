import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageShell } from "../components/Layout";

export default function ContactPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const inputClass = "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition focus:border-forest-400";

  function submit(event: FormEvent) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <PageShell>
      <main className="hero-bg px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div>
            <h1 className="text-5xl font-black">{t("contact.title")}</h1>
            <p className="mt-4 max-w-xl text-white/70">{t("contact.subtitle")}</p>
            <div className="mt-8 rounded-3xl bg-white/10 p-6 text-white/75">
              <p>Salalah, Dhofar, Oman</p>
              <p className="mt-2">+968 9000 0000</p>
              <p className="mt-2">booking@khareefadventure.om</p>
            </div>
          </div>
          <form onSubmit={submit} className="glass rounded-[2rem] p-8">
            <div className="grid gap-4">
              <input required className={inputClass} placeholder={t("booking.fullName")} />
              <input required className={inputClass} placeholder={t("booking.phone")} />
              <input required type="email" className={inputClass} placeholder={t("booking.email")} />
              <textarea required rows={5} className={inputClass} placeholder={t("contact.message")} />
              <button className="rounded-2xl bg-forest-500 px-6 py-4 font-bold text-white">{t("contact.send")}</button>
              {sent && <p className="text-forest-400">{t("booking.confirmed")}</p>}
            </div>
          </form>
        </div>
      </main>
    </PageShell>
  );
}
