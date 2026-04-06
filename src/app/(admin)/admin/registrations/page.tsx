"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, History } from "lucide-react";

type Property = {
  id: string;
  name: string;
};

type Registration = {
  id: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  status: "active" | "completed" | "cancelled";
  booking_source: string | null;
  signature_url: string | null;
  created_at: string;
  guest: { full_name: string; email: string | null; phone: string | null } | null;
  property: { name: string } | null;
};

type UpdateLog = {
  id: string;
  changed_by: string;
  change_type: string;
  summary: string | null;
  previous_data: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminAllRegistrationsPage() {
  const supabase = createClient();
  const [properties, setProperties] = useState<Property[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Version history dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<UpdateLog[]>([]);
  const [historyGuest, setHistoryGuest] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadProperties();
    loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProperties() {
    const { data } = await supabase
      .from("property")
      .select("id, name")
      .order("name");
    if (data) setProperties(data);
  }

  async function loadRegistrations() {
    setLoading(true);
    const { data } = await supabase
      .from("registration")
      .select("id, property_id, check_in_date, check_out_date, num_guests, status, booking_source, signature_url, created_at, guest:guest_id(full_name, email, phone), property:property_id(name)")
      .order("created_at", { ascending: false });
    if (data) setRegistrations(data as unknown as Registration[]);
    setLoading(false);
  }

  async function openHistory(registrationId: string, guestName: string) {
    setHistoryGuest(guestName);
    setHistoryOpen(true);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("registration_update_log")
      .select("id, changed_by, change_type, summary, previous_data, created_at")
      .eq("registration_id", registrationId)
      .order("created_at", { ascending: false });
    setHistoryLogs(data ?? []);
    setHistoryLoading(false);
  }

  const filtered = registrations.filter((reg) => {
    if (selectedProperty !== "all" && reg.property_id !== selectedProperty) return false;
    if (selectedStatus !== "all" && reg.status !== selectedStatus) return false;
    if (onlyCompleted && !reg.signature_url) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Registrations</h1>
        <p className="text-muted-foreground">All registrations across properties</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedProperty} onValueChange={(v) => setSelectedProperty(v ?? "all")}>
          <SelectTrigger className="w-50">
            <SelectValue placeholder="All properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyCompleted}
            onChange={(e) => setOnlyCompleted(e.target.checked)}
            className="rounded border-input"
          />
          Registration completed
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((reg) => {
                const guest = reg.guest as Registration["guest"];
                return (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{guest?.full_name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {guest?.email || guest?.phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {reg.property?.name ?? "—"}
                    </TableCell>
                    <TableCell>{reg.check_in_date}</TableCell>
                    <TableCell>{reg.check_out_date}</TableCell>
                    <TableCell>{reg.num_guests}</TableCell>
                    <TableCell>
                      {reg.booking_source ? (
                        <span className="text-sm capitalize">{reg.booking_source}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          reg.status === "active"
                            ? "default"
                            : reg.status === "completed"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {reg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {reg.signature_url ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download PDF"
                            render={
                              <a
                                href={`/api/pepoa/generate?registration_id=${reg.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Registration incomplete — no PDF available"
                            disabled
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Version history"
                          onClick={() =>
                            openHistory(reg.id, guest?.full_name ?? "Unknown")
                          }
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground">No registrations found.</p>
      )}

      {/* Version history dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>{historyGuest}</DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading...</p>
          ) : historyLogs.length > 0 ? (
            <div className="space-y-4">
              {historyLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {log.change_type.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  {log.summary && (
                    <p className="text-sm">{log.summary}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    by {log.changed_by}
                  </p>
                  {log.previous_data && Object.keys(log.previous_data).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Previous data
                      </summary>
                      <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.previous_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              No changes recorded for this registration.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
