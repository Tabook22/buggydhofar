import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, SiteContent } from "../api/client";

const SiteContentContext = createContext<SiteContent | null>(null);

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getSiteContent()
      .then((data) => {
        if (active) setContent(data);
      })
      .catch(() => {
        if (active) setContent(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return <SiteContentContext.Provider value={content}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}