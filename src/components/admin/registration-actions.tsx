"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Download, Eye, Mail, Loader2, Pencil, Camera } from "lucide-react";
import { EditRegistrationDialog } from "@/components/admin/edit-registration-dialog";
import { CleaningPhotosDialog } from "@/components/admin/cleaning-photos-dialog";

export function RegistrationActions({
  registrationId,
  hasSignature,
  guestName,
  onUpdated,
}: {
  registrationId: string;
  hasSignature: boolean;
  guestName?: string;
  onUpdated?: () => void;
}) {
  const [emailing, setEmailing] = useState(false);
  const [emailResult, setEmailResult] = useState<"success" | "error" | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailNote, setEmailNote] = useState("");

  async function handleEmail() {
    setEmailing(true);
    setEmailResult(null);
    const note = emailNote.trim();
    try {
      const res = await fetch("/api/pepoa/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, ...(note ? { note } : {}) }),
      });
      setEmailResult(res.ok ? "success" : "error");
      if (res.ok) {
        setEmailOpen(false);
        setEmailNote("");
      }
    } catch {
      setEmailResult("error");
    } finally {
      setEmailing(false);
      setTimeout(() => setEmailResult(null), 3000);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          title="Cleaning photos"
          onClick={() => setPhotosOpen(true)}
        >
          <Camera className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Edit registration"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        {hasSignature ? (
          <>
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
              title={emailResult === "success" ? "Sent!" : emailResult === "error" ? "Failed to send" : "Email to HOA"}
              onClick={() => setEmailOpen(true)}
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
          </>
        ) : (
          <Button variant="ghost" size="icon" title="Registration incomplete" disabled>
            <Eye className="h-4 w-4 opacity-50" />
          </Button>
        )}
      </div>
      <EditRegistrationDialog
        registrationId={registrationId}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={onUpdated}
      />
      <CleaningPhotosDialog
        open={photosOpen}
        onOpenChange={setPhotosOpen}
        registrationId={registrationId}
        guestName={guestName || "Reservation"}
      />
      <Dialog open={emailOpen} onOpenChange={(open) => { if (!emailing) setEmailOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email registration to HOA</DialogTitle>
            <DialogDescription>
              Sends the registration PDF for {guestName || "this reservation"} to the HOA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor={`hoa-note-${registrationId}`} className="text-sm font-medium">
                Note (optional)
              </label>
              <Textarea
                id={`hoa-note-${registrationId}`}
                rows={4}
                placeholder="Anything the HOA should know — e.g. late arrival, extra vehicle, corrected dates…"
                value={emailNote}
                onChange={(e) => setEmailNote(e.target.value)}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Added to the email body above the attachment line. Leave blank to send the standard email.
              </p>
            </div>
            {emailResult === "error" && (
              <p className="text-sm text-destructive">Failed to send. Try again.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={emailing}>
                Cancel
              </Button>
              <Button onClick={handleEmail} disabled={emailing}>
                {emailing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                Send to HOA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
