"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Pencil,
  Eye,
  Download,
  Mail,
  History,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  PawPrint,
  Car,
  CalendarDays,
  DollarSign,
  Home,
  ClipboardCheck,
  Camera,
  Clock,
  Baby,
  ChevronDown,
  User,
  Sparkles,
  Check,
} from "lucide-react";
import { EditRegistrationDialog } from "@/components/admin/edit-registration-dialog";
import type { GuestListEntry, PetEntry, UpsellEntry, CleaningPhoto, CleaningChecklistItem, InvoiceLineItem, InvoiceStatus } from "@/types/database";
import { ReceiptText } from "lucide-react";

type FullRegistration = {
  id: string;
  property_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  notes: string | null;
  status: "active" | "completed" | "cancelled";
  booking_source: string | null;
  signature_url: string | null;
  total_amount_cents: number;
  guest_list: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  upsells: UpsellEntry[] | null;
  lodgify_booking_id: number | null;
  tips: Record<string, unknown> | null;
  lodgify_adults: number;
  lodgify_children: number;
  lodgify_infants: number;
  lodgify_num_pets: number;
  created_at: string;
  updated_at: string;
  guest: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    mailing_address: string | null;
    lodgify_guest_id: number | null;
  } | null;
  property: {
    id: string;
    name: string;
    nickname: string | null;
    address: string | null;
    slug: string;
    max_guests: number;
    lodgify_property_id: number | null;
    listing_urls: Record<string, string>;
    owner_name: string | null;
    owner_phone: string | null;
    owner_email: string | null;
    hoa_submission_email: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  } | null;
};

type Vehicle = {
  id: string;
  year: string | null;
  make: string | null;
  model: string | null;
  color: string | null;
  license_plate: string;
  state_or_region: string | null;
  driver_name: string | null;
};

type CleaningStatus = {
  id: string;
  is_cleaned: boolean;
  cleaned_at: string | null;
  photos: CleaningPhoto[];
  checklist: CleaningChecklistItem[];
  notes: string | null;
  cleaner_id: string | null;
};

type UpdateLog = {
  id: string;
  changed_by: string;
  change_type: string;
  summary: string | null;
  previous_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type EmailLog = {
  id: string;
  sent_to: string[];
  subject: string | null;
  body_summary: string | null;
  email_type: string;
  is_update: boolean;
  created_at: string;
};

type IncurredCharge = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  cleanerName: string;
  description: string;
  amount: number; // cents
  expenseDate: string;
  notes: string | null;
};

export default function ReservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [reg, setReg] = useState<FullRegistration | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [cleaning, setCleaning] = useState<CleaningStatus | null>(null);
  const [prevCleaning, setPrevCleaning] = useState<CleaningStatus | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<UpdateLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [charges, setCharges] = useState<IncurredCharge[]>([]);
  const [emailing, setEmailing] = useState(false);
  const [emailResult, setEmailResult] = useState<"success" | "error" | null>(null);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);

    // Fetch registration with joins
    const { data: regData } = await supabase
      .from("registration")
      .select(`
        id, property_id, guest_id, check_in_date, check_out_date, num_guests, notes,
        status, booking_source, signature_url, total_amount_cents, guest_list, pets,
        upsells, tips, lodgify_booking_id, lodgify_adults, lodgify_children, lodgify_infants,
        lodgify_num_pets, created_at, updated_at,
        guest:guest_id(id, full_name, email, phone, mailing_address, lodgify_guest_id),
        property:property_id(id, name, nickname, address, slug, max_guests, lodgify_property_id, listing_urls, owner_name, owner_phone, owner_email, hoa_submission_email, emergency_contact_name, emergency_contact_phone)
      `)
      .eq("id", id)
      .single();

    if (regData) {
      setReg(regData as unknown as FullRegistration);

      // Fetch vehicles
      const { data: vehicleData } = await supabase
        .from("vehicle")
        .select("id, year, make, model, color, license_plate, state_or_region, driver_name")
        .eq("registration_id", id);
      setVehicles(vehicleData ?? []);

      // Fetch cleaning status for THIS registration
      const { data: cleaningData } = await supabase
        .from("cleaning_status")
        .select("id, is_cleaned, cleaned_at, photos, checklist, notes, cleaner_id")
        .eq("registration_id", id)
        .maybeSingle();
      setCleaning(cleaningData);

      // Fetch previous reservation's cleaning (photos from the turnover before this guest's check-in)
      const { data: prevRegs } = await supabase
        .from("registration")
        .select("id")
        .eq("property_id", regData.property_id)
        .lt("check_out_date", (regData as { check_in_date: string }).check_in_date)
        .order("check_out_date", { ascending: false })
        .limit(1);

      if (prevRegs && prevRegs.length > 0) {
        const { data: prevCleaningData } = await supabase
          .from("cleaning_status")
          .select("id, is_cleaned, cleaned_at, photos, checklist, notes, cleaner_id")
          .eq("registration_id", prevRegs[0].id)
          .maybeSingle();
        setPrevCleaning(prevCleaningData);

        // Get signed URLs for previous cleaning photos via admin API
        if (prevCleaningData?.photos?.length) {
          const res = await fetch(
            `/api/admin/cleaning-photos?registration_id=${prevRegs[0].id}`
          );
          if (res.ok) {
            const data = await res.json();
            const urls: Record<string, string> = {};
            for (const photo of data.cleaning?.photos ?? []) {
              if (photo.url) urls[photo.path] = photo.url;
            }
            setPhotoUrls(urls);
          }
        }
      }
      // Fetch reimbursement charges linked to this registration
      const { data: invoicesWithCharges } = await supabase
        .from("cleaner_invoice")
        .select("id, invoice_number, status, period_start, line_items, notes, cleaner:cleaner_id(name)");

      const foundCharges: IncurredCharge[] = [];
      for (const inv of invoicesWithCharges || []) {
        const items = (inv.line_items || []) as InvoiceLineItem[];
        for (const item of items) {
          if (item.registration_id === id && item.type === "reimbursement") {
            const cleaner = inv.cleaner as unknown as { name: string } | null;
            foundCharges.push({
              invoiceId: inv.id,
              invoiceNumber: inv.invoice_number,
              invoiceStatus: inv.status as InvoiceStatus,
              cleanerName: cleaner?.name || "Unknown",
              description: item.description,
              amount: item.amount,
              expenseDate: inv.period_start,
              notes: inv.notes,
            });
          }
        }
      }
      setCharges(foundCharges);
    }

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    const [{ data: updateData }, { data: emailData }] = await Promise.all([
      supabase
        .from("registration_update_log")
        .select("id, changed_by, change_type, summary, previous_data, new_data, created_at")
        .eq("registration_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("email_send_log")
        .select("id, sent_to, subject, body_summary, email_type, is_update, created_at")
        .eq("registration_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setHistoryLogs(updateData ?? []);
    setEmailLogs(emailData ?? []);
    setHistoryLoading(false);
  }

  async function handleEmail() {
    setEmailing(true);
    setEmailResult(null);
    try {
      const res = await fetch("/api/pepoa/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: id }),
      });
      setEmailResult(res.ok ? "success" : "error");
    } catch {
      setEmailResult("error");
    } finally {
      setEmailing(false);
      setTimeout(() => setEmailResult(null), 3000);
    }
  }

  // Open the guest portal as this guest. Fetches a signed token from the
  // admin API so the cross-subdomain preview endpoint can authenticate.
  const openGuestPortal = useCallback(async () => {
    const res = await fetch(`/api/admin/preview-link?reg=${id}`);
    if (!res.ok) return;
    const { token } = await res.json();
    const host = window.location.host;
    const guestHost = host.replace(/^admin\./, "guest.");
    const url = `${window.location.protocol}//${guestHost}/?reg=${id}&token=${token}`;
    window.open(url, "_blank");
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading reservation...
      </div>
    );
  }

  if (!reg) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/reservations")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <p className="text-muted-foreground">Reservation not found.</p>
      </div>
    );
  }

  const guest = reg.guest;
  const property = reg.property;
  const guestList = reg.guest_list ?? [];
  const pets = reg.pets ?? [];
  const upsells = (reg.upsells ?? []).filter((u) => u.status === "paid");
  const adults = guestList.filter((g) => g.age_group === "over_21").length;
  const children = guestList.filter((g) => g.age_group === "under_21").length;
  const infants = guestList.filter((g) => g.age_group === "infant").length;
  const nights = Math.max(1, Math.round((new Date(reg.check_out_date).getTime() - new Date(reg.check_in_date).getTime()) / 86400000));
  const hasEarlyCheckin = upsells.some((u) => u.type === "early_checkin" && u.status === "paid");
  const hasLateCheckout = upsells.some((u) => u.type === "late_checkout" && u.status === "paid");
  const checkInTime = hasEarlyCheckin ? "1:00 PM" : "4:00 PM";
  const checkOutTime = hasLateCheckout ? "2:00 PM" : "11:00 AM";
  const hasSignature = !!reg.signature_url;

  // Map vehicles to guest list entries by driver name
  const guestVehicleMap = new Map<number, Vehicle[]>();
  vehicles.forEach((v) => {
    if (!v.driver_name) return;
    const driverLower = v.driver_name.toLowerCase().trim();
    const idx = guestList.findIndex(
      (g) => `${g.first_name} ${g.last_name}`.toLowerCase().trim() === driverLower
    );
    if (idx >= 0) {
      const existing = guestVehicleMap.get(idx) || [];
      existing.push(v);
      guestVehicleMap.set(idx, existing);
    }
  });

  const toggleDriver = (idx: number) => {
    setExpandedDrivers((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const lodgifyBookingUrl = reg.lodgify_booking_id
    ? `https://app.lodgify.com/#/reservation/details/${reg.lodgify_booking_id}`
    : null;

  const displayStatus = (() => {
    if (reg.status === "cancelled") return "cancelled" as const;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (reg.check_out_date <= today) return "past" as const;
    if (reg.check_in_date <= today) return "current" as const;
    return "future" as const;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push("/admin/reservations")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Reservations
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {guest?.full_name ?? "Unknown Guest"}
          </h1>
          <p className="text-muted-foreground">
            {property?.nickname || property?.name || "Unknown Property"} &middot; {reg.check_in_date} &rarr; {reg.check_out_date} ({nights} night{nights !== 1 ? "s" : ""})
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(() => {
            const colors = {
              current: "bg-blue-100 text-blue-800 border-blue-200",
              future: "bg-green-100 text-green-800 border-green-200",
              past: "bg-yellow-100 text-yellow-800 border-yellow-200",
              cancelled: "bg-red-100 text-red-800 border-red-200",
            };
            return (
              <Badge variant="outline" className={`text-sm capitalize ${colors[displayStatus]}`}>
                {displayStatus}
              </Badge>
            );
          })()}
          {hasSignature ? (
            <Badge variant="outline" className="text-sm gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" /> Registered
            </Badge>
          ) : (
            <Badge variant="outline" className="text-sm gap-1 text-muted-foreground">
              <XCircle className="h-3 w-3" /> Not registered
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {lodgifyBookingUrl && (
          <a href={lodgifyBookingUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" /> Lodgify
            </Button>
          </a>
        )}
        <Button variant="outline" size="sm" onClick={openGuestPortal}>
          <ExternalLink className="h-4 w-4 mr-1" /> Guest Portal
        </Button>
        {property?.listing_urls && Object.entries(property.listing_urls).map(([source, url]) => (
          <a key={source} href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" /> {source}
            </Button>
          </a>
        ))}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="cleaning">Cleaning Photos</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6 mt-4">
          {/* Upsells / Add-Ons — loud callout at top */}
          {upsells.length > 0 && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40 p-5 space-y-3 ring-2 ring-amber-300/50 shadow-lg shadow-amber-100 dark:shadow-amber-900/20">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-amber-400 dark:bg-amber-500 p-2 shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-lg text-amber-900 dark:text-amber-100">
                  Add-Ons ({upsells.length})
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {upsells.map((u, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white/80 dark:bg-black/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm">
                    <span className="font-medium">{u.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${(u.price_cents / 100).toFixed(0)}</span>
                      <Badge variant={u.status === "paid" ? "default" : "outline"} className="text-xs capitalize">
                        {u.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Booking Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> Booking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <div className="flex items-center gap-2">
                    <span>{reg.check_in_date}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{checkInTime}</span>
                    {hasEarlyCheckin && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Early Check-In
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Check-out</span>
                  <div className="flex items-center gap-2">
                    <span>{reg.check_out_date}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{checkOutTime}</span>
                    {hasLateCheckout && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Late Check-Out
                      </span>
                    )}
                  </div>
                </div>
                <Row label="Nights" value={String(nights)} />
                <Row label="Source" value={reg.booking_source ? reg.booking_source.replace(/\s*integration\s*/i, "").replace(/\s*api\s*/i, "").trim() : "—"} />
                <Row label="Revenue" value={reg.total_amount_cents ? `$${(reg.total_amount_cents / 100).toLocaleString()}` : "—"} />
                {reg.lodgify_booking_id && <Row label="Lodgify ID" value={String(reg.lodgify_booking_id)} />}
                <Row label="Created" value={new Date(reg.created_at).toLocaleDateString()} />
                <Row label="Updated" value={new Date(reg.updated_at).toLocaleDateString()} />
              </CardContent>
            </Card>

            {/* Guest Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Guest
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Name" value={guest?.full_name ?? "Unknown"} />
                <Row label="Email" value={guest?.email ?? "—"} />
                <Row label="Phone" value={guest?.phone ?? "—"} />
                <Row label="Address" value={guest?.mailing_address ?? "—"} />
                {(reg.lodgify_adults > 0 || reg.lodgify_children > 0 || reg.lodgify_infants > 0 || reg.lodgify_num_pets > 0) && (
                  <div className="pt-2">
                    <Separator className="mb-3" />
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground font-medium" />
                      <span className="text-muted-foreground font-medium text-center">Booked</span>
                      <span className="text-muted-foreground font-medium text-center">Registered</span>

                      <span className="text-muted-foreground">Adults</span>
                      <span className="text-center">{reg.lodgify_adults}</span>
                      <span className="text-center">{guestList.length > 0 ? adults : "—"}</span>

                      <span className="text-muted-foreground">Children</span>
                      <span className="text-center">{reg.lodgify_children}</span>
                      <span className="text-center">{guestList.length > 0 ? children : "—"}</span>

                      <span className="text-muted-foreground">Infants</span>
                      <span className="text-center">{reg.lodgify_infants}</span>
                      <span className="text-center">{guestList.length > 0 ? infants : "—"}</span>

                      <span className="text-muted-foreground">Pets</span>
                      <span className="text-center">{reg.lodgify_num_pets}</span>
                      <span className={`text-center ${pets.length > reg.lodgify_num_pets ? "text-amber-600 font-medium" : ""}`}>
                        {pets.length > 0 ? pets.length : "—"}
                      </span>
                    </div>
                    {pets.length > reg.lodgify_num_pets && (
                      <p className="text-xs text-amber-600 mt-2">
                        +{pets.length - reg.lodgify_num_pets} additional pet{pets.length - reg.lodgify_num_pets !== 1 ? "s" : ""} beyond booking
                      </p>
                    )}
                  </div>
                )}
                {!reg.lodgify_adults && !reg.lodgify_children && !reg.lodgify_infants && !reg.lodgify_num_pets && (
                  <>
                    <Row label="Total guests" value={String(reg.num_guests)} />
                    {guestList.length > 0 && (
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-1">Breakdown: {adults} adult{adults !== 1 ? "s" : ""}, {children} child{children !== 1 ? "ren" : ""}, {infants} infant{infants !== 1 ? "s" : ""}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Property Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Home className="h-4 w-4" /> Property
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Name" value={property?.name ?? "—"} />
                {property?.nickname && <Row label="Nickname" value={property.nickname} />}
                <Row label="Address" value={property?.address ?? "—"} />
                <Row label="Max guests" value={String(property?.max_guests ?? "—")} />
                {property?.owner_name && <Row label="Owner" value={property.owner_name} />}
                {property?.owner_phone && <Row label="Owner phone" value={property.owner_phone} />}
                {property?.owner_email && <Row label="Owner email" value={property.owner_email} />}
                {property?.hoa_submission_email && <Row label="HOA email" value={property.hoa_submission_email} />}
                {property?.emergency_contact_name && (
                  <Row label="Emergency" value={`${property.emergency_contact_name} ${property.emergency_contact_phone ?? ""}`} />
                )}
              </CardContent>
            </Card>

            {/* Registration — includes guest list, pets, vehicles */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" /> Registration
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Row label="Status" value={hasSignature ? "Completed" : "Incomplete"} />
                {hasSignature && (
                  <Row label="Registered" value={new Date(reg.created_at).toLocaleString()} />
                )}
                {reg.updated_at !== reg.created_at && (
                  <Row label="Last updated" value={new Date(reg.updated_at).toLocaleString()} />
                )}
                {reg.notes && <Row label="Notes" value={reg.notes} />}
                {hasSignature && (
                  <p className="text-xs text-muted-foreground">Signature on file</p>
                )}

                {/* Guest list with driver indicators */}
                {guestList.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        Guests ({guestList.length})
                        {(!!reg.tips?.needs_highchair || !!reg.tips?.needs_pack_n_play) && (
                          <span className="ml-auto normal-case tracking-normal font-normal flex gap-1.5">
                            {!!reg.tips?.needs_highchair && <Badge variant="secondary" className="text-xs">Highchair</Badge>}
                            {!!reg.tips?.needs_pack_n_play && <Badge variant="secondary" className="text-xs">Pack &apos;n Play</Badge>}
                          </span>
                        )}
                      </p>
                      <div className="space-y-1">
                        {guestList.map((g, i) => {
                          const gVehicles = guestVehicleMap.get(i);
                          const isDriver = !!gVehicles && gVehicles.length > 0;
                          const isExpanded = expandedDrivers.has(i);

                          return (
                            <div key={i} className="rounded-md border">
                              <button
                                type="button"
                                className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm ${isDriver ? "cursor-pointer hover:bg-accent/50 transition-colors" : "cursor-default"}`}
                                onClick={() => isDriver && toggleDriver(i)}
                                disabled={!isDriver}
                              >
                                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="flex-1">{g.first_name} {g.last_name}</span>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {g.age_group === "over_21" ? "Adult" : g.age_group === "under_21" ? "Child" : "Infant"}
                                </Badge>
                                {isDriver && (
                                  <>
                                    <Badge variant="secondary" className="text-xs">
                                      <Car className="h-3 w-3 mr-1" />
                                      Driver
                                    </Badge>
                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                  </>
                                )}
                              </button>
                              {isDriver && isExpanded && gVehicles.map((v) => (
                                <div key={v.id} className="border-t bg-muted/30 px-3 py-2 ml-6 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <Car className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium">
                                      {[v.year, v.color, v.make, v.model].filter(Boolean).join(" ")}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground mt-0.5 ml-4.5">
                                    {v.license_plate}{v.state_or_region ? ` · ${v.state_or_region}` : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Pets */}
                {(pets.length > 0 || reg.lodgify_num_pets > 0) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <PawPrint className="h-3.5 w-3.5" />
                        Pets
                        <span className="normal-case tracking-normal font-normal">
                          {reg.lodgify_num_pets > 0
                            ? `${pets.length} registered / ${reg.lodgify_num_pets} booked`
                            : `(${pets.length})`}
                        </span>
                        {pets.length > reg.lodgify_num_pets && reg.lodgify_num_pets > 0 && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 ml-auto normal-case tracking-normal">
                            +{pets.length - reg.lodgify_num_pets} extra
                          </Badge>
                        )}
                      </p>
                      {pets.length > 0 ? (
                        <div className="space-y-1">
                          {pets.map((p, i) => (
                            <div key={i} className="bg-muted rounded-md px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-muted-foreground">({p.kind})</span>
                                {reg.lodgify_num_pets > 0 && i < reg.lodgify_num_pets && (
                                  <Badge variant="outline" className="text-xs text-green-700 border-green-300">Pre-paid</Badge>
                                )}
                                {reg.lodgify_num_pets > 0 && i >= reg.lodgify_num_pets && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Add-on</Badge>
                                )}
                              </div>
                              <div className="flex gap-2 mt-1">
                                {p.rabies_doc_path && <Badge variant="outline" className="text-xs">Rabies doc</Badge>}
                                {p.vaccination_doc_path && <Badge variant="outline" className="text-xs">Vaccination doc</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {reg.lodgify_num_pets} pet{reg.lodgify_num_pets !== 1 ? "s" : ""} booked — not yet registered
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* PDF & HOA actions */}
                {hasSignature && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      <a href={`/api/pepoa/generate?registration_id=${id}&disposition=inline`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" /> View PDF
                        </Button>
                      </a>
                      <a href={`/api/pepoa/generate?registration_id=${id}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" /> Download PDF
                        </Button>
                      </a>
                      <Button variant="outline" size="sm" onClick={handleEmail} disabled={emailing}>
                        {emailing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : emailResult === "success" ? <Mail className="h-4 w-4 mr-1 text-green-600" /> : emailResult === "error" ? <Mail className="h-4 w-4 mr-1 text-red-600" /> : <Mail className="h-4 w-4 mr-1" />}
                        {emailResult === "success" ? "Sent!" : emailResult === "error" ? "Failed" : "Email to HOA"}
                      </Button>
                    </div>
                  </>
                )}

                <Separator />
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer pt-1"
                  onClick={openHistory}
                >
                  <History className="h-3.5 w-3.5" />
                  View update history
                </button>
              </CardContent>
            </Card>
          </div>
          {/* Charges Incurred */}
          {charges.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ReceiptText className="h-4 w-4" /> Charges Incurred ({charges.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {charges.map((c, i) => {
                    const statusColors: Record<string, string> = {
                      draft: "bg-muted text-muted-foreground",
                      submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                      approved: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
                      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                    };
                    return (
                      <div key={i} className="bg-muted rounded-md px-3 py-2 text-sm space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{c.description}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">${(c.amount / 100).toFixed(2)}</span>
                            <Badge className={statusColors[c.invoiceStatus] || ""} variant="outline">
                              {c.invoiceStatus}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.cleanerName} &middot; {c.expenseDate} &middot; {c.invoiceNumber}
                        </p>
                        {c.notes && (
                          <p className="text-xs text-muted-foreground">{c.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cleaning Photos Tab */}
        <TabsContent value="cleaning" className="space-y-6 mt-4">
          {/* Current reservation cleaning status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" /> Post-Stay Cleaning
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cleaning ? (
                <div className="space-y-2 text-sm">
                  <Row label="Status" value={cleaning.is_cleaned ? "Cleaned" : "Pending"} />
                  {cleaning.cleaned_at && <Row label="Cleaned at" value={new Date(cleaning.cleaned_at).toLocaleString()} />}
                  {cleaning.notes && <Row label="Notes" value={cleaning.notes} />}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cleaning record yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Previous reservation cleaning photos (pre-arrival photos) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" /> Pre-Arrival Cleaning Photos
              </CardTitle>
              <p className="text-xs text-muted-foreground">Photos from the turnover cleaning before this guest checked in</p>
            </CardHeader>
            <CardContent>
              {prevCleaning?.photos && prevCleaning.photos.length > 0 ? (
                <div className="space-y-4">
                  {/* Group photos by room */}
                  {Object.entries(
                    prevCleaning.photos.reduce<Record<string, CleaningPhoto[]>>((acc, photo) => {
                      const room = photo.room || "Other";
                      if (!acc[room]) acc[room] = [];
                      acc[room].push(photo);
                      return acc;
                    }, {})
                  ).map(([room, photos]) => (
                    <div key={room}>
                      <h4 className="text-sm font-medium mb-2">{room}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {photos.map((photo) => (
                          <a
                            key={photo.path}
                            href={photoUrls[photo.path] || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 ring-primary transition-all"
                          >
                            {photoUrls[photo.path] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photoUrls[photo.path]}
                                alt={`${room} cleaning photo`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Camera className="h-6 w-6" />
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                  {prevCleaning.cleaned_at && (
                    <p className="text-xs text-muted-foreground">
                      Cleaned on {new Date(prevCleaning.cleaned_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No cleaning photos available for the turnover prior to this reservation.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <EditRegistrationDialog
        registrationId={id}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={loadData}
      />

      {/* Outbox Drawer */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full flex flex-col p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <SheetTitle>Outbox</SheetTitle>
            <SheetDescription>{guest?.full_name ?? "Unknown"}</SheetDescription>
          </SheetHeader>

          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Sent emails */}
              <div className="p-4 space-y-4">
                {emailLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No emails sent yet.</p>
                ) : (
                  emailLogs.map((log) => {
                    const body = log.is_update
                      ? "An updated tenant registration form has been submitted."
                      : "A new tenant registration form has been submitted.";
                    return (
                      <div key={log.id} className="border rounded-lg overflow-hidden text-sm">
                        <div className="bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {log.is_update ? "Update" : "New Registration"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="px-3 py-2 space-y-1 border-b text-xs">
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-10 shrink-0">From</span>
                            <span>contact@summitlakeside.com</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-10 shrink-0">To</span>
                            <span>{log.sent_to.join(", ")}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-10 shrink-0">Subject</span>
                            <span className="font-medium">{log.subject ?? "—"}</span>
                          </div>
                        </div>
                        <div className="px-3 py-3 space-y-1 text-xs text-muted-foreground border-b">
                          <p>{body}</p>
                          {log.body_summary && <p>Changes: {log.body_summary}</p>}
                          <p>The {log.is_update ? "updated" : "completed"} Short-Term Tenant Registration Form and Lease is attached as a PDF.</p>
                        </div>
                        <div className="px-3 py-2 flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground mr-auto">PDF attachment</span>
                          <a
                            href={`/api/pepoa/generate?registration_id=${id}&disposition=inline`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                          </a>
                          <a
                            href={`/api/pepoa/generate?registration_id=${id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              <Download className="h-3 w-3 mr-1" /> Download
                            </Button>
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Updates section */}
              {historyLogs.length > 0 && (
                <div className="px-4 pb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Registration Updates ({historyLogs.length})
                  </p>
                  <div className="space-y-3">
                    {historyLogs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-3 space-y-1 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {log.change_type.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.summary && <p className="text-sm">{log.summary}</p>}
                        <p className="text-xs text-muted-foreground">by {log.changed_by}</p>
                        {log.new_data && Object.keys(log.new_data).length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">New data</p>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-w-full">
                              {JSON.stringify(log.new_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.previous_data && Object.keys(log.previous_data).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              Previous data
                            </summary>
                            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-w-full">
                              {JSON.stringify(log.previous_data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

