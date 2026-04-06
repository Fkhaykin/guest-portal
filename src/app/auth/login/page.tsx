"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [method, setMethod] = useState<"email" | "password">("password");
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
  );
  const redirect = searchParams.get("redirect") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (method === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email: value,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        window.location.href = redirect;
      }
    } else if (method === "email") {
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    }

    setLoading(false);
  }

  if (sent) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a magic link to <strong>{value}</strong>. Click the link to
              sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSent(false);
                setValue("");
              }}
            >
              Try a different method
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your email to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={method === "password" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMethod("password");
                  setValue("");
                  setPassword("");
                }}
              >
                Password
              </Button>
              <Button
                type="button"
                variant={method === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMethod("email");
                  setValue("");
                }}
              >
                Email
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-input">Email address</Label>
              <Input
                id="auth-input"
                type="email"
                placeholder="you@example.com"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>

            {method === "password" && (
              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Signing in..."
                : method === "password"
                  ? "Sign in"
                  : "Send magic link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
