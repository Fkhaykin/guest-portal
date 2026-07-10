"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
  MapPin,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Star,
  TriangleAlert,
} from "lucide-react";
import { EditRegistrationDialog } from "@/components/admin/edit-registration-dialog";
import { ReservationMessages } from "@/components/admin/reservation-messages";
import { toneBadge, statusTone, type Tone } from "@/lib/status-styles";
import { effectiveStayTimes } from "@/lib/upsells/timing";
import type { GuestListEntry, PetEntry, UpsellEntry, CleaningPhoto, CleaningPhotoExif, CleaningChecklistItem, InvoiceLineItem, InvoiceStatus } from "@/types/database";
import type { LodgifyPriceBreakdown } from "@/lib/lodgify/client";
import { ReceiptText } from "lucide-react";

type FullRegistration = {
  id: string;
  property_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  notes: string | null;
  status: "active" | "completed" | "cancelled" | "pending_payment";
  booking_source: string | null;
  signature_url: string | null;
  total_amount_cents: number;
  cleaning_fee_cents: number;
  tax_amount_cents: number;
  pet_fee_total_cents: number;
  discount_cents: number;
  discount_label: string | null;
  nightly_rates_snapshot: Array<{ date: string; cents: number }> | null;
  lodgify_price_breakdown: LodgifyPriceBreakdown | null;
  payment_plan: "full" | "split" | "automatic";
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  balance_charge_attempts: number;
  balance_last_attempt_at: string | null;
  balance_last_failure_reason: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_deposit_invoice_id: string | null;
  stripe_balance_invoice_id: string | null;
  guest_list: GuestListEntry[] | null;
  pets: PetEntry[] | null;
  upsells: UpsellEntry[] | null;
  lodgify_booking_id: number | null;
  tips: Record<string, unknown> | null;
  lodgify_adults: number;
  lodgify_children: number;
  lodgify_infants: number;
  lodgify_num_pets: number;
  hoa_email_disabled: boolean;
  review_request_disabled: boolean;
  review_request_forced: boolean;
  review_request_skipped_at: string | null;
  review_request_skip_reason: string | null;
  id_verification_status: string;
  id_verified_name: string | null;
  id_name_match: boolean | null;
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
  const [photoData, setPhotoData] = useState<Record<string, CleaningPhoto & { url: string }>>({});
  const [currentPhotoData, setCurrentPhotoData] = useState<Record<string, CleaningPhoto & { url: string }>>();
  const [selectedPhoto, setSelectedPhoto] = useState<{ photo: CleaningPhoto; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<UpdateLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [charges, setCharges] = useState<IncurredCharge[]>([]);
  const [payEmails, setPayEmails] = useState<{ email_type: string; sent_to: string[]; created_at: string }[]>([]);
  const [emailing, setEmailing] = useState(false);
  const [emailResult, setEmailResult] = useState<"success" | "error" | null>(null);
  const [hoaToggling, setHoaToggling] = useState(false);
  const [reviewToggling, setReviewToggling] = useState(false);
  const [reviewMsgLog, setReviewMsgLog] = useState<{ sent_at: string; error: string | null } | null>(null);
  const [expandedDrivers, setExpandedDrivers] = useState<Set<number>>(new Set());
  const [hasModifications, setHasModifications] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Fetch registration with joins
    const { data: regData } = await supabase
      .from("registration")
      .select(`
        id, property_id, guest_id, check_in_date, check_out_date, num_guests, notes,
        status, booking_source, signature_url, total_amount_cents, cleaning_fee_cents,
        tax_amount_cents, pet_fee_total_cents, discount_cents, discount_label,
        nightly_rates_snapshot, lodgify_price_breakdown, payment_plan, deposit_paid_at, balance_paid_at,
        balance_charge_attempts, balance_last_attempt_at, balance_last_failure_reason,
        stripe_customer_id, stripe_payment_method_id, stripe_deposit_invoice_id,
        stripe_balance_invoice_id, guest_list, pets,
        upsells, tips, lodgify_booking_id, lodgify_adults, lodgify_children, lodgify_infants,
        lodgify_num_pets, hoa_email_disabled, review_request_disabled, review_request_forced, review_request_skipped_at, review_request_skip_reason,
        id_verification_status, id_verified_name, id_name_match, created_at, updated_at,
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

      // Fetch signed URLs for current cleaning photos
      if (cleaningData?.photos?.length) {
        const res = await fetch(`/api/admin/cleaning-photos?registration_id=${id}`);
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, CleaningPhoto & { url: string }> = {};
          for (const photo of data.cleaning?.photos ?? []) {
            if (photo.url) map[photo.path] = photo;
          }
          setCurrentPhotoData(map);
        }
      }

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
            const map: Record<string, CleaningPhoto & { url: string }> = {};
            for (const photo of data.cleaning?.photos ?? []) {
              if (photo.url) map[photo.path] = photo;
            }
            setPhotoData(map);
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

      // Whether the automated post-checkout review request actually went out
      const { data: reviewLog } = await supabase
        .from("guest_automated_message_log")
        .select("sent_at, error")
        .eq("registration_id", id)
        .eq("message_type", "post_checkout")
        .maybeSingle();
      setReviewMsgLog(reviewLog);

      const { count: modCount } = await supabase
        .from("registration_update_log")
        .select("id", { count: "exact", head: true })
        .eq("registration_id", id)
        .neq("change_type", "initial_registration");
      setHasModifications((modCount ?? 0) > 0);

      // Payment emails (invoice / plan-picker) for the direct-booking payment
      // timeline. Only these types are logged to email_send_log.
      if (regData.booking_source === "admin") {
        const { data: pe } = await supabase
          .from("email_send_log")
          .select("email_type, sent_to, created_at")
          .eq("registration_id", id)
          .in("email_type", ["booking_invoice_deposit", "booking_invoice_full", "booking_plan_picker"])
          .order("created_at", { ascending: true });
        setPayEmails(pe ?? []);
      } else {
        setPayEmails([]);
      }
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

  async function toggleHoaEmail(disabled: boolean) {
    if (!reg) return;
    setHoaToggling(true);
    // Optimistic update
    setReg((prev) => (prev ? { ...prev, hoa_email_disabled: disabled } : prev));
    try {
      const res = await fetch("/api/admin/registration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: id, hoa_email_disabled: disabled }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert on failure
      setReg((prev) => (prev ? { ...prev, hoa_email_disabled: !disabled } : prev));
    } finally {
      setHoaToggling(false);
    }
  }

  // Both toggle directions are sticky manual overrides: ON force-sends (and
  // clears any auto-skip flag), OFF force-mutes. The AI won't overturn either.
  async function toggleReviewRequest(nextOn: boolean) {
    if (!reg) return;
    setReviewToggling(true);
    const snapshot = {
      review_request_disabled: reg.review_request_disabled,
      review_request_forced: reg.review_request_forced,
      review_request_skipped_at: reg.review_request_skipped_at,
      review_request_skip_reason: reg.review_request_skip_reason,
    };
    // Optimistic update
    setReg((prev) =>
      prev
        ? {
            ...prev,
            review_request_disabled: !nextOn,
            review_request_forced: nextOn,
            ...(nextOn ? { review_request_skipped_at: null, review_request_skip_reason: null } : {}),
          }
        : prev
    );
    try {
      const res = await fetch("/api/admin/registration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: id,
          review_request_disabled: !nextOn,
          review_request_forced: nextOn,
        }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      // Revert on failure
      setReg((prev) => (prev ? { ...prev, ...snapshot } : prev));
    } finally {
      setReviewToggling(false);
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

  // Open the guest-facing payment page. /pay/[id] is a shared (non-prefixed)
  // route, so on the admin subdomain it must be opened on the guest host —
  // otherwise the proxy prepends /admin and 404s.
  const openPayPage = useCallback(() => {
    const guestHost = window.location.host.replace(/^admin\./, "guest.");
    window.open(`${window.location.protocol}//${guestHost}/pay/${id}`, "_blank");
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
  const { checkInTime, checkOutTime, hasEarlyCheckin, hasLateCheckout } = effectiveStayTimes(upsells);
  const hasSignature = !!reg.signature_url;

  // ---- Payment -----------------------------------------------------------
  // Price breakdown + split-payment lifecycle. The itemized breakdown and the
  // deposit/balance schedule are only populated for bookings created through
  // the admin/checkout flow (booking_source "admin"); Lodgify/channel bookings
  // carry only a total, so the card degrades to revenue + source.
  const totalCents = reg.total_amount_cents ?? 0;
  const cleaningCents = reg.cleaning_fee_cents ?? 0;
  const taxCents = reg.tax_amount_cents ?? 0;
  const petFeeCents = reg.pet_fee_total_cents ?? 0;
  const discountCents = reg.discount_cents ?? 0;
  const nightlyRates = reg.nightly_rates_snapshot ?? [];
  const nightsSubtotalCents = nightlyRates.reduce((s, n) => s + (n?.cents ?? 0), 0);
  const hasBreakdown =
    nightlyRates.length > 0 || cleaningCents > 0 || taxCents > 0 || petFeeCents > 0 || discountCents > 0;

  // Channel (Lodgify/OTA) bookings carry an itemized snapshot from the Lodgify
  // quote instead of the structured direct-booking columns. Lodgify only
  // exposes the accommodation subtotal (not per-night paid rates), so the
  // nightly line shows an average. Fee/tax line items fall back to the
  // subtotal buckets when the quote carried no itemization.
  const lodgifyBd = reg.lodgify_price_breakdown;
  const bdItems = lodgifyBd?.items ?? [];
  const bdFees = bdItems.filter((i) => i.type === "Fee");
  const bdTaxes = bdItems.filter((i) => i.type === "Tax");
  const bdPromos = bdItems.filter((i) => i.type === "Promotion");
  const bdStayCents = lodgifyBd?.stay ?? bdItems.find((i) => i.type === "RoomRate")?.amount ?? null;
  const sourceName = (reg.booking_source ?? "")
    .replace(/\s*integration\s*/i, "")
    .replace(/\s*api\s*/i, "")
    .trim();

  const isManagedPayment = reg.booking_source === "admin";
  const isSplit = reg.payment_plan === "split";
  const depositCents = Math.round(totalCents / 2);
  const balanceCents = totalCents - depositCents;
  const depositPaid = !!reg.deposit_paid_at;
  const balancePaid = !!reg.balance_paid_at;
  const balanceFailing = isSplit && !balancePaid && reg.balance_charge_attempts > 0;

  const planLabel =
    reg.payment_plan === "split"
      ? "50 / 50 Split"
      : reg.payment_plan === "automatic"
      ? "Guest chooses plan"
      : "Full Payment";

  const paymentStatus: { label: string; tone: Tone } | null = (() => {
    if (reg.status === "cancelled") return { label: "Cancelled", tone: "danger" };
    if (balancePaid) return { label: "Paid in full", tone: "success" };
    if (isSplit && depositPaid) return { label: "Deposit paid · balance due", tone: "warning" };
    if (reg.status === "pending_payment") return { label: "Awaiting payment", tone: "warning" };
    if (isManagedPayment) return { label: "Awaiting payment", tone: "warning" };
    return null; // channel/Lodgify booking — payment collected externally
  })();

  // Chronological log of every payment event we record for a direct booking:
  // creation, invoice/plan emails, deposit, auto-charge attempts, balance, cancellation.
  const paymentEvents: { at: string; label: string; detail?: string; tone: Tone }[] = [];
  if (isManagedPayment) {
    paymentEvents.push({ at: reg.created_at, label: "Booking created", tone: "neutral" });
    for (const e of payEmails) {
      const label =
        e.email_type === "booking_invoice_deposit"
          ? "Deposit invoice emailed"
          : e.email_type === "booking_invoice_full"
          ? "Invoice emailed"
          : "Payment-plan link emailed";
      paymentEvents.push({ at: e.created_at, label, detail: e.sent_to?.join(", "), tone: "info" });
    }
    if (reg.deposit_paid_at) {
      paymentEvents.push({
        at: reg.deposit_paid_at,
        label: `${isSplit ? "Deposit paid" : "Paid in full"} · ${fmtUSD(isSplit ? depositCents : totalCents)}`,
        tone: "success",
      });
    }
    if (reg.balance_last_attempt_at && reg.balance_charge_attempts > 0 && !reg.balance_paid_at) {
      paymentEvents.push({
        at: reg.balance_last_attempt_at,
        label: `Balance auto-charge attempt ${reg.balance_charge_attempts} of 3 failed`,
        detail: reg.balance_last_failure_reason ?? undefined,
        tone: reg.balance_charge_attempts >= 3 ? "danger" : "warning",
      });
    }
    if (reg.balance_paid_at && isSplit) {
      paymentEvents.push({ at: reg.balance_paid_at, label: `Balance paid · ${fmtUSD(balanceCents)}`, tone: "success" });
    }
    if (reg.status === "cancelled" && reg.balance_charge_attempts >= 3 && !reg.balance_paid_at) {
      paymentEvents.push({
        at: reg.balance_last_attempt_at ?? reg.updated_at,
        label: "Cancelled — non-payment",
        detail: "Deposit forfeited",
        tone: "danger",
      });
    }
    paymentEvents.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

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
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push("/admin/reservations")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Reservations
        </Button>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {guest?.full_name ?? "Unknown Guest"}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {property?.nickname || property?.name || "Unknown Property"} &middot;{" "}
              <span className="whitespace-nowrap">{reg.check_in_date} &rarr; {reg.check_out_date}</span> ({nights} night{nights !== 1 ? "s" : ""})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
            {(() => {
              return (
                <Badge variant="outline" className={`text-sm capitalize ${toneBadge(statusTone(displayStatus))}`}>
                  {displayStatus}
                </Badge>
              );
            })()}
            {hasSignature ? (
              <Badge variant="outline" className="text-sm gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" /> Registered
              </Badge>
            ) : (
              <Badge variant="outline" className="text-sm gap-1 text-muted-foreground">
                <XCircle className="h-3 w-3" /> Not registered
              </Badge>
            )}
            {(() => {
              // ID verification (direct/non-Airbnb guests). Unstarted/OTA → no badge.
              const s = reg.id_verification_status;
              if (s === "verified") {
                return reg.id_name_match === false ? (
                  <Badge variant="outline" className={`text-sm gap-1 ${toneBadge("warning")}`}>
                    <ShieldAlert className="h-3 w-3" /> ID name mismatch
                  </Badge>
                ) : (
                  <Badge variant="outline" className={`text-sm gap-1 ${toneBadge("success")}`}>
                    <ShieldCheck className="h-3 w-3" /> ID verified
                  </Badge>
                );
              }
              if (s === "requires_input") {
                return (
                  <Badge variant="outline" className={`text-sm gap-1 ${toneBadge("danger")}`}>
                    <ShieldAlert className="h-3 w-3" /> ID check failed
                  </Badge>
                );
              }
              if (s === "processing") {
                return (
                  <Badge variant="outline" className="text-sm gap-1 text-muted-foreground">
                    <ShieldAlert className="h-3 w-3" /> ID check pending
                  </Badge>
                );
              }
              return null;
            })()}
            {hasModifications && (
              <button type="button" onClick={openHistory}>
                <Badge variant="outline" className={`text-sm gap-1 cursor-pointer transition-colors ${toneBadge("warning")}`}>
                  <History className="h-3 w-3" /> Modified
                </Badge>
              </button>
            )}
          </div>
        </div>
        {reg.id_verification_status === "verified" && reg.id_name_match === false && (
          <div className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm ${toneBadge("warning")}`}>
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>ID name mismatch.</strong> The verified government ID belongs to{" "}
              <strong>{reg.id_verified_name || "an unrecognized name"}</strong>, but this booking is under{" "}
              <strong>{guest?.full_name ?? "Unknown"}</strong>. Confirm the guest&apos;s identity before check-in.
            </span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push(`/admin/messages?booking=${reg.lodgify_booking_id ?? reg.id}`)}>
          <MessageSquare className="h-4 w-4 mr-1" /> Messages
        </Button>
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
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="cleaning">Cleaning Photos</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6 mt-4">
          {/* Upsells / Add-Ons — loud callout at top */}
          {upsells.length > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-warning/15 text-warning p-2 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg">
                  Add-Ons ({upsells.length})
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {upsells.map((u, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-card border border-warning/30 px-3 py-2 text-sm">
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
            {/* Payment */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Payment
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {isManagedPayment && (
                      <Badge variant="outline" className="text-xs">{planLabel}</Badge>
                    )}
                    {paymentStatus && (
                      <Badge variant="outline" className={`text-xs ${toneBadge(paymentStatus.tone)}`}>
                        {paymentStatus.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {/* Price breakdown */}
                {hasBreakdown ? (
                  <div className="space-y-1">
                    <Row
                      label={
                        nightlyRates.length
                          ? `${fmtUSD(Math.round(nightsSubtotalCents / Math.max(nightlyRates.length, 1)))} × ${nightlyRates.length} night${nightlyRates.length !== 1 ? "s" : ""}`
                          : "Nights subtotal"
                      }
                      value={fmtUSD(nightsSubtotalCents)}
                    />
                    {cleaningCents > 0 && <Row label="Cleaning fee" value={fmtUSD(cleaningCents)} />}
                    {petFeeCents > 0 && <Row label="Pet fee" value={fmtUSD(petFeeCents)} />}
                    {taxCents > 0 && <Row label="Taxes" value={fmtUSD(taxCents)} />}
                    {discountCents > 0 && (
                      <Row label={reg.discount_label || "Discount"} value={`− ${fmtUSD(discountCents)}`} />
                    )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{fmtUSD(totalCents)}</span>
                    </div>
                  </div>
                ) : lodgifyBd ? (
                  <div className="space-y-1">
                    {bdStayCents != null && (
                      <Row
                        label={`Accommodation (${fmtUSD(Math.round(bdStayCents / nights))} avg × ${nights} night${nights !== 1 ? "s" : ""})`}
                        value={fmtUSD(bdStayCents)}
                      />
                    )}
                    {bdFees.length > 0
                      ? bdFees.map((f, i) => (
                          <Row key={`fee-${i}`} label={f.description || "Fee"} value={fmtUSD(f.amount)} />
                        ))
                      : (lodgifyBd.fees ?? 0) > 0 && <Row label="Fees" value={fmtUSD(lodgifyBd.fees!)} />}
                    {(lodgifyBd.addons ?? 0) > 0 && <Row label="Add-ons" value={fmtUSD(lodgifyBd.addons!)} />}
                    {bdTaxes.length > 0
                      ? bdTaxes.map((t, i) => (
                          <Row key={`tax-${i}`} label={t.description || "Tax"} value={fmtUSD(t.amount)} />
                        ))
                      : (lodgifyBd.taxes ?? 0) > 0 && <Row label="Taxes" value={fmtUSD(lodgifyBd.taxes!)} />}
                    {(lodgifyBd.vat ?? 0) > 0 && <Row label="VAT" value={fmtUSD(lodgifyBd.vat!)} />}
                    {bdPromos.length > 0
                      ? bdPromos.map((p, i) => (
                          <Row key={`promo-${i}`} label={p.description || "Promotion"} value={`− ${fmtUSD(Math.abs(p.amount))}`} />
                        ))
                      : (lodgifyBd.promotions ?? 0) !== 0 && (
                          <Row label="Promotions" value={`− ${fmtUSD(Math.abs(lodgifyBd.promotions!))}`} />
                        )}
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span>Guest total</span>
                      <span>{fmtUSD(lodgifyBd.total)}</span>
                    </div>
                    {(lodgifyBd.host_fee != null || lodgifyBd.payout != null) && (
                      <>
                        {lodgifyBd.host_fee != null && (
                          <Row label={`${sourceName || "Channel"} host fee`} value={`− ${fmtUSD(lodgifyBd.host_fee)}`} />
                        )}
                        {lodgifyBd.payout != null && (
                          <div className="flex justify-between font-medium">
                            <span>Expected payout</span>
                            <span>{fmtUSD(lodgifyBd.payout)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{totalCents ? fmtUSD(totalCents) : "—"}</span>
                  </div>
                )}

                {/* Payment schedule — admin/checkout bookings carry the split-pay lifecycle */}
                {isManagedPayment ? (
                  <>
                    <Separator />
                    {isSplit ? (
                      <div className="space-y-2">
                        <PaymentLeg label="Deposit (50%)" amount={fmtUSD(depositCents)} paidAt={reg.deposit_paid_at} pendingNote="Awaiting payment" />
                        <PaymentLeg
                          label="Balance (50%)"
                          amount={fmtUSD(balanceCents)}
                          paidAt={reg.balance_paid_at}
                          pendingNote={
                            balanceFailing
                              ? `Attempt ${reg.balance_charge_attempts} of 3 failed`
                              : "Auto-charges 30 days before check-in"
                          }
                          pendingTone={balanceFailing ? "danger" : "neutral"}
                        />
                        {balanceFailing && (
                          <div className={`rounded-md px-3 py-2 text-xs ${toneBadge("danger")}`}>
                            <p className="font-medium flex items-center gap-1.5">
                              <XCircle className="h-3.5 w-3.5" /> Balance auto-charge failing
                            </p>
                            {reg.balance_last_failure_reason && (
                              <p className="mt-0.5">{reg.balance_last_failure_reason}</p>
                            )}
                            {reg.balance_last_attempt_at && (
                              <p className="mt-0.5 opacity-80">
                                Last attempt {new Date(reg.balance_last_attempt_at).toLocaleString()}
                                {reg.balance_charge_attempts >= 3 && " · booking cancelled after 3 attempts"}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <PaymentLeg
                        label={reg.payment_plan === "automatic" ? "Full payment" : "Payment"}
                        amount={fmtUSD(totalCents)}
                        paidAt={reg.balance_paid_at || reg.deposit_paid_at}
                        pendingNote={
                          reg.payment_plan === "automatic"
                            ? "Guest hasn't chosen a plan yet"
                            : "Invoice sent — awaiting payment"
                        }
                      />
                    )}

                    {!balancePaid && reg.status !== "cancelled" && (
                      <Button variant="outline" size="sm" onClick={openPayPage}>
                        <ExternalLink className="h-4 w-4 mr-1" /> Payment page
                      </Button>
                    )}

                    {/* Payment activity — timestamped log of every payment event */}
                    {paymentEvents.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> Payment activity
                          </p>
                          <ol className="space-y-3">
                            {paymentEvents.map((e, i) => (
                              <li key={i} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${dotTone(e.tone)}`} />
                                  {i < paymentEvents.length - 1 && <span className="w-px flex-1 bg-border mt-1" />}
                                </div>
                                <div className="flex-1 -mt-0.5 space-y-0.5 pb-1">
                                  <p className="text-sm font-medium leading-snug">{e.label}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(e.at).toLocaleString("en-US", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                  {e.detail && (
                                    <p className="text-xs text-muted-foreground wrap-break-word">{e.detail}</p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </>
                    )}

                    {/* Stripe references for support / reconciliation */}
                    {(reg.stripe_customer_id || reg.stripe_payment_method_id || reg.stripe_deposit_invoice_id || reg.stripe_balance_invoice_id) && (
                      <>
                        <Separator />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stripe</p>
                          {reg.stripe_customer_id && (
                            <StripeRef label="Customer" id={reg.stripe_customer_id} href={`https://dashboard.stripe.com/customers/${reg.stripe_customer_id}`} />
                          )}
                          {reg.stripe_payment_method_id && (
                            <StripeRef label="Payment method" id={reg.stripe_payment_method_id} />
                          )}
                          {reg.stripe_deposit_invoice_id && (
                            <StripeRef label={isSplit ? "Deposit invoice" : "Invoice"} id={reg.stripe_deposit_invoice_id} href={`https://dashboard.stripe.com/invoices/${reg.stripe_deposit_invoice_id}`} />
                          )}
                          {reg.stripe_balance_invoice_id && (
                            <StripeRef label="Balance invoice" id={reg.stripe_balance_invoice_id} href={`https://dashboard.stripe.com/invoices/${reg.stripe_balance_invoice_id}`} />
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  reg.booking_source && (
                    <p className="text-xs text-muted-foreground">
                      Collected via {reg.booking_source.replace(/\s*integration\s*/i, "").replace(/\s*api\s*/i, "").trim()}
                    </p>
                  )
                )}
              </CardContent>
            </Card>

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
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneBadge("success")}`}>
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
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneBadge("warning")}`}>
                        Late Check-Out
                      </span>
                    )}
                  </div>
                </div>
                <Row label="Nights" value={String(nights)} />
                <Row label="Source" value={reg.booking_source ? reg.booking_source.replace(/\s*integration\s*/i, "").replace(/\s*api\s*/i, "").trim() : "—"} />
                {reg.lodgify_booking_id && <Row label="Lodgify ID" value={String(reg.lodgify_booking_id)} />}
                <Row label="Created" value={new Date(reg.created_at).toLocaleDateString()} />
                <Row label="Updated" value={new Date(reg.updated_at).toLocaleDateString()} />

                {/* Review-request kill switch — the morning-after-checkout review
                    ask is sentiment-gated, but the host may know the stay went
                    badly through channels the gate can't see (calls, in person). */}
                <Separator className="my-3" />
                <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-muted-foreground" />
                      Review request
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reg.review_request_disabled
                        ? "Off — you've turned this off, so this guest won't be asked for a review. Overrides the automatic sentiment check."
                        : reg.review_request_forced
                        ? "On — you've manually turned this on. It will send even if the automatic check flags a concern."
                        : reg.review_request_skipped_at
                        ? "Off — the automatic check flagged a concern (below), so no review request will be sent. It self-corrects if the guest's messages turn positive; switch it on to force-send anyway."
                        : "On — the morning after check-out, the guest gets an automated message asking for a review (skipped automatically if the conversation shows problems)."}
                    </p>
                    {!reg.review_request_disabled && !reg.review_request_forced && reg.review_request_skipped_at ? (
                      <div className={`mt-1.5 flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${toneBadge("warning")}`}>
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {displayStatus === "past" ? (
                          <span>
                            <strong>Auto-skipped.</strong> On{" "}
                            {new Date(reg.review_request_skipped_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            , the system reviewed this guest&apos;s messages, detected signs of problems
                            {reg.review_request_skip_reason ? ` (${reg.review_request_skip_reason})` : ""}, and did not send the review request.
                          </span>
                        ) : (
                          <span>
                            <strong>Flagged — set to skip.</strong> As of{" "}
                            {new Date(reg.review_request_skipped_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            , the conversation suggests this guest is unhappy
                            {reg.review_request_skip_reason ? ` (${reg.review_request_skip_reason})` : ""}, so the review request won&apos;t be sent.
                            The system re-checks with each new guest message and clears this if things turn around.
                          </span>
                        )}
                      </div>
                    ) : reviewMsgLog && !reviewMsgLog.error ? (
                      <p className="text-xs text-success flex items-center gap-1 pt-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Review request sent{" "}
                        {new Date(reviewMsgLog.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    ) : reviewMsgLog?.error ? (
                      <p className="text-xs text-destructive flex items-center gap-1 pt-0.5">
                        <XCircle className="h-3 w-3" /> Review request failed to send
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    checked={!reg.review_request_disabled && (reg.review_request_forced || !reg.review_request_skipped_at)}
                    disabled={reviewToggling}
                    onCheckedChange={(checked) => toggleReviewRequest(checked)}
                    aria-label="Toggle post-checkout review request"
                  />
                </div>
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
                      <span className={`text-center ${pets.length > reg.lodgify_num_pets ? "text-warning font-medium" : ""}`}>
                        {pets.length > 0 ? pets.length : "—"}
                      </span>
                    </div>
                    {pets.length > reg.lodgify_num_pets && (
                      <p className="text-xs text-warning mt-2">
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
                          <Badge variant="outline" className="text-xs text-warning border-warning/40 ml-auto normal-case tracking-normal">
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
                                  <Badge variant="outline" className="text-xs text-success border-success/40">Pre-paid</Badge>
                                )}
                                {reg.lodgify_num_pets > 0 && i >= reg.lodgify_num_pets && (
                                  <Badge variant="outline" className="text-xs text-warning border-warning/40">Add-on</Badge>
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

                {/* HOA registration auto-submit toggle — only relevant when an HOA email is configured.
                    Scoped to the registration submission only; delivery/gate notifications are unaffected. */}
                {property?.hoa_submission_email && (
                  <>
                    <Separator />
                    <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          Auto-submit registration to HOA
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reg.hoa_email_disabled
                            ? "Off — the registration form won't be auto-sent to the HOA on register or update. You can still send manually below. Delivery and gate notifications are unaffected."
                            : "On — sends the registration form to the HOA when the guest registers or updates their booking. Only affects the registration submission, not deliveries."}
                        </p>
                      </div>
                      <Switch
                        checked={!reg.hoa_email_disabled}
                        disabled={hoaToggling}
                        onCheckedChange={(checked) => toggleHoaEmail(!checked)}
                        aria-label="Toggle automatic HOA registration submission"
                      />
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
                        {emailing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : emailResult === "success" ? <Mail className="h-4 w-4 mr-1 text-success" /> : emailResult === "error" ? <Mail className="h-4 w-4 mr-1 text-destructive" /> : <Mail className="h-4 w-4 mr-1" />}
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
                    return (
                      <div key={i} className="bg-muted rounded-md px-3 py-2 text-sm space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{c.description}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">${(c.amount / 100).toFixed(2)}</span>
                            <Badge className={toneBadge(statusTone(c.invoiceStatus))} variant="outline">
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

        {/* Messages Tab — unified guest conversation (web chat + email/SMS or Lodgify) */}
        <TabsContent value="messages" className="mt-4">
          <ReservationMessages bookingId={reg.lodgify_booking_id ?? reg.id} />
        </TabsContent>

        {/* Cleaning Photos Tab */}
        <TabsContent value="cleaning" className="mt-4">
          <Tabs defaultValue="pre">
            <TabsList>
              <TabsTrigger value="pre">Pre-Arrival</TabsTrigger>
              <TabsTrigger value="post">Post-Stay</TabsTrigger>
            </TabsList>

            <TabsContent value="post" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" /> Post-Stay Cleaning
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {cleaning ? (
                    <div className="space-y-4 text-sm">
                      <Row label="Status" value={cleaning.is_cleaned ? "Cleaned" : "Pending"} />
                      {cleaning.cleaned_at && <Row label="Cleaned at" value={new Date(cleaning.cleaned_at).toLocaleString()} />}
                      {cleaning.notes && <Row label="Notes" value={cleaning.notes} />}
                      {cleaning.photos && cleaning.photos.length > 0 && (
                        <div className="space-y-4 pt-2">
                          {Object.entries(
                            cleaning.photos.reduce<Record<string, CleaningPhoto[]>>((acc, photo) => {
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
                                  <button
                                    key={photo.path}
                                    type="button"
                                    onClick={() => { const p = currentPhotoData?.[photo.path]; if (p) setSelectedPhoto({ photo: p, url: p.url }); }}
                                    className="block aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 ring-primary transition-all cursor-pointer"
                                  >
                                    {currentPhotoData?.[photo.path]?.url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={currentPhotoData[photo.path].url}
                                        alt={`${room} cleaning photo`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        <Camera className="h-6 w-6" />
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No cleaning record yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pre" className="mt-4">
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
                              <button
                                key={photo.path}
                                type="button"
                                onClick={() => { const p = photoData[photo.path]; if (p) setSelectedPhoto({ photo: p, url: p.url }); }}
                                className="block aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 ring-primary transition-all cursor-pointer"
                              >
                                {photoData[photo.path]?.url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={photoData[photo.path].url}
                                    alt={`${room} cleaning photo`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                    <Camera className="h-6 w-6" />
                                  </div>
                                )}
                              </button>
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
        </TabsContent>

      </Tabs>

      {/* Photo EXIF Drawer */}
      <Sheet open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <SheetContent side="right" className="flex flex-col p-0" style={{ width: "min(95vw, 1300px)", maxWidth: "none" }}>
          <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <SheetTitle className="text-base">
              {selectedPhoto?.photo.room || "Photo"}
              {selectedPhoto?.photo.note && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">{selectedPhoto.photo.note}</span>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedPhoto && (
            <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
              {/* Image panel — left side, fills all remaining space */}
              <div className="relative flex-1 min-h-0 bg-muted overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.photo.room}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
              {/* EXIF panel — right side, fixed width */}
              <div className="w-80 shrink-0 border-l overflow-y-auto p-4">
                <PhotoExifPanel exif={selectedPhoto.photo.exif ?? {}} url={selectedPhoto.url} uploadedAt={selectedPhoto.photo.uploaded_at} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
                    const isPepoa = log.email_type === "pepoa";
                    const badgeLabel = isPepoa
                      ? log.is_update ? "Update" : "New Registration"
                      : EMAIL_TYPE_LABELS[log.email_type] ?? log.email_type;
                    const pepoaBody = log.is_update
                      ? "An updated tenant registration form has been submitted."
                      : "A new tenant registration form has been submitted.";
                    return (
                      <div key={log.id} className="border rounded-lg overflow-hidden text-sm">
                        <div className="bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {badgeLabel}
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
                        {isPepoa ? (
                          <>
                            <div className="px-3 py-3 space-y-1 text-xs text-muted-foreground border-b">
                              <p>{pepoaBody}</p>
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
                          </>
                        ) : (
                          <div className="px-3 py-3 text-xs text-muted-foreground whitespace-pre-wrap wrap-break-word">
                            {log.body_summary || "(no body stored)"}
                          </div>
                        )}
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
                      <div key={log.id} className="border rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {log.change_type.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.summary && <p className="text-sm">{log.summary}</p>}
                        <p className="text-xs text-muted-foreground">by {log.changed_by}</p>
                        {(log.change_type === "admin_edit" || log.change_type === "booking_modified") && (
                          <FieldDiff
                            prev={log.previous_data}
                            next={log.new_data}
                            fieldLabels={log.change_type === "admin_edit" ? ADMIN_EDIT_FIELD_LABELS : BOOKING_FIELD_LABELS}
                          />
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

function fmtUSD(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Timeline dot color for a payment event tone.
function dotTone(tone: Tone): string {
  switch (tone) {
    case "success":
      return "bg-success";
    case "warning":
      return "bg-warning";
    case "danger":
      return "bg-destructive";
    case "info":
      return "bg-primary";
    default:
      return "bg-muted-foreground/40";
  }
}

// One phase of a booking payment (deposit, balance, or the single full payment).
function PaymentLeg({
  label,
  amount,
  paidAt,
  pendingNote,
  pendingTone = "neutral",
}: {
  label: string;
  amount: string;
  paidAt: string | null;
  pendingNote?: string;
  pendingTone?: Tone;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <p className="font-medium">{label}</p>
        {paidAt ? (
          <p className="text-xs text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Paid {new Date(paidAt).toLocaleDateString()}
          </p>
        ) : pendingNote ? (
          <p className={`text-xs ${pendingTone === "danger" ? "text-destructive" : "text-muted-foreground"}`}>
            {pendingNote}
          </p>
        ) : null}
      </div>
      <span className="font-medium shrink-0">{amount}</span>
    </div>
  );
}

function StripeRef({ label, id, href }: { label: string; id: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-mono break-all text-right"
        >
          {id} <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className="text-xs font-mono break-all text-right">{id}</span>
      )}
    </div>
  );
}

function ExifRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className="text-right text-xs break-all">{String(value)}</span>
    </div>
  );
}

function decodeColorSpace(cs: string | undefined | null): string | null {
  if (!cs) return null;
  const n = parseInt(cs, 10);
  if (n === 1) return "sRGB";
  if (n === 2) return "Adobe RGB";
  if (n === 65535) return "Uncalibrated";
  return cs;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  booking_invoice_full: "Invoice — Full Payment",
  booking_invoice_deposit: "Invoice — 50% Deposit",
  booking_plan_picker: "Payment Plan Picker",
};

const ADMIN_EDIT_FIELD_LABELS: Record<string, string> = {
  guest_name: "Guest Name",
  email: "Email",
  check_in_date: "Check-in Date",
  check_out_date: "Check-out Date",
  status: "Status",
  notes: "Notes",
  guest_list: "Guest List",
  pets: "Pets",
};

const BOOKING_FIELD_LABELS: Record<string, string> = {
  check_in_date: "Check-in Date",
  check_out_date: "Check-out Date",
  num_guests: "Total Guests",
  lodgify_adults: "Adults",
  lodgify_children: "Children",
  lodgify_infants: "Infants",
  lodgify_num_pets: "Pets",
  status: "Status",
  notes: "Notes",
  total_amount_cents: "Revenue",
};

function FieldDiff({
  prev,
  next,
  fieldLabels,
}: {
  prev: Record<string, unknown> | null;
  next: Record<string, unknown> | null;
  fieldLabels: Record<string, string>;
}) {
  if (!prev || !next) return null;

  const normalize = (v: unknown) => (v == null || v === "" ? null : v);
  const changes = Object.entries(fieldLabels).filter(
    ([key]) => JSON.stringify(normalize(prev[key])) !== JSON.stringify(normalize(next[key]))
  );

  if (changes.length === 0) return null;

  const formatVal = (key: string, val: unknown): string => {
    if (key === "total_amount_cents" && typeof val === "number") {
      return `$${Math.round(val / 100).toLocaleString()}`;
    }
    if (Array.isArray(val)) return `${val.length} entries`;
    if (val != null && val !== "") {
      const s = String(val);
      if ((key === "check_in_date" || key === "check_out_date") && /^\d{4}-\d{2}-\d{2}/.test(s)) {
        return new Date(s.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      return s;
    }
    return "none";
  };

  return (
    <div className="space-y-1.5 mt-1">
      {changes.map(([key, label]) => {
        const fromVal = prev[key];
        const toVal = next[key];
        return (
          <div key={key} className="text-xs rounded-md bg-muted/60 px-2.5 py-2">
            <p className="font-medium text-muted-foreground mb-1">{label}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="line-through text-red-600">{formatVal(key, fromVal)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-green-700">{formatVal(key, toVal)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PhotoExifPanel({ exif, url, uploadedAt }: { exif: CleaningPhotoExif; url: string; uploadedAt: string }) {
  const formatBytes = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  const hasLocation = exif.latitude != null && exif.longitude != null;
  const hasCameraData = exif.camera || exif.lens || exif.iso || exif.aperture || exif.shutter_speed || exif.focal_length || exif.flash || exif.exposure_mode || exif.white_balance || exif.scene_type || exif.software;
  const hasImageData = (exif.width && exif.height) || exif.color_space || exif.orientation || exif.file_type || exif.file_size;
  const hasUploadContext = exif.device_name || exif.os || exif.browser;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {exif.source && (
          <Badge variant="secondary" className="text-xs capitalize">
            {exif.source === "exif" ? "From photo EXIF" : exif.source === "mixed" ? "EXIF + Browser" : "Captured by browser"}
          </Badge>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto"
        >
          <ExternalLink className="h-3 w-3" /> Open original
        </a>
      </div>

      {/* Date & Location */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Date &amp; Location</p>
        <div className="rounded-lg border divide-y text-sm">
          <ExifRow label="Uploaded" value={new Date(uploadedAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} />
          <ExifRow label="Taken" value={exif.taken_at ? new Date(exif.taken_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) : null} />
          <ExifRow label="Altitude" value={exif.altitude != null ? `${exif.altitude.toFixed(1)} m` : null} />
          {hasLocation && (
            <div className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="text-muted-foreground shrink-0 text-xs">Location</span>
              <a
                href={`https://maps.google.com/?q=${exif.latitude},${exif.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
              >
                <MapPin className="h-3 w-3" />
                {exif.latitude!.toFixed(6)}, {exif.longitude!.toFixed(6)}
              </a>
            </div>
          )}
        </div>
        {hasLocation && (
          <a
            href={`https://maps.google.com/?q=${exif.latitude},${exif.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block overflow-hidden rounded-lg border"
          >
            <iframe
              src={`https://maps.google.com/maps?q=${exif.latitude},${exif.longitude}&z=15&ie=UTF8&iwloc=&output=embed`}
              className="pointer-events-none block h-32 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </a>
        )}
      </div>

      {/* Camera */}
      {hasCameraData && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Camera</p>
          <div className="rounded-lg border divide-y text-sm">
            <ExifRow label="Device" value={exif.camera} />
            <ExifRow label="Lens" value={exif.lens} />
            <ExifRow label="ISO" value={exif.iso} />
            <ExifRow label="Aperture" value={exif.aperture != null ? `f/${exif.aperture}` : null} />
            <ExifRow label="Shutter speed" value={exif.shutter_speed != null ? `${exif.shutter_speed}s` : null} />
            <ExifRow label="Focal length" value={exif.focal_length} />
            <ExifRow label="Flash" value={exif.flash} />
            <ExifRow label="Exposure mode" value={exif.exposure_mode} />
            <ExifRow label="White balance" value={exif.white_balance} />
            <ExifRow label="Scene type" value={exif.scene_type} />
            <ExifRow label="Software" value={exif.software} />
          </div>
        </div>
      )}

      {/* Image */}
      {hasImageData && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Image</p>
          <div className="rounded-lg border divide-y text-sm">
            <ExifRow label="Resolution" value={exif.width && exif.height ? `${exif.width} × ${exif.height}` : null} />
            <ExifRow label="Color space" value={decodeColorSpace(exif.color_space)} />
            <ExifRow label="Orientation" value={exif.orientation} />
            <ExifRow label="File type" value={exif.file_type} />
            <ExifRow label="File size" value={exif.file_size ? formatBytes(exif.file_size) : null} />
          </div>
        </div>
      )}

      {/* Upload context */}
      {hasUploadContext && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Upload Context</p>
          <div className="rounded-lg border divide-y text-sm">
            <ExifRow label="Device" value={exif.device_name} />
            <ExifRow label="OS" value={exif.os} />
            <ExifRow label="Browser" value={exif.browser} />
          </div>
        </div>
      )}
    </div>
  );
}

