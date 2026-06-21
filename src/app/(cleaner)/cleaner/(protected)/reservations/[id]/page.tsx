import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { maskGuestName } from "@/lib/cleaner/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, Home, CalendarDays, Users, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params }: { params: { id: string } }) {
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();
  const { data: registration } = await supabase
    .from("registration")
    .select(
      `*,
      guest:guest_id(full_name, email, phone),
      property:property_id(name, nickname, cover_image_url, address)
    `)
    .eq("id", params.id)
    .single();

  if (!registration) {
    notFound();
  }

  const { data: cleaningStatus } = await supabase
    .from("cleaning_status")
    .select("is_cleaned, cleaned_at, fulfilled_upsells")
    .eq("registration_id", params.id)
    .single();

  const guest = registration.guest as { full_name: string | null; email: string | null; phone: string | null } | null;
  const property = registration.property as { name: string; nickname: string | null; cover_image_url: string | null; address: string | null } | null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/cleaner/invoices" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to invoices
        </Link>
        <Badge variant={registration.status === "completed" ? "secondary" : registration.status === "active" ? "default" : "destructive"}>
          {registration.status}
        </Badge>
      </div>

      <div className="space-y-4">
        <PageHeader
          title="Reservation details"
          actions={
            <div className="text-right">
              <p className="text-sm font-medium">{property?.name ?? "Unknown property"}</p>
              {property?.address && <p className="text-xs text-muted-foreground">{property.address}</p>}
            </div>
          }
        />

        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Guest</p>
                <p className="font-medium text-sm">{maskGuestName(guest?.full_name) ?? "Unknown guest"}</p>
                {guest?.email && <p className="text-sm text-muted-foreground">{guest.email}</p>}
                {guest?.phone && <p className="text-sm text-muted-foreground">{guest.phone}</p>}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Dates</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>{registration.check_in_date} → {registration.check_out_date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{registration.num_guests} guest{registration.num_guests !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Home className="h-4 w-4" />
                <span>{property?.nickname ?? property?.name ?? "Property"}</span>
              </div>
              {cleaningStatus ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Cleaning status</p>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {cleaningStatus.is_cleaned ? "Cleaned" : "Pending"}
                    </span>
                    {cleaningStatus.cleaned_at && (
                      <span className="text-muted-foreground">Cleaned on {new Date(cleaningStatus.cleaned_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cleaning status recorded yet.</p>
              )}
            </div>

            {registration.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Notes</p>
                  <p className="text-sm">{registration.notes}</p>
                </div>
              </>
            )}

            <Separator />

            <Link
              href="/cleaner/tasks"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Clock className="h-4 w-4" />
              View all tasks
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
