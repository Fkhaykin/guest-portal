"use client";

import { useEffect, useState, useRef, use, type PointerEvent as ReactPointerEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Save, Phone, PenLine, Undo2, Link2, Plus, Trash2 } from "lucide-react";

export default function OwnerSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Common fields
  const [hoaType, setHoaType] = useState("pepoa");
  const [ownerName, setOwnerName] = useState("");
  const [ownerMailingAddress, setOwnerMailingAddress] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [lotSection, setLotSection] = useState("");
  const [hoaSubmissionEmail, setHoaSubmissionEmail] = useState("");

  // BMLC-specific fields
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactPhone2, setEmergencyContactPhone2] = useState("");
  const [rentalAgentEnabled, setRentalAgentEnabled] = useState(true);
  const [rentalAgencyName, setRentalAgencyName] = useState("");
  const [rentalAgencyContact, setRentalAgencyContact] = useState("");

  // Listing URLs (platform → URL)
  const [listingUrls, setListingUrls] = useState<Array<{ platform: string; url: string }>>([]);

  // Owner signature (per-property)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [existingSignatureUrl, setExistingSignatureUrl] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawing = useRef(false);

  const supabase = createClient();

  useEffect(() => {
    loadProperty();
  }, [id]);

  async function loadProperty() {
    const { data } = await supabase
      .from("property")
      .select("owner_name, owner_mailing_address, owner_phone, owner_email, lot_section, hoa_submission_email, hoa_type, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_phone_2, rental_agent_enabled, rental_agency_name, rental_agency_contact, owner_signature_url, listing_urls")
      .eq("id", id)
      .single();

    if (data) {
      setHoaType(data.hoa_type || "pepoa");
      setOwnerName(data.owner_name || "");
      setOwnerMailingAddress(data.owner_mailing_address || "");
      setOwnerPhone(data.owner_phone || "");
      setOwnerEmail(data.owner_email || "");
      setLotSection(data.lot_section || "");
      setHoaSubmissionEmail(data.hoa_submission_email || "");
      setEmergencyContactName(data.emergency_contact_name || "");
      setEmergencyContactRelationship(data.emergency_contact_relationship || "");
      setEmergencyContactPhone(data.emergency_contact_phone || "");
      setEmergencyContactPhone2(data.emergency_contact_phone_2 || "");
      setRentalAgentEnabled(data.rental_agent_enabled ?? true);
      setRentalAgencyName(data.rental_agency_name || "");
      setRentalAgencyContact(data.rental_agency_contact || "");
      const urls = (data.listing_urls ?? {}) as Record<string, string>;
      setListingUrls(Object.entries(urls).map(([platform, url]) => ({ platform, url })));
      if (data.owner_signature_url) {
        const res = await fetch(`/api/admin/signature-url?path=${encodeURIComponent(data.owner_signature_url)}`);
        if (res.ok) {
          const { url } = await res.json();
          if (url) setExistingSignatureUrl(url);
        }
      }
    }
    setLoading(false);
  }

  function clearSignature() {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureDataUrl(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const update: Record<string, unknown> = {
      hoa_type: hoaType,
      owner_name: ownerName.trim() || null,
      owner_mailing_address: ownerMailingAddress.trim() || null,
      owner_phone: ownerPhone.trim() || null,
      owner_email: ownerEmail.trim().toLowerCase() || null,
      lot_section: lotSection.trim() || null,
      hoa_submission_email: hoaSubmissionEmail.trim().toLowerCase() || null,
      emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_relationship: emergencyContactRelationship.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
      emergency_contact_phone_2: emergencyContactPhone2.trim() || null,
      rental_agent_enabled: rentalAgentEnabled,
      rental_agency_name: rentalAgencyName.trim() || null,
      rental_agency_contact: rentalAgencyContact.trim() || null,
      listing_urls: Object.fromEntries(
        listingUrls
          .filter((l) => l.platform.trim() && l.url.trim())
          .map((l) => [l.platform.trim(), l.url.trim()])
      ),
    };

    // Upload new owner signature via API route (needs admin client for storage)
    if (signatureDataUrl && signatureDataUrl.startsWith("data:image/png;base64,")) {
      const sigRes = await fetch("/api/admin/upload-owner-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: id, signature: signatureDataUrl }),
      });
      if (sigRes.ok) {
        const { path } = await sigRes.json();
        const urlRes = await fetch(`/api/admin/signature-url?path=${encodeURIComponent(path)}`);
        if (urlRes.ok) {
          const { url } = await urlRes.json();
          if (url) setExistingSignatureUrl(url);
        }
        setSignatureDataUrl(null);
      }
    }

    await supabase.from("property").update(update).eq("id", id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-48" /><div className="h-64 bg-muted rounded" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Owner / HOA Settings</h1>
        <p className="text-muted-foreground">
          Owner and HOA information used on the registration PDF
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* HOA Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle>HOA Template</CardTitle>
            <CardDescription>
              Select which HOA this property belongs to. This determines the PDF format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label>HOA Community</Label>
              <Select value={hoaType} onValueChange={(v) => setHoaType(v ?? "pepoa")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pepoa">Penn Estates (PEPOA)</SelectItem>
                  <SelectItem value="bmlc">Blue Mountain Lake Club (BMLC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Owner of Record */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Owner of Record
            </CardTitle>
            <CardDescription>
              This information appears on the tenant registration form submitted to the HOA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Deeded Owner Name(s)</Label>
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Yuriy Khaykin & Raisa Fishbeyn" />
            </div>
            <div className="space-y-1">
              <Label>Mailing Address</Label>
              <Textarea value={ownerMailingAddress} onChange={(e) => setOwnerMailingAddress(e.target.value)} placeholder="1 Ballo Pl, Edison, NJ 08820" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="(732) 979-3856" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@example.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BMLC-specific: Emergency Contact & Rental Agent */}
        {hoaType === "bmlc" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" /> Emergency Contact & Rental Agent
              </CardTitle>
              <CardDescription>
                Required for Blue Mountain Lake Club forms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Emergency Contact Name</Label>
                  <Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Feliks Khaykin" />
                </div>
                <div className="space-y-1">
                  <Label>Relationship</Label>
                  <Input value={emergencyContactRelationship} onChange={(e) => setEmergencyContactRelationship(e.target.value)} placeholder="Property Manager/Son" />
                </div>
                <div className="space-y-1">
                  <Label>Emergency Phone</Label>
                  <Input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="(732) 213-8571" />
                </div>
                <div className="space-y-1">
                  <Label>Other Phone</Label>
                  <Input value={emergencyContactPhone2} onChange={(e) => setEmergencyContactPhone2(e.target.value)} placeholder="(732) 979-3855" />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rentalAgentEnabled} onChange={(e) => setRentalAgentEnabled(e.target.checked)} />
                    <span className="text-sm font-medium">Uses Rental Agent</span>
                  </label>
                </div>
                {rentalAgentEnabled && (
                  <>
                    <div className="space-y-1">
                      <Label>Rental Agency Name</Label>
                      <Input value={rentalAgencyName} onChange={(e) => setRentalAgencyName(e.target.value)} placeholder='484 Lakeside Dr LLC (dba "Summit Lakeside Rentals")' />
                    </div>
                    <div className="space-y-1">
                      <Label>Agency Contact Info</Label>
                      <Input value={rentalAgencyContact} onChange={(e) => setRentalAgencyContact(e.target.value)} placeholder="Feliks Khaykin (732) 213-8571" />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* HOA Details */}
        <Card>
          <CardHeader>
            <CardTitle>HOA Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Lot #</Label>
              <Input value={lotSection} onChange={(e) => setLotSection(e.target.value)} placeholder="e.g. 88C" />
            </div>
            <div className="space-y-1">
              <Label>HOA Submission Email</Label>
              <Input type="email" value={hoaSubmissionEmail} onChange={(e) => setHoaSubmissionEmail(e.target.value)} placeholder="office@pepoa.org" />
              <p className="text-xs text-muted-foreground">
                The generated PDF will be emailed to this address after each guest registration or update
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Listing URLs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" /> Listing URLs
            </CardTitle>
            <CardDescription>
              Add links to your listings on booking platforms (Airbnb, VRBO, Booking.com, etc.).
              These appear next to the booking source on the registrations page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {listingUrls.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="w-40"
                  placeholder="Platform"
                  value={entry.platform}
                  onChange={(e) => {
                    const updated = [...listingUrls];
                    updated[idx] = { ...entry, platform: e.target.value };
                    setListingUrls(updated);
                  }}
                />
                <Input
                  className="flex-1"
                  placeholder="https://..."
                  value={entry.url}
                  onChange={(e) => {
                    const updated = [...listingUrls];
                    updated[idx] = { ...entry, url: e.target.value };
                    setListingUrls(updated);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setListingUrls(listingUrls.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setListingUrls([...listingUrls, { platform: "", url: "" }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Listing
            </Button>
          </CardContent>
        </Card>

        {/* Owner Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" /> Owner Signature
            </CardTitle>
            <CardDescription>
              This signature is applied to the HOA registration PDF as the property owner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingSignatureUrl && !signatureDataUrl && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Current signature:</p>
                <div className="border rounded-lg p-2 bg-white inline-block">
                  <img src={existingSignatureUrl} alt="Owner signature" className="h-16" />
                </div>
              </div>
            )}
            <div className="relative rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white">
              <canvas
                ref={sigCanvasRef}
                width={460}
                height={200}
                className="w-full touch-none cursor-crosshair"
                onPointerDown={(e: ReactPointerEvent<HTMLCanvasElement>) => {
                  const canvas = sigCanvasRef.current;
                  if (!canvas) return;
                  sigDrawing.current = true;
                  canvas.setPointerCapture(e.pointerId);
                  const rect = canvas.getBoundingClientRect();
                  const scaleX = canvas.width / rect.width;
                  const scaleY = canvas.height / rect.height;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  ctx.beginPath();
                  ctx.moveTo(
                    (e.clientX - rect.left) * scaleX,
                    (e.clientY - rect.top) * scaleY
                  );
                }}
                onPointerMove={(e: ReactPointerEvent<HTMLCanvasElement>) => {
                  if (!sigDrawing.current) return;
                  const canvas = sigCanvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const scaleX = canvas.width / rect.width;
                  const scaleY = canvas.height / rect.height;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return;
                  ctx.lineWidth = 2.5;
                  ctx.lineCap = "round";
                  ctx.lineJoin = "round";
                  ctx.strokeStyle = "#000";
                  ctx.lineTo(
                    (e.clientX - rect.left) * scaleX,
                    (e.clientY - rect.top) * scaleY
                  );
                  ctx.stroke();
                }}
                onPointerUp={() => {
                  sigDrawing.current = false;
                  const canvas = sigCanvasRef.current;
                  if (canvas) {
                    setSignatureDataUrl(canvas.toDataURL("image/png"));
                  }
                }}
              />
              {!signatureDataUrl && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-sm">
                  {existingSignatureUrl ? "Draw a new signature to replace" : "Draw your signature here"}
                </div>
              )}
            </div>
            {signatureDataUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                <Undo2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        </div>
      </form>
    </div>
  );
}
