import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, ExternalLink } from "lucide-react";

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
              <TableHead>Guests</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
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
                  <TableCell>{reg.num_guests}</TableCell>
                  <TableCell>
                    {reg.booking_source ? (() => {
                      const listingUrls = (property.listing_urls ?? {}) as Record<string, string>;
                      const listingUrl = listingUrls[reg.booking_source!];
                      return listingUrl ? (
                        <a
                          href={listingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {reg.booking_source}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">{reg.booking_source}</span>
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
                  <TableCell>
                    {reg.signature_url && (
                      <Link href={`/api/pepoa/generate?registration_id=${reg.id}`} target="_blank">
                        <Button variant="ghost" size="icon" title="Download PEPOA PDF">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
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
