import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";
import { RegistrationActions } from "@/components/admin/registration-actions";
import type { GuestListEntry, PetEntry } from "@/types/database";

export default async function AdminRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("name, listing_urls")
    .eq("id", id)
    .single();

  if (!property) notFound();

  const { data: registrations } = await supabase
    .from("registration")
    .select("*, guest:guest_id(full_name, email, phone)")
    .eq("property_id", id)
    .not("signature_url", "is", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Registrations</h1>
        <p className="text-muted-foreground">{property.name}</p>
      </div>

      {registrations && registrations.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Booked</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registrations.map((reg) => {
              const guest = reg.guest as { full_name: string; email: string | null; phone: string | null } | null;
              return (
                <TableRow key={reg.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {guest?.full_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {guest?.email || guest?.phone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{reg.check_in_date}</TableCell>
                  <TableCell>{reg.check_out_date}</TableCell>
                  <TableCell>
                    {(() => {
                      const la = (reg as Record<string, number>).lodgify_adults ?? 0;
                      const lc = (reg as Record<string, number>).lodgify_children ?? 0;
                      const li = (reg as Record<string, number>).lodgify_infants ?? 0;
                      const lp = (reg as Record<string, number>).lodgify_num_pets ?? 0;
                      if (!la && !lc && !li && !lp) return <span className="text-muted-foreground text-xs">{reg.num_guests} guest{reg.num_guests !== 1 ? "s" : ""}</span>;
                      return (
                        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                          {la > 0 && <span>{la}A</span>}
                          {lc > 0 && <span>{lc}C</span>}
                          {li > 0 && <span>{li}I</span>}
                          {lp > 0 && <span>{lp}P</span>}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const guestList = (reg.guest_list ?? []) as GuestListEntry[];
                      const pets = (reg.pets ?? []) as PetEntry[];
                      const lp = (reg as Record<string, number>).lodgify_num_pets ?? 0;
                      if (!guestList.length && !pets.length) return <span className="text-xs text-muted-foreground">—</span>;
                      const a = guestList.filter((g) => g.age_group === "over_21").length;
                      const c = guestList.filter((g) => g.age_group === "under_21").length;
                      const inf = guestList.filter((g) => g.age_group === "infant").length;
                      const extraPets = lp > 0 ? pets.length - lp : 0;
                      return (
                        <div className="flex flex-wrap gap-x-2 text-xs">
                          {a > 0 && <span>{a}A</span>}
                          {c > 0 && <span>{c}C</span>}
                          {inf > 0 && <span>{inf}I</span>}
                          {pets.length > 0 && (
                            <span className={extraPets > 0 ? "text-amber-600 font-medium" : ""}>
                              {pets.length}P{extraPets > 0 && ` (+${extraPets})`}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {reg.booking_source ? (() => {
                      const listingUrls = (property.listing_urls ?? {}) as Record<string, string>;
                      const listingUrl = listingUrls[reg.booking_source!];
                      const sourceDisplayNames: Record<string, string> = {
                        AirbnbIntegration: "Airbnb",
                      };
                      const displayName = sourceDisplayNames[reg.booking_source!] ?? reg.booking_source;
                      return listingUrl ? (
                        <a
                          href={listingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {displayName}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">{displayName}</span>
                      );
                    })() : (
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
                    <RegistrationActions
                      registrationId={reg.id}
                      hasSignature={!!reg.signature_url}
                      guestName={guest?.full_name ?? "Unknown"}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">No registrations yet.</p>
      )}
    </div>
  );
}
