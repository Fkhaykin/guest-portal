"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const NewIdsContext = createContext<Set<string>>(new Set());

export function useNewIds() {
  return useContext(NewIdsContext);
}

export function NewIdsProvider({ children }: { children: ReactNode }) {
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = sessionStorage.getItem("newRegistrationIds");
    if (stored) {
      try {
        setNewIds(new Set(JSON.parse(stored)));
      } catch {
        // ignore
      }
      sessionStorage.removeItem("newRegistrationIds");
    }
  }, []);

  return (
    <NewIdsContext.Provider value={newIds}>{children}</NewIdsContext.Provider>
  );
}
