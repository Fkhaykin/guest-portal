"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Eye, Mail, Loader2 } from "lucide-react";

export function RegistrationActions({ registrationId, hasSignature }: { registrationId: string; hasSignature: boolean }) {
  const [emailing, setEmailing] = useState(false);
  const [emailResult, setEmailResult] = useState<"success" | "error" | null>(null);

  async function handleEmail() {
    setEmailing(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/pepoa/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId }),
      });
      setEmailResult(res.ok ? "success" : "error");
    } catch {
      setEmailResult("error");
    } finally {
      setEmailing(false);
      setTimeout(() => setEmailResult(null), 3000);
    }
  }

  if (!hasSignature) {
    return (
      <Button variant="ghost" size="icon" title="Registration incomplete" disabled>
        <Eye className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <a
        href={`/api/pepoa/generate?registration_id=${registrationId}&disposition=inline`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="ghost" size="icon" title="View PDF">
          <Eye className="h-4 w-4" />
        </Button>
      </a>
      <a
        href={`/api/pepoa/generate?registration_id=${registrationId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="ghost" size="icon" title="Download PDF">
          <Download className="h-4 w-4" />
        </Button>
      </a>
      <Button
        variant="ghost"
        size="icon"
        title={emailResult === "success" ? "Sent!" : emailResult === "error" ? "Failed to send" : "Email to admin"}
        onClick={handleEmail}
        disabled={emailing}
      >
        {emailing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : emailResult === "success" ? (
          <Mail className="h-4 w-4 text-green-600" />
        ) : emailResult === "error" ? (
          <Mail className="h-4 w-4 text-red-600" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
