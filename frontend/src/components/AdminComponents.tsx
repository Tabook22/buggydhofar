import { ReactNode } from "react";

export function AdminSidebar({ children }: { children: ReactNode }) {
  return <aside className="rounded-[2rem] bg-white/5 p-5">{children}</aside>;
}

export function AdminStatsCards({ stats }: { stats: Array<[string, string | number]> }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="soft-card rounded-3xl p-6">
          <p className="text-white/60">{label}</p>
          <p className="mt-3 text-3xl font-black text-forest-400">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function AdminBookingsTable({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-[2rem] bg-white/5 p-6">{children}</div>;
}
