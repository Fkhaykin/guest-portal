"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const password = formData.get("password") as string;

    try {
      const res = await fetch("/api/cleaner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });

      if (res.ok) {
        router.push("/cleaner");
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error || "Login failed");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setLoading(false);
  }

  return (
    <Card className="shadow-lg ring-1 ring-border/60">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="Your name"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
