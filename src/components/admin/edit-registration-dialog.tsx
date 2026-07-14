"use client";

import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";

type GuestListEntry = { first_name: string; last_name: string; age_group: string };
type PetEntry = { name: string; kind: string; rabies_doc_path: string | null; vaccination_doc_path: string | null };
type VehicleEntry = {
  make: string;
  model: string;
  color: string;
  license_plate: string;
  state_or_region: string;
  year: string;
  driver_name: string;
};

type FormData = {
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  guest_mailing_address: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  status: "active" | "completed" | "cancelled";
  notes: string;
  total_amount: string; // dollars; "" = leave unchanged
  guest_list: GuestListEntry[];
  pets: PetEntry[];
  vehicles: VehicleEntry[];
};

const emptyGuest: GuestListEntry = { first_name: "", last_name: "", age_group: "over_21" };
const emptyPet: PetEntry = { name: "", kind: "", rabies_doc_path: null, vaccination_doc_path: null };
const emptyVehicle: VehicleEntry = { make: "", model: "", color: "", license_plate: "", state_or_region: "", year: "", driver_name: "" };

export function EditRegistrationDialog({
  registrationId,
  open,
  onOpenChange,
  onSaved,
}: {
  registrationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [form, setForm] = useState<FormData | null>(null);
  const [lodgifyBookingId, setLodgifyBookingId] = useState<number | null>(null);
  const [bookingSource, setBookingSource] = useState<string | null>(null);

  useEffect(() => {
    if (open && registrationId) {
      loadRegistration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, registrationId]);

  async function loadRegistration() {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/admin/registration?id=${registrationId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      const reg = data.registration;
      const guest = reg.guest as { full_name: string; email: string | null; phone: string | null; mailing_address: string | null } | null;
      const vehicles = (data.vehicles ?? []) as Array<{
        make: string | null; model: string | null; color: string | null;
        license_plate: string; state_or_region: string | null; year: string | null; driver_name: string | null;
      }>;

      setLodgifyBookingId(reg.lodgify_booking_id ?? null);
      setBookingSource(reg.booking_source ?? null);
      setForm({
        guest_name: guest?.full_name ?? "",
        guest_email: guest?.email ?? "",
        guest_phone: guest?.phone ?? "",
        guest_mailing_address: guest?.mailing_address ?? "",
        check_in_date: reg.check_in_date ?? "",
        check_out_date: reg.check_out_date ?? "",
        num_guests: reg.num_guests ?? 1,
        status: reg.status ?? "active",
        notes: reg.notes ?? "",
        total_amount:
          typeof reg.total_amount_cents === "number" && reg.total_amount_cents > 0
            ? (reg.total_amount_cents / 100).toFixed(2)
            : "",
        guest_list: (reg.guest_list as GuestListEntry[] | null)?.length
          ? (reg.guest_list as GuestListEntry[])
          : [{ ...emptyGuest }],
        pets: (reg.pets as PetEntry[] | null)?.length
          ? (reg.pets as PetEntry[])
          : [],
        vehicles: vehicles.length
          ? vehicles.map((v) => ({
              make: v.make ?? "",
              model: v.model ?? "",
              color: v.color ?? "",
              license_plate: v.license_plate,
              state_or_region: v.state_or_region ?? "",
              year: v.year ?? "",
              driver_name: v.driver_name ?? "",
            }))
          : [],
      });
    } catch {
      setError("Failed to load registration");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setWarning(null);

    const totalStr = form.total_amount.trim();
    let totalCents: number | undefined;
    if (totalStr !== "") {
      const dollars = Number(totalStr);
      if (!Number.isFinite(dollars) || dollars < 0) {
        setError("Total amount must be a valid number");
        setSaving(false);
        return;
      }
      totalCents = Math.round(dollars * 100);
    }

    try {
      const res = await fetch("/api/admin/registration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: registrationId,
          ...form,
          total_amount_cents: totalCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save");
      }
      onSaved?.();
      if (data.lodgify_warning) {
        // Saved, but Lodgify needs manual cleanup — keep the dialog open so
        // the admin sees the warning before moving on.
        setWarning(data.lodgify_warning);
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateGuestListEntry(index: number, field: keyof GuestListEntry, value: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const list = [...prev.guest_list];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, guest_list: list };
    });
  }

  function updatePetEntry(index: number, field: keyof PetEntry, value: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const list = [...prev.pets];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, pets: list };
    });
  }

  function updateVehicleEntry(index: number, field: keyof VehicleEntry, value: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const list = [...prev.vehicles];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, vehicles: list };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Registration</DialogTitle>
          <DialogDescription>Update guest and booking details</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error && !form ? (
          <p className="text-sm text-destructive py-4">{error}</p>
        ) : form ? (
          <div className="space-y-6">
            {/* Guest Info */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Guest Information</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="guest_name">Full Name</Label>
                  <Input
                    id="guest_name"
                    value={form.guest_name}
                    onChange={(e) => updateField("guest_name", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="guest_email">Email</Label>
                  <Input
                    id="guest_email"
                    type="email"
                    value={form.guest_email}
                    onChange={(e) => updateField("guest_email", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="guest_phone">Phone</Label>
                  <Input
                    id="guest_phone"
                    value={form.guest_phone}
                    onChange={(e) => updateField("guest_phone", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => updateField("status", v as FormData["status"])}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="guest_address">Mailing Address</Label>
                <Textarea
                  id="guest_address"
                  rows={2}
                  value={form.guest_mailing_address}
                  onChange={(e) => updateField("guest_mailing_address", e.target.value)}
                />
              </div>
            </section>

            {/* Booking Dates */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Booking Details</h3>
              {lodgifyBookingId && (
                <p className="text-xs text-muted-foreground">
                  {bookingSource === "admin" || bookingSource === "direct"
                    ? "Linked to Lodgify — changing the dates moves the Lodgify hold so Airbnb/VRBO see the new dates."
                    : `This booking came from ${bookingSource || "an OTA"}. Changes are saved here and protected from being overwritten by Lodgify sync, but the channel itself is not updated.`}
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="check_in">Check-in</Label>
                  <Input
                    id="check_in"
                    type="date"
                    value={form.check_in_date}
                    onChange={(e) => updateField("check_in_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="check_out">Check-out</Label>
                  <Input
                    id="check_out"
                    type="date"
                    value={form.check_out_date}
                    onChange={(e) => updateField("check_out_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="num_guests">No. Guests</Label>
                  <Input
                    id="num_guests"
                    type="number"
                    min={1}
                    value={form.num_guests}
                    onChange={(e) => updateField("num_guests", parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="total_amount">Total ($)</Label>
                  <Input
                    id="total_amount"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Unchanged"
                    value={form.total_amount}
                    onChange={(e) => updateField("total_amount", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                />
              </div>
            </section>

            {/* Guest List */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Guest List</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateField("guest_list", [...form.guest_list, { ...emptyGuest }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {form.guest_list.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="First name"
                    value={g.first_name}
                    onChange={(e) => updateGuestListEntry(i, "first_name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Last name"
                    value={g.last_name}
                    onChange={(e) => updateGuestListEntry(i, "last_name", e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={g.age_group}
                    onValueChange={(v) => updateGuestListEntry(i, "age_group", v ?? "over_21")}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="over_21">Over 21</SelectItem>
                      <SelectItem value="under_21">Under 21</SelectItem>
                      <SelectItem value="infant">Infant</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      const list = form.guest_list.filter((_, idx) => idx !== i);
                      updateField("guest_list", list.length ? list : [{ ...emptyGuest }]);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </section>

            {/* Pets */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pets</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateField("pets", [...form.pets, { ...emptyPet }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {form.pets.length === 0 && (
                <p className="text-xs text-muted-foreground">No pets</p>
              )}
              {form.pets.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Pet name"
                    value={p.name}
                    onChange={(e) => updatePetEntry(i, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Kind (dog, cat...)"
                    value={p.kind}
                    onChange={(e) => updatePetEntry(i, "kind", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => updateField("pets", form.pets.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </section>

            {/* Vehicles */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Vehicles</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateField("vehicles", [...form.vehicles, { ...emptyVehicle }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {form.vehicles.length === 0 && (
                <p className="text-xs text-muted-foreground">No vehicles</p>
              )}
              {form.vehicles.map((v, i) => (
                <div key={i} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Year"
                      value={v.year}
                      onChange={(e) => updateVehicleEntry(i, "year", e.target.value)}
                      className="w-20"
                    />
                    <Input
                      placeholder="Make"
                      value={v.make}
                      onChange={(e) => updateVehicleEntry(i, "make", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Model"
                      value={v.model}
                      onChange={(e) => updateVehicleEntry(i, "model", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => updateField("vehicles", form.vehicles.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Color"
                      value={v.color}
                      onChange={(e) => updateVehicleEntry(i, "color", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="License plate"
                      value={v.license_plate}
                      onChange={(e) => updateVehicleEntry(i, "license_plate", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="State"
                      value={v.state_or_region}
                      onChange={(e) => updateVehicleEntry(i, "state_or_region", e.target.value)}
                      className="w-20"
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Driver name"
                      value={v.driver_name}
                      onChange={(e) => updateVehicleEntry(i, "driver_name", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </section>

            {/* Error + Save */}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {warning && (
              <p className="text-sm rounded-md px-3 py-2 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Saved. {warning}
              </p>
            )}
            <div className="flex justify-end gap-2">
              {warning ? (
                <Button onClick={() => onOpenChange(false)}>Close</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
