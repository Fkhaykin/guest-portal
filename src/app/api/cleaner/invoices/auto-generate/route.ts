import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOwnersOfInvoiceGenerated } from "@/lib/notifications/invoice-generated";
import type { InvoiceLineItem } from "@/types/database";

// GET/POST /api/cleaner/invoices/auto-generate
// Called daily by Vercel cron (GET) or manually (POST with optional { force }).
//
// - Mondays: weekly invoice per cleaner for Summit properties (everything
//   except Bianca's) covering the week before last (Monday–Sunday), so a
//   checkout ages at least a week before it's billed.
//   The first weekly invoice of each month also carries the Summit share
//   of the monthly fee.
// - 1st of the month: monthly invoice per cleaner for Bianca's covering the
//   prior month's checkouts, plus Bianca's share of the monthly fee.
//
// The cleaner's monthly_fee_cents is the total ($1,000 today); Bianca's
// share is $200 and Summit gets the remainder ($800).
//
// Unbilled cleanings older than the window are swept in too, so a cleaning
// marked complete late is picked up on the next run instead of lost. Billing
// is tracked per kind (cleaning+pet / firewood / tips), so a stay whose
// cleaning was already invoiced still gets missed firewood fees and guest
// tips swept onto the next invoice.

const BIANCA_MONTHLY_FEE_CENTS = 20_000;
const FIREWOOD_FEE_CENTS = 1_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

type RegRow = {
  id: string;
  property_id: string;
  check_out_date: string;
  pets: Array<{ name?: string }> | null;
  upsells: Array<{ type: string; status: string; price_cents?: number }> | null;
};

// What has already been billed for a registration, by kind. "core" is the
// cleaning + pet fee; firewood and guest tips are tracked separately so a
// stay whose cleaning was invoiced can still get its missed extras swept
// onto a later invoice.
type BilledKind = "core" | "firewood" | "tip";

type PropRow = {
  id: string;
  name: string;
  nickname: string | null;
  cleaning_fee_cents: number | null;
  owner_email: string | null;
  owner_phone: string | null;
};

function buildLineItems(
  regs: RegRow[],
  propMap: Map<string, PropRow>,
  petFeeCents: number,
  billedKinds: Map<string, Set<BilledKind>>
): InvoiceLineItem[] {
  const lineItems: InvoiceLineItem[] = [];
  for (const reg of regs) {
    const prop = propMap.get(reg.property_id);
    if (!prop) continue;

    const kinds = billedKinds.get(reg.id);
    const propLabel = prop.nickname || prop.name;
    const paidUpsells = (reg.upsells || []).filter((u) => u.status === "paid");

    if (!kinds?.has("core")) {
      const cleaningFee = prop.cleaning_fee_cents ?? 0;
      if (cleaningFee > 0) {
        lineItems.push({
          description: `Cleaning — ${propLabel} (checkout ${reg.check_out_date})`,
          type: "cleaning",
          property_name: prop.name,
          property_nickname: prop.nickname ?? undefined,
          registration_id: reg.id,
          amount: cleaningFee,
        });
      }

      // Pet fee (use cleaner's rate, not property's guest-facing rate)
      const hasPets = (reg.pets || []).some((p) => p.name?.trim());
      if (hasPets && petFeeCents > 0) {
        lineItems.push({
          description: `Pet fee — ${propLabel} (checkout ${reg.check_out_date})`,
          type: "pet_fee",
          property_name: prop.name,
          property_nickname: prop.nickname ?? undefined,
          registration_id: reg.id,
          amount: petFeeCents,
        });
      }
    }

    // Firewood delivery fee — cleaner drops off the bundle
    const firewoodCount = kinds?.has("firewood")
      ? 0
      : paidUpsells.filter((u) => u.type === "firewood").length;
    if (firewoodCount > 0) {
      lineItems.push({
        description: `Firewood delivery${firewoodCount > 1 ? ` ×${firewoodCount}` : ""} — ${propLabel} (checkout ${reg.check_out_date})`,
        type: "extra",
        property_name: prop.name,
        property_nickname: prop.nickname ?? undefined,
        registration_id: reg.id,
        amount: firewoodCount * FIREWOOD_FEE_CENTS,
      });
    }

    // Guest tips collected through the portal pass through in full
    const tipCents = kinds?.has("tip")
      ? 0
      : paidUpsells
          .filter((u) => u.type.startsWith("tip_"))
          .reduce((sum, u) => sum + (u.price_cents || 0), 0);
    if (tipCents > 0) {
      lineItems.push({
        description: `Guest tips — ${propLabel} (checkout ${reg.check_out_date})`,
        type: "tip",
        property_name: prop.name,
        property_nickname: prop.nickname ?? undefined,
        registration_id: reg.id,
        amount: tipCents,
      });
    }
  }
  return lineItems;
}

function checkAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runAutoGenerate(force?: "weekly" | "monthly") {
  const supabase = createAdminClient();

  const today = new Date();
  const runWeekly = today.getUTCDay() === 1 || force === "weekly";
  const runMonthly = today.getUTCDate() === 1 || force === "monthly";

  if (!runWeekly && !runMonthly) {
    return NextResponse.json({
      message: "Not Monday or the 1st — nothing to generate",
      invoices_created: 0,
    });
  }

  // Weekly window: the week before last (Monday–Sunday), a full week back so
  // Sunday checkouts aren't racing the Monday-morning cron
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const thisMonday = addDays(today, -daysSinceMonday);
  const weekStart = isoDate(addDays(thisMonday, -14));
  const weekEnd = isoDate(addDays(thisMonday, -8));

  // Prior calendar month
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const priorMonthStart = isoDate(new Date(Date.UTC(year, month - 1, 1)));
  const priorMonthEnd = isoDate(new Date(Date.UTC(year, month, 0)));
  const priorMonthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );

  // Monthly fees are labeled with the month they're issued in
  const monthName = today.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // Bianca's is billed monthly; every other property is billed weekly
  const { data: biancaProps } = await supabase
    .from("property")
    .select("id")
    .ilike("nickname", "%bianca%");
  const biancaIds = new Set((biancaProps || []).map((p) => p.id));

  const { data: cleaners } = await supabase
    .from("cleaner")
    .select("id, host_id, name, company, pet_fee_cents, monthly_fee_cents")
    .eq("is_active", true);

  if (!cleaners || cleaners.length === 0) {
    return NextResponse.json({ message: "No active cleaners", invoices_created: 0 });
  }

  let invoicesCreated = 0;

  for (const cleaner of cleaners) {
    const { data: assignments } = await supabase
      .from("cleaner_property")
      .select("property_id")
      .eq("cleaner_id", cleaner.id);

    const propertyIds = (assignments || []).map((a) => a.property_id);
    if (propertyIds.length === 0) continue;

    const assignedBianca = propertyIds.some((id) => biancaIds.has(id));
    const assignedSummit = propertyIds.some((id) => !biancaIds.has(id));

    const { data: properties } = await supabase
      .from("property")
      .select("id, name, nickname, cleaning_fee_cents, owner_email, owner_phone")
      .in("id", propertyIds);

    const propMap = new Map<string, PropRow>(
      (properties || []).map((p) => [p.id, p as PropRow])
    );

    // Distinct owner contacts for the properties covered by an invoice.
    // owner_email and owner_phone may hold multiple comma-separated values.
    const ownerContacts = (ids: string[]) => {
      const emails = new Set<string>();
      const phones = new Set<string>();
      for (const id of ids) {
        const p = propMap.get(id);
        for (const email of (p?.owner_email ?? "").split(/[,;\n]/)) {
          if (email.trim()) emails.add(email.trim());
        }
        for (const phone of (p?.owner_phone ?? "").split(/[,;\n]/)) {
          if (phone.trim()) phones.add(phone.trim());
        }
      }
      return { emails: [...emails], phones: [...phones] };
    };

    // Existing non-draft invoices: dedup source for both cleanings and fees
    const { data: existingInvoices } = await supabase
      .from("cleaner_invoice")
      .select("line_items")
      .eq("cleaner_id", cleaner.id)
      .neq("status", "draft");

    const billedKinds = new Map<string, Set<BilledKind>>();
    for (const inv of existingInvoices || []) {
      for (const item of inv.line_items as InvoiceLineItem[]) {
        if (!item.registration_id) continue;
        let kinds = billedKinds.get(item.registration_id);
        if (!kinds) {
          kinds = new Set();
          billedKinds.set(item.registration_id, kinds);
        }
        if (item.type === "tip") kinds.add("tip");
        else if (item.type === "extra" && /firewood/i.test(item.description)) kinds.add("firewood");
        else kinds.add("core");
      }
    }

    // A legacy full-amount fee invoice (no Summit/Bianca label) covers both shares
    const feeAlreadyBilled = (portion: "Summit" | "Bianca's") =>
      (existingInvoices || []).some((inv) =>
        (inv.line_items as InvoiceLineItem[]).some((item) => {
          if (item.type !== "monthly_fee") return false;
          if (!item.description.includes(monthName)) return false;
          const isLegacyFull =
            !item.description.includes("Summit") &&
            !item.description.includes("Bianca");
          return isLegacyFull || item.description.includes(portion);
        })
      );

    const { data: cleanedStatuses } = await supabase
      .from("cleaning_status")
      .select("registration_id, registration!inner(property_id)")
      .eq("is_cleaned", true)
      .eq("is_skipped", false)
      .in("registration.property_id", propertyIds);

    // Fetch every cleaned registration — buildLineItems emits only the kinds
    // still unbilled for each, so fully-billed stays contribute nothing.
    const cleanedIds = (cleanedStatuses || []).map((s) => s.registration_id);

    let regs: RegRow[] = [];
    if (cleanedIds.length > 0) {
      const { data } = await supabase
        .from("registration")
        .select("id, property_id, check_out_date, pets, upsells")
        .in("id", cleanedIds);
      regs = (data || []) as RegRow[];
    }

    const petFee = cleaner.pet_fee_cents ?? 0;
    const monthlyFeeTotal = cleaner.monthly_fee_cents ?? 0;
    const biancaFee =
      monthlyFeeTotal > 0 ? Math.min(BIANCA_MONTHLY_FEE_CENTS, monthlyFeeTotal) : 0;
    const summitFee = Math.max(0, monthlyFeeTotal - biancaFee);

    // --- Weekly invoice: Summit properties, checkouts through the window ---
    if (runWeekly && assignedSummit) {
      const weeklyRegs = regs.filter(
        (r) => !biancaIds.has(r.property_id) && r.check_out_date <= weekEnd
      );
      const lineItems = buildLineItems(weeklyRegs, propMap, petFee, billedKinds);

      // Summit's share of the monthly fee rides on the first weekly invoice of the month
      if (summitFee > 0 && !feeAlreadyBilled("Summit")) {
        lineItems.push({
          description: `Monthly fee — Summit (${monthName})`,
          type: "monthly_fee",
          amount: summitFee,
        });
      }

      if (lineItems.length > 0) {
        // Stretch the period back only for stays actually billed on this
        // invoice (late-swept items) — not for old, fully-billed stays
        const billedRegIds = new Set(
          lineItems.map((i) => i.registration_id).filter(Boolean)
        );
        const earliestCheckout = weeklyRegs
          .filter((r) => billedRegIds.has(r.id))
          .map((r) => r.check_out_date)
          .sort()[0];
        const periodStart =
          earliestCheckout && earliestCheckout < weekStart
            ? earliestCheckout
            : weekStart;
        const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);

        const { data: created, error } = await supabase
          .from("cleaner_invoice")
          .insert({
            cleaner_id: cleaner.id,
            host_id: cleaner.host_id,
            status: "submitted",
            period_start: periodStart,
            period_end: weekEnd,
            line_items: lineItems,
            adjustments: [],
            attachments: [],
            subtotal,
            total: subtotal,
            notes: `Auto-generated weekly invoice (${weekStart} – ${weekEnd})`,
            submitted_at: new Date().toISOString(),
          })
          .select("invoice_number")
          .single();

        if (!error) {
          invoicesCreated++;
          const invoicedPropIds = weeklyRegs.length
            ? [...new Set(weeklyRegs.map((r) => r.property_id))]
            : propertyIds.filter((id) => !biancaIds.has(id));
          const { emails, phones } = ownerContacts(invoicedPropIds);
          await notifyOwnersOfInvoiceGenerated({
            invoiceNumber: created?.invoice_number ?? "",
            cleanerName: cleaner.name,
            cleanerCompany: cleaner.company,
            kind: "Weekly — Summit",
            periodStart,
            periodEnd: weekEnd,
            lineItems,
            total: subtotal,
            ownerEmails: emails,
            ownerPhones: phones,
          });
        }
      }
    }

    // --- Monthly invoice: Bianca's, checkouts through end of prior month ---
    if (runMonthly && assignedBianca) {
      const monthlyRegs = regs.filter(
        (r) => biancaIds.has(r.property_id) && r.check_out_date <= priorMonthEnd
      );
      const lineItems = buildLineItems(monthlyRegs, propMap, petFee, billedKinds);

      if (biancaFee > 0 && !feeAlreadyBilled("Bianca's")) {
        lineItems.push({
          description: `Monthly fee — Bianca's (${monthName})`,
          type: "monthly_fee",
          amount: biancaFee,
        });
      }

      if (lineItems.length > 0) {
        const billedRegIds = new Set(
          lineItems.map((i) => i.registration_id).filter(Boolean)
        );
        const earliestCheckout = monthlyRegs
          .filter((r) => billedRegIds.has(r.id))
          .map((r) => r.check_out_date)
          .sort()[0];
        const periodStart =
          earliestCheckout && earliestCheckout < priorMonthStart
            ? earliestCheckout
            : priorMonthStart;
        const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);

        const { data: created, error } = await supabase
          .from("cleaner_invoice")
          .insert({
            cleaner_id: cleaner.id,
            host_id: cleaner.host_id,
            status: "submitted",
            period_start: periodStart,
            period_end: priorMonthEnd,
            line_items: lineItems,
            adjustments: [],
            attachments: [],
            subtotal,
            total: subtotal,
            notes: `Auto-generated monthly invoice — Bianca's (${priorMonthName})`,
            submitted_at: new Date().toISOString(),
          })
          .select("invoice_number")
          .single();

        if (!error) {
          invoicesCreated++;
          const invoicedPropIds = monthlyRegs.length
            ? [...new Set(monthlyRegs.map((r) => r.property_id))]
            : propertyIds.filter((id) => biancaIds.has(id));
          const { emails, phones } = ownerContacts(invoicedPropIds);
          await notifyOwnersOfInvoiceGenerated({
            invoiceNumber: created?.invoice_number ?? "",
            cleanerName: cleaner.name,
            cleanerCompany: cleaner.company,
            kind: `Monthly — Bianca's (${priorMonthName})`,
            periodStart,
            periodEnd: priorMonthEnd,
            lineItems,
            total: subtotal,
            ownerEmails: emails,
            ownerPhones: phones,
          });
        }
      }
    }
  }

  return NextResponse.json({
    message: `Generated ${invoicesCreated} invoice(s)`,
    invoices_created: invoicesCreated,
  });
}

// Vercel cron invokes the path with GET
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runAutoGenerate();
}

// Manual trigger; body may include { force: "weekly" | "monthly" }
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let force: "weekly" | "monthly" | undefined;
  try {
    const body = await request.json();
    if (body?.force === "weekly" || body?.force === "monthly") {
      force = body.force;
    }
  } catch {
    // no body
  }
  return runAutoGenerate(force);
}
