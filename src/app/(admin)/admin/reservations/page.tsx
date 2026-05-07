"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// Button unused after popover trigger refactor
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarRange, ChevronDown, List, RefreshCw, Search, X } from "lucide-react";
import type { GuestListEntry, PetEntry } from "@/types/database";
import { AdminCalendarView, type AdminCalendarEntry, type AdminPropertyGroup } from "@/components/admin/admin-calendar-view";

type Property = {
  id: string;
  name: string;
  nickname: string | null;
  cover_image_url: string | null;
};

type Registration = {
  id: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  lodgify_adults: number;
  lodgify_children: number;
  lodgify_infants: number;
  lodgify_num_pets: number;
  status: "active" | "completed" | "cancelled";
  booking_source: string | null;
  signature_url: string | null;
  total_amount_cents: number;
  guest_list: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  created_at: string;
  updated_at: string;
  booked_at: string | null;
  guest: { full_name: string; email: string | null; phone: string | null } | null;
  property: { name: string; nickname: string | null; cover_image_url: string | null } | null;
};

export default function AdminReservationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<string>("default");
  const [sortAsc, setSortAsc] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  useEffect(() => {
    loadProperties();
    loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProperties() {
    const { data } = await supabase
      .from("property")
      .select("id, name, nickname, cover_image_url")
      .order("name");
    if (data) setProperties(data);
  }

  async function loadRegistrations() {
    setLoading(true);
    const { data } = await supabase
      .from("registration")
      .select("id, property_id, check_in_date, check_out_date, num_guests, lodgify_adults, lodgify_children, lodgify_infants, lodgify_num_pets, status, booking_source, signature_url, total_amount_cents, guest_list, pets, created_at, updated_at, booked_at, guest:guest_id(full_name, email, phone), property:property_id(name, nickname, cover_image_url)")
      .order("check_in_date", { ascending: false });
    if (data) setRegistrations(data as unknown as Registration[]);
    setLoading(false);
  }

  async function handleRefresh() {
    setSyncing(true);
    try {
      const res = await fetch("/api/lodgify/refresh", { method: "POST" });
      const data = await res.json();
      if (data.newIds?.length > 0) {
        setNewIds(new Set(data.newIds));
      }
      await loadRegistrations();
    } catch {
      // silently fail
    } finally {
      setSyncing(false);
    }
  }

  function getGuestBreakdown(reg: Registration) {
    const list = reg.guest_list ?? [];
    const petCount = reg.pets?.length ?? 0;
    const hasLodgifyBreakdown = reg.lodgify_adults > 0 || reg.lodgify_children > 0 || reg.lodgify_infants > 0 || reg.lodgify_num_pets > 0;

    const booked = hasLodgifyBreakdown ? {
      adults: reg.lodgify_adults,
      children: reg.lodgify_children,
      infants: reg.lodgify_infants,
      pets: reg.lodgify_num_pets,
    } : null;

    // Prefer guest_list (manually entered during registration) if it has entries
    const registered = list.length > 0 ? {
      adults: list.filter((g) => g.age_group === "over_21").length,
      children: list.filter((g) => g.age_group === "under_21").length,
      infants: list.filter((g) => g.age_group === "infant").length,
      pets: petCount,
    } : null;

    // Display values: prefer registered, fall back to booked
    const display = registered ?? booked ?? { adults: 0, children: 0, infants: 0, pets: petCount };

    return { booked, registered, display, extraPets: booked ? petCount - booked.pets : 0 };
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
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (reg.check_out_date <= today) return "past";
    if (reg.check_in_date <= today) return "current";
    return "future";
  }

  function toggleSetValue(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  const filtered = registrations.filter((reg) => {
    if (selectedProperties.size > 0 && !selectedProperties.has(reg.property_id)) return false;
    if (selectedStatuses.size > 0 && !selectedStatuses.has(getDisplayStatus(reg))) return false;
    if (onlyCompleted && !reg.signature_url) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const name = reg.guest?.full_name?.toLowerCase() ?? "";
      if (!name.split(" ").some((part) => part.startsWith(q))) return false;
    }
    return true;
  });

  function toggleSort(column: string) {
    if (sortColumn === column) {
      setSortAsc((prev) => !prev);
    } else {
      setSortColumn(column);
      setSortAsc(true);
    }
  }

  function getSortValue(reg: Registration, column: string): string {
    switch (column) {
      case "guest": return reg.guest?.full_name ?? "";
      case "property": return reg.property?.nickname || reg.property?.name || "";
      case "check_in_date": return reg.check_in_date ?? "";
      case "check_out_date": return reg.check_out_date ?? "";
      case "booked": return reg.booked_at || reg.created_at || "";
      case "revenue": return String(reg.total_amount_cents ?? 0).padStart(12, "0");
      case "registered": return reg.signature_url ? reg.updated_at : "";
      case "source": return reg.booking_source ?? "";
      case "status": return getDisplayStatus(reg);
      default: return "";
    }
  }

  const { sorted, dividerIndex } = useMemo(() => {
    if (sortColumn === "default") {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const isPast = (r: Registration) => r.check_out_date < today || r.status === "cancelled";

      const upcoming = filtered
        .filter((r) => !isPast(r))
        .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
      const past = filtered
        .filter(isPast)
        .sort((a, b) => b.check_out_date.localeCompare(a.check_out_date));

      // Pin newly synced rows to the very top, preserving section order otherwise
      const newRows = [...upcoming, ...past].filter((r) => newIds.has(r.id));
      const upcomingRest = upcoming.filter((r) => !newIds.has(r.id));
      const pastRest = past.filter((r) => !newIds.has(r.id));

      return {
        sorted: [...newRows, ...upcomingRest, ...pastRest],
        dividerIndex: pastRest.length > 0 ? newRows.length + upcomingRest.length : -1,
      };
    }

    const sorted = [...filtered].sort((a, b) => {
      const aNew = newIds.has(a.id) ? 0 : 1;
      const bNew = newIds.has(b.id) ? 0 : 1;
      if (aNew !== bNew) return aNew - bNew;

      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);
      const cmp = aVal.localeCompare(bVal);
      return sortAsc ? cmp : -cmp;
    });
    return { sorted, dividerIndex: -1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortColumn, sortAsc, newIds]);

  function SortIcon({ column }: { column: string }) {
    if (sortColumn !== column) return <ArrowUpDown className="inline ml-1 h-3 w-3 text-muted-foreground/50" />;
    return sortAsc
      ? <ArrowUp className="inline ml-1 h-3 w-3" />
      : <ArrowDown className="inline ml-1 h-3 w-3" />;
  }

  const calendarEntries: AdminCalendarEntry[] = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return registrations.map((reg) => {
      const ds = getDisplayStatus(reg);
      const nights = Math.max(1, Math.round(
        (new Date(reg.check_out_date + "T12:00:00").getTime() - new Date(reg.check_in_date + "T12:00:00").getTime()) / 86400000
      ));
      void todayStr;
      return {
        id: reg.id,
        propertyId: reg.property_id,
        propertyName: reg.property?.name ?? "",
        propertyNickname: reg.property?.nickname ?? null,
        propertyCoverImage: reg.property?.cover_image_url ?? null,
        checkIn: reg.check_in_date,
        checkOut: reg.check_out_date,
        numGuests: reg.num_guests,
        lodgifyAdults: reg.lodgify_adults,
        lodgifyChildren: reg.lodgify_children,
        lodgifyInfants: reg.lodgify_infants,
        lodgifyPets: reg.lodgify_num_pets,
        guestName: reg.guest?.full_name ?? null,
        guestEmail: reg.guest?.email ?? null,
        displayStatus: ds,
        totalAmountCents: reg.total_amount_cents ?? 0,
        hasRegistration: !!reg.signature_url,
        bookingSource: reg.booking_source,
        nights,
        bookedAt: reg.booked_at,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrations]);

  const calendarPropertyGroups: AdminPropertyGroup[] = useMemo(() =>
    properties.map((p) => ({
      key: (p.nickname || p.name).toLowerCase(),
      label: p.nickname || p.name,
      coverImage: p.cover_image_url,
    })),
    [properties]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reservations</h1>
          <p className="text-muted-foreground">All reservations across properties</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Refresh from Lodgify"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Name search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-7 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-48"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Property dropdown */}
        <Popover>
          <PopoverTrigger className="inline-flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background hover:bg-accent hover:text-accent-foreground w-50 cursor-pointer">
              {selectedProperties.size === 0
                ? "All properties"
                : selectedProperties.size === 1
                  ? (properties.find((p) => selectedProperties.has(p.id))?.nickname || properties.find((p) => selectedProperties.has(p.id))?.name)
                  : `${selectedProperties.size} properties`}
              <ChevronDown className="h-4 w-4 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground pb-1 mb-1 border-b text-left px-2"
              onClick={() =>
                setSelectedProperties((prev) =>
                  prev.size === properties.length
                    ? new Set()
                    : new Set(properties.map((p) => p.id))
                )
              }
            >
              {selectedProperties.size === properties.length ? "Deselect all" : "Select all"}
            </button>
            {properties.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted cursor-pointer"
                onClick={() => setSelectedProperties((prev) => toggleSetValue(prev, p.id))}
              >
                <Checkbox
                  checked={selectedProperties.has(p.id)}
                  onCheckedChange={() => setSelectedProperties((prev) => toggleSetValue(prev, p.id))}
                />
                <Label className="text-sm cursor-pointer flex-1">
                  {p.nickname || p.name}
                </Label>
              </div>
            ))}
            {selectedProperties.size > 0 && (
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground mt-1 pt-1 border-t"
                onClick={() => setSelectedProperties(new Set())}
              >
                Clear
              </button>
            )}
          </PopoverContent>
        </Popover>

        {/* Status dropdown */}
        <Popover>
          <PopoverTrigger className="inline-flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background hover:bg-accent hover:text-accent-foreground w-44 cursor-pointer">
              {selectedStatuses.size === 0
                ? "All statuses"
                : selectedStatuses.size === 1
                  ? [...selectedStatuses][0]
                  : `${selectedStatuses.size} statuses`}
              <ChevronDown className="h-4 w-4 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2" align="start">
            {(["current", "future", "past", "cancelled"] as const).map((status) => (
              <div
                key={status}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted cursor-pointer"
                onClick={() => setSelectedStatuses((prev) => toggleSetValue(prev, status))}
              >
                <Checkbox
                  checked={selectedStatuses.has(status)}
                  onCheckedChange={() => setSelectedStatuses((prev) => toggleSetValue(prev, status))}
                />
                <Label className="text-sm capitalize cursor-pointer flex-1">
                  {status}
                </Label>
              </div>
            ))}
            {selectedStatuses.size > 0 && (
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground mt-1 pt-1 border-t"
                onClick={() => setSelectedStatuses(new Set())}
              >
                Clear
              </button>
            )}
          </PopoverContent>
        </Popover>

        {/* Registration completed */}
        <div className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            id="only-completed"
            checked={onlyCompleted}
            onCheckedChange={(checked) => setOnlyCompleted(checked === true)}
          />
          <Label htmlFor="only-completed" className="text-sm cursor-pointer">
            Registration completed
          </Label>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${filtered.length} reservation${filtered.length !== 1 ? "s" : ""}`}
        </p>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 gap-1.5 text-xs"
            onClick={() => setViewMode("list")}
          >
            <List className="h-3.5 w-3.5" />
            List
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 gap-1.5 text-xs"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Calendar
          </Button>
        </div>
      </div>

      {/* Calendar view */}
      {viewMode === "calendar" && !loading && (
        <AdminCalendarView entries={calendarEntries} propertyGroups={calendarPropertyGroups} />
      )}

      {/* Table / Cards */}
      {viewMode === "list" && (loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("guest")}>Guest <SortIcon column="guest" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("property")}>Property <SortIcon column="property" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("booked")}>Booked <SortIcon column="booked" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("check_in_date")}>Check-in <SortIcon column="check_in_date" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("check_out_date")}>Check-out <SortIcon column="check_out_date" /></TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("registered")}>Registered <SortIcon column="registered" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("revenue")}>Revenue <SortIcon column="revenue" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("source")}>Source <SortIcon column="source" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>Status <SortIcon column="status" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((reg, idx) => {
                  const guest = reg.guest as Registration["guest"];
                  const breakdown = getGuestBreakdown(reg);
                  const showDivider = idx === dividerIndex && dividerIndex > 0;
                  return (
                    <Fragment key={reg.id}>
                    {showDivider && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={10} className="bg-muted/40 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium text-center">
                          Past reservations
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow
                      className={`cursor-pointer hover:bg-muted/50 ${newIds.has(reg.id) ? "bg-green-50 dark:bg-green-950/20 border-l-2 border-l-green-500" : ""}`}
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
                      <TableCell className="text-sm">
                        {(reg.booked_at || reg.created_at) ? new Date(reg.booked_at || reg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{reg.check_in_date}</TableCell>
                      <TableCell className="text-sm">{reg.check_out_date}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {breakdown.booked ? (
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                              {breakdown.booked.adults > 0 && <span>{breakdown.booked.adults}A</span>}
                              {breakdown.booked.children > 0 && <span>{breakdown.booked.children}C</span>}
                              {breakdown.booked.infants > 0 && <span>{breakdown.booked.infants}I</span>}
                              {breakdown.booked.pets > 0 && <span>{breakdown.booked.pets}P</span>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{reg.num_guests} guest{reg.num_guests !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {breakdown.registered ? (
                          <div className="text-xs space-y-0.5">
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                              {breakdown.registered.adults > 0 && <span>{breakdown.registered.adults}A</span>}
                              {breakdown.registered.children > 0 && <span>{breakdown.registered.children}C</span>}
                              {breakdown.registered.infants > 0 && <span>{breakdown.registered.infants}I</span>}
                              {breakdown.registered.pets > 0 && (
                                <span className={breakdown.extraPets > 0 ? "text-amber-600 font-medium" : ""}>
                                  {breakdown.registered.pets}P{breakdown.extraPets > 0 && ` (+${breakdown.extraPets})`}
                                </span>
                              )}
                            </div>
                            {reg.signature_url && (
                              <p className="text-muted-foreground">
                                {new Date(reg.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
                          const colors = {
                            current: "bg-blue-100 text-blue-800 border-blue-200",
                            future: "bg-green-100 text-green-800 border-green-200",
                            past: "bg-yellow-100 text-yellow-800 border-yellow-200",
                            cancelled: "bg-red-100 text-red-800 border-red-200",
                          };
                          return (
                            <Badge variant="outline" className={colors[displayStatus]}>
                              {displayStatus}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {sorted.map((reg, idx) => {
              const guest = reg.guest as Registration["guest"];
              const breakdown = getGuestBreakdown(reg);
              const displayStatus = getDisplayStatus(reg);
              const statusColors = {
                current: "bg-blue-100 text-blue-800 border-blue-200",
                future: "bg-green-100 text-green-800 border-green-200",
                past: "bg-yellow-100 text-yellow-800 border-yellow-200",
                cancelled: "bg-red-100 text-red-800 border-red-200",
              };
              const showDivider = idx === dividerIndex && dividerIndex > 0;
              return (
                <Fragment key={reg.id}>
                {showDivider && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="h-px bg-border flex-1" />
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Past reservations</span>
                    <div className="h-px bg-border flex-1" />
                  </div>
                )}
                <div
                  className={`rounded-lg border bg-card p-4 space-y-3 cursor-pointer active:bg-muted/50 ${newIds.has(reg.id) ? "border-l-4 border-l-green-500" : ""}`}
                  onClick={() => router.push(`/admin/reservations/${reg.id}`)}
                >
                  {/* Guest + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{guest?.full_name ?? "Unknown"}</p>
                      {(guest?.email || guest?.phone) && (
                        <p className="text-xs text-muted-foreground truncate">{guest?.email || guest?.phone}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reg.property?.nickname || reg.property?.name || "—"}
                      </p>
                    </div>
                    <Badge variant="outline" className={`${statusColors[displayStatus]} shrink-0`}>
                      {displayStatus}
                    </Badge>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>{new Date(reg.check_in_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{new Date(reg.check_out_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                  </div>

                  {/* Guest counts */}
                  <div className="grid grid-cols-2 gap-x-4 text-xs">
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Booked</p>
                      {breakdown.booked ? (
                        <div className="flex gap-2 text-muted-foreground">
                          {breakdown.booked.adults > 0 && <span>{breakdown.booked.adults}A</span>}
                          {breakdown.booked.children > 0 && <span>{breakdown.booked.children}C</span>}
                          {breakdown.booked.infants > 0 && <span>{breakdown.booked.infants}I</span>}
                          {breakdown.booked.pets > 0 && <span>{breakdown.booked.pets}P</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{reg.num_guests} guest{reg.num_guests !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Registered</p>
                      {breakdown.registered ? (
                        <div className="space-y-0.5">
                          <div className="flex gap-2">
                            {breakdown.registered.adults > 0 && <span>{breakdown.registered.adults}A</span>}
                            {breakdown.registered.children > 0 && <span>{breakdown.registered.children}C</span>}
                            {breakdown.registered.infants > 0 && <span>{breakdown.registered.infants}I</span>}
                            {breakdown.registered.pets > 0 && (
                              <span className={breakdown.extraPets > 0 ? "text-amber-600 font-medium" : ""}>
                                {breakdown.registered.pets}P{breakdown.extraPets > 0 && ` (+${breakdown.extraPets})`}
                              </span>
                            )}
                          </div>
                          {reg.signature_url && (
                            <p className="text-muted-foreground">
                              {new Date(reg.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  {/* Revenue + source + booked date */}
                  <div className="flex items-center justify-between pt-1 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      {reg.total_amount_cents ? (
                        <span className="font-medium text-foreground">{formatCents(reg.total_amount_cents)}</span>
                      ) : null}
                      {reg.booking_source && (
                        <span className="capitalize">{cleanSourceName(reg.booking_source)}</span>
                      )}
                    </div>
                    <span>
                      {(reg.booked_at || reg.created_at)
                        ? new Date(reg.booked_at || reg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : ""}
                    </span>
                  </div>
                </div>
                </Fragment>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">No reservations found.</p>
      ))}
    </div>
  );
}
