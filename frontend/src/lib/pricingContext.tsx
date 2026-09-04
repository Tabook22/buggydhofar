import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, DEFAULT_PUBLIC_PRICING, PublicPricing } from "../api/client";

const PricingContext = createContext<PublicPricing>(DEFAULT_PUBLIC_PRICING);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [pricing, setPricing] = useState<PublicPricing>(DEFAULT_PUBLIC_PRICING);

  useEffect(() => {
    let active = true;
    api
      .getPricing()
      .then((data) => {
        if (active) setPricing(data);
      })
      .catch(() => {
        if (active) setPricing(DEFAULT_PUBLIC_PRICING);
      });
    return () => {
      active = false;
    };
  }, []);

  return <PricingContext.Provider value={pricing}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  return useContext(PricingContext);
}
