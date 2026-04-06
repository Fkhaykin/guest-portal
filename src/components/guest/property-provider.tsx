"use client";

import { PropertyContext, type Property } from "@/hooks/use-property";

export function PropertyProvider({
  property,
  children,
}: {
  property: Property;
  children: React.ReactNode;
}) {
  return (
    <PropertyContext.Provider value={property}>
      {children}
    </PropertyContext.Provider>
  );
}
