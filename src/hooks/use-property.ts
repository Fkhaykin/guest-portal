"use client";

import { createContext, useContext } from "react";
import type { Tables } from "@/types/database";

export type Property = Tables<"property">;

export const PropertyContext = createContext<Property | null>(null);

export function useProperty() {
  const property = useContext(PropertyContext);
  if (!property) {
    throw new Error("useProperty must be used within a PropertyProvider");
  }
  return property;
}
