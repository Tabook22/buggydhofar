import { ReactNode } from "react";

export function HeroSection({ children }: { children: ReactNode }) {
  return <section className="hero-bg relative min-h-screen overflow-hidden px-4 pb-20 pt-32 sm:px-6 lg:px-8">{children}</section>;
}
