"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

export function ServiceCard({
  service,
  propertySlug,
}: {
  service: Tables<"service">;
  propertySlug: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          propertySlug,
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data?.error || "Couldn't start checkout. Please try again.");
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{service.name}</CardTitle>
            {service.description && (
              <CardDescription className="mt-1">
                {service.description}
              </CardDescription>
            )}
          </div>
          <span className="text-xl font-bold">
            ${(service.price_cents / 100).toFixed(2)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <Button onClick={handlePurchase} disabled={loading} className="w-full">
          <ShoppingBag className="h-4 w-4 mr-2" />
          {loading ? "Processing..." : "Purchase"}
        </Button>
      </CardContent>
    </Card>
  );
}
