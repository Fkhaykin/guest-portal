"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  PawPrint,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toneBadge } from "@/lib/status-styles";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { PetEntry, AircoverClaimStatus } from "@/types/database";
import { aircoverNav } from "@/lib/admin/nav/aircover";

export type Claim = {
  id: string;
  registration_id: string;
  property_id: string;
  cleaner_id: string | null;
  claim_type: "damage" | "pet_discrepancy";
  status: AircoverClaimStatus;
  damage_description: string | null;
  damage_photos: string[];
  pet_description: string | null;
  reported_pet_count: number | null;
  reported_pet_labels: string[];
  expected_pet_count: number | null;
  created_at: string;
  updated_at: string;
  registration: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    guest: { full_name: string; email: string | null; phone: string | null } | null;
    pets: PetEntry[] | null;
  } | null;
  property: { name: string; nickname: string | null } | null;
  cleaner: { name: string } | null;
};

const STATUS_CONFIG: Record<
  AircoverClaimStatus,
  { label: string; color: string; icon: typeof AlertTriangle }
> = {
  open: {
    label: "Open",
    color: toneBadge("danger"),
    icon: AlertTriangle,
  },
  claim_filed: {
    label: "Claim Filed",
    color: toneBadge("info"),
    icon: FileText,
  },
  claim_approved: {
    label: "Claim Approved",
    color: toneBadge("success"),
    icon: CheckCircle,
  },
  claim_denied: {
    label: "Claim Denied",
    color: toneBadge("neutral"),
    icon: XCircle,
  },
};

export default function AircoverClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set());
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const supabase = createClient();

  useEffect(() => {
    loadClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadClaims() {
    setLoading(true);
    // Read from the shared prefetch cache — a sidebar hover may have already
    // warmed the identical /api/admin/aircover-claims load before this mount.
    const nextClaims = await aircoverNav.get([]);
    if (nextClaims) setClaims(nextClaims);
    setLoading(false);
  }

  async function updateStatus(claimId: string, newStatus: AircoverClaimStatus) {
    setUpdating(claimId);
    const res = await fetch("/api/admin/aircover-claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: claimId, status: newStatus }),
    });
    if (res.ok) {
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: newStatus } : c))
      );
      // Drop the warm entry so a remount within the TTL can't re-serve the
      // pre-mutation list.
      aircoverNav.invalidate();
    }
    setUpdating(null);
  }

  async function deleteClaim(claimId: string) {
    if (!confirm("Delete this claim? This cannot be undone.")) return;
    setUpdating(claimId);
    const res = await fetch("/api/admin/aircover-claims", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: claimId }),
    });
    if (res.ok) {
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
      // Drop the warm entry so a remount within the TTL can't re-serve the
      // just-deleted claim.
      aircoverNav.invalidate();
    }
    setUpdating(null);
  }

  function toggleExpand(claimId: string) {
    setExpandedClaims((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) next.delete(claimId);
      else next.add(claimId);
      return next;
    });
  }

  async function getDamagePhotoUrl(path: string) {
    if (photoUrls[path]) return photoUrls[path];
    const { data } = await supabase.storage
      .from("damage-photos")
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      setPhotoUrls((prev) => ({ ...prev, [path]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  }

  // Group claims by registration
  const grouped = claims.reduce<Record<string, Claim[]>>((acc, claim) => {
    const key = claim.registration_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(claim);
    return acc;
  }, {});

  const openCount = claims.filter((c) => c.status === "open").length;
  const filedCount = claims.filter((c) => c.status === "claim_filed").length;
  const approvedCount = claims.filter((c) => c.status === "claim_approved").length;
  const deniedCount = claims.filter((c) => c.status === "claim_denied").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Potential Claims" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} value={openCount} label="Open" tone="danger" />
        <StatCard icon={FileText} value={filedCount} label="Claim Filed" tone="info" />
        <StatCard icon={CheckCircle} value={approvedCount} label="Approved" tone="success" />
        <StatCard icon={XCircle} value={deniedCount} label="Denied" tone="neutral" />
      </div>

      {/* Claims list grouped by reservation */}
      {loading ? (
        <p className="text-muted-foreground">Loading claims...</p>
      ) : claims.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No potential claims"
          description="Claims will appear here when cleaners report damages or pet discrepancies."
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([registrationId, regClaims]) => {
            const firstClaim = regClaims[0];
            const reg = firstClaim.registration;
            const prop = firstClaim.property;
            const isExpanded = expandedClaims.has(registrationId);

            return (
              <Card key={registrationId}>
                <CardHeader
                  className="cursor-pointer pb-3"
                  onClick={() => toggleExpand(registrationId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {prop?.nickname || prop?.name || "Unknown Property"}
                        <span className="text-sm font-normal text-muted-foreground">
                          — {reg?.guest?.full_name || "Unknown Guest"}
                        </span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {reg?.check_in_date} → {reg?.check_out_date}
                        {firstClaim.cleaner && (
                          <span> | Reported by {firstClaim.cleaner.name}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {regClaims.map((c) => {
                          const config = STATUS_CONFIG[c.status];
                          return (
                            <Badge
                              key={c.id}
                              variant="outline"
                              className={`text-[10px] ${config.color}`}
                            >
                              {c.claim_type === "damage" ? (
                                <AlertTriangle className="h-3 w-3 mr-1" />
                              ) : (
                                <PawPrint className="h-3 w-3 mr-1" />
                              )}
                              {config.label}
                            </Badge>
                          );
                        })}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-4">
                    <Separator />
                    {regClaims.map((claim) => (
                      <ClaimDetail
                        key={claim.id}
                        claim={claim}
                        updating={updating}
                        onUpdateStatus={updateStatus}
                        onDelete={deleteClaim}
                        getDamagePhotoUrl={getDamagePhotoUrl}
                        photoUrls={photoUrls}
                      />
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClaimDetail({
  claim,
  updating,
  onUpdateStatus,
  onDelete,
  getDamagePhotoUrl,
  photoUrls,
}: {
  claim: Claim;
  updating: string | null;
  onUpdateStatus: (id: string, status: AircoverClaimStatus) => void;
  onDelete: (id: string) => void;
  getDamagePhotoUrl: (path: string) => Promise<string | null>;
  photoUrls: Record<string, string>;
}) {
  const config = STATUS_CONFIG[claim.status];
  const isUpdating = updating === claim.id;

  // Load photo URLs on mount for damage claims
  useEffect(() => {
    if (claim.claim_type === "damage" && claim.damage_photos.length > 0) {
      claim.damage_photos.forEach((path) => {
        if (!photoUrls[path]) getDamagePhotoUrl(path);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim.damage_photos]);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {claim.claim_type === "damage" ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <PawPrint className="h-5 w-5 text-warning" />
          )}
          <span className="font-medium text-sm">
            {claim.claim_type === "damage" ? "Damage Report" : "Pet Discrepancy"}
          </span>
          <Badge variant="outline" className={config.color}>
            {config.label}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(claim.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Damage details */}
      {claim.claim_type === "damage" && (
        <div className="space-y-2">
          {claim.damage_description && (
            <p className="text-sm">{claim.damage_description}</p>
          )}
          {claim.damage_photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {claim.damage_photos.map((path, i) => (
                <a
                  key={i}
                  href={photoUrls[path] || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-24 h-24 rounded-lg overflow-hidden border bg-muted"
                >
                  {photoUrls[path] ? (
                    <img
                      src={photoUrls[path]}
                      alt={`Damage ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pet discrepancy details */}
      {claim.claim_type === "pet_discrepancy" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="text-muted-foreground">Expected:</span>{" "}
              <span className="font-medium">{claim.expected_pet_count ?? 0} pets</span>
            </span>
            <span>
              <span className="text-muted-foreground">Reported:</span>{" "}
              <span className={`font-medium ${(claim.reported_pet_count ?? 0) !== (claim.expected_pet_count ?? 0) ? "text-destructive" : ""}`}>
                {claim.reported_pet_count ?? 0} pets
              </span>
            </span>
          </div>
          {claim.reported_pet_labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {claim.reported_pet_labels.map((label, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <PawPrint className="h-3 w-3 mr-1" />
                  {label}
                </Badge>
              ))}
            </div>
          )}
          {/* Show registration pet data for comparison */}
          {claim.registration?.pets && claim.registration.pets.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Registration pets:</span>{" "}
              {claim.registration.pets
                .filter((p) => p.name?.trim())
                .map((p) => `${p.name} (${p.kind})`)
                .join(", ") || "None registered"}
            </div>
          )}
          {claim.pet_description && (
            <p className="text-sm">{claim.pet_description}</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {claim.status === "open" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isUpdating}
            onClick={() => onUpdateStatus(claim.id, "claim_filed")}
          >
            {isUpdating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 mr-1" />
            )}
            Claim Filed
          </Button>
        )}
        {(claim.status === "open" || claim.status === "claim_filed") && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="border-success/40 text-success hover:bg-success/10"
              disabled={isUpdating}
              onClick={() => onUpdateStatus(claim.id, "claim_approved")}
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
              )}
              Claim Approved
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground hover:bg-muted"
              disabled={isUpdating}
              onClick={() => onUpdateStatus(claim.id, "claim_denied")}
            >
              {isUpdating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mr-1" />
              )}
              Claim Denied
            </Button>
          </>
        )}
        {(claim.status === "claim_approved" || claim.status === "claim_denied") && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={isUpdating}
            onClick={() => onUpdateStatus(claim.id, "open")}
          >
            Reopen
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
          disabled={isUpdating}
          onClick={() => onDelete(claim.id)}
        >
          {isUpdating ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5 mr-1" />
          )}
          Delete
        </Button>
      </div>
    </div>
  );
}
