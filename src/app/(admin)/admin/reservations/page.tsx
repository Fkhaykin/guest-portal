"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
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
import type { GuestListEntry, PetEntry } from "@/types/database";

type Property = {
  id: string;
  name: string;
  nickname: string | null;
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
  total_amount_cents: number;
  guest_list: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  created_at: string;
  guest: { full_name: string; email: string | null; phone: string | null } | null;
  property: { name: string; nickname: string | null } | null;
};

export default function AdminReservationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperties();
    loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProperties() {
    const { data } = await supabase
      .from("property")
      .select("id, name, nickname")
      .order("name");
    if (data) setProperties(data);
  }

  async function loadRegistrations() {
    setLoading(true);
    const { data } = await supabase
      .from("registration")
      .select("id, property_id, check_in_date, check_out_date, num_guests, status, booking_source, signature_url, total_amount_cents, guest_list, pets, created_at, guest:guest_id(full_name, email, phone), property:property_id(name, nickname)")
      .order("check_in_date", { ascending: false });
    if (data) setRegistrations(data as unknown as Registration[]);
    setLoading(false);
  }

  function getGuestBreakdown(reg: Registration) {
    const list = reg.guest_list ?? [];
    const adults = list.filter((g) => g.age_group === "over_21").length;
    const children = list.filter((g) => g.age_group === "under_21").length;
    const infants = list.filter((g) => g.age_group === "infant").length;
    const petCount = reg.pets?.length ?? 0;
    return { adults, children, infants, pets: petCount };
  }

  function formatCents(cents: number) {
    if (!cents) return "—";
    return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function cleanSourceName(source: string) {
    return source
      .replace(/\s*integration\s*/i, "")
      .replace(/\s*api\s*/i, "")
      .trim();
  }

  function getDisplayStatus(reg: Registration): "past" | "current" | "future" | "cancelled" {
    if (reg.status === "cancelled") return "cancelled";
    const today = new Date().toISOString().split("T")[0];
    if (reg.check_out_date <= today) return "past";
    if (reg.check_in_date <= today) return "current";
    return "future";
  }

  const filtered = registrations.filter((reg) => {
    if (selectedProperty !== "all" && reg.property_id !== selectedProperty) return false;
    if (selectedStatus !== "all" && getDisplayStatus(reg) !== selectedStatus) return false;
    if (onlyCompleted && !reg.signature_url) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reservations</h1>
        <p className="text-muted-foreground">All reservations across properties</p>
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
                {p.nickname || p.name}
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
            <SelectItem value="current">Current</SelectItem>
            <SelectItem value="future">Future</SelectItem>
            <SelectItem value="past">Past</SelectItem>
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
                <TableHead>Revenue</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((reg) => {
                const guest = reg.guest as Registration["guest"];
                const breakdown = getGuestBreakdown(reg);
                return (
                  <TableRow
                    key={reg.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/reservations/${reg.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{guest?.full_name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {guest?.email || guest?.phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {reg.property?.nickname || reg.property?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{reg.check_in_date}</TableCell>
                    <TableCell className="text-sm">{reg.check_out_date}</TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                          {breakdown.adults > 0 && <span>{breakdown.adults} adult{breakdown.adults !== 1 ? "s" : ""}</span>}
                          {breakdown.children > 0 && <span>{breakdown.children} child{breakdown.children !== 1 ? "ren" : ""}</span>}
                          {breakdown.infants > 0 && <span>{breakdown.infants} infant{breakdown.infants !== 1 ? "s" : ""}</span>}
                          {breakdown.pets > 0 && <span>{breakdown.pets} pet{breakdown.pets !== 1 ? "s" : ""}</span>}
                          {breakdown.adults === 0 && breakdown.children === 0 && breakdown.infants === 0 && breakdown.pets === 0 && (
                            <span className="text-muted-foreground">{reg.num_guests} guest{reg.num_guests !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatCents(reg.total_amount_cents)}
                    </TableCell>
                    <TableCell>
                      {reg.booking_source ? (
                        <span className="text-sm capitalize">{cleanSourceName(reg.booking_source)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const displayStatus = getDisplayStatus(reg);
                        return (
                          <Badge
                            variant={
                              displayStatus === "current"
                                ? "default"
                                : displayStatus === "future"
                                  ? "secondary"
                                  : displayStatus === "cancelled"
                                    ? "destructive"
                                    : "outline"
                            }
                          >
                            {displayStatus}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground">No reservations found.</p>
      )}
    </div>
  );
}
