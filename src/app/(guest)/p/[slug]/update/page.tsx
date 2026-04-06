"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/hooks/use-property";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Car, Gift, Plus, Loader2, Check, ChevronLeft } from "lucide-react";

type AgeGroup = "over_21" | "under_21" | "infant";
type GuestEntry = { first_name: string; last_name: string; age_group: AgeGroup };
type Vehicle = { make: string; model: string; color: string; license_plate: string; state_or_region: string; year: string; driver_name: string };

type SessionData = {
  guestName: string;
  reservation: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    num_guests: number;
    property: { slug: string };
  };
};

const SESSION_KEY = "guest-portal-session";

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type View = "menu" | "add-guest" | "add-driver";

export default function UpdateRegistrationPage() {
  const property = useProperty();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [view, setView] = useState<View>("menu");

  // Add guest form
  const [newGuest, setNewGuest] = useState<GuestEntry>({ first_name: "", last_name: "", age_group: "over_21" });
  const [savingGuest, setSavingGuest] = useState(false);
  const [guestSaved, setGuestSaved] = useState(false);
  const [existingGuests, setExistingGuests] = useState<GuestEntry[]>([]);

  // Add driver form
  const [newDriver, setNewDriver] = useState<Vehicle>({ make: "", model: "", color: "", license_plate: "", state_or_region: "", year: "", driver_name: "" });
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverSaved, setDriverSaved] = useState(false);
  const [existingVehicles, setExistingVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    async function loadRegistration() {
      const session = loadSession();
      if (!session) {
        setError("No active session found. Please look up your booking first.");
        setLoading(false);
        return;
      }

      const guestName = session.guestName;

      const { data: guestRows } = await supabase
        .from("guest")
        .select("id, full_name, email")
        .ilike("full_name", guestName.trim());

      const guest = guestRows?.find(
        (g) => g.full_name.toLowerCase().trim() === guestName.toLowerCase().trim()
      );

      if (!guest) {
        setError("Could not find your registration. Please contact support.");
        setLoading(false);
        return;
      }

      const { data: reg } = await supabase
        .from("registration")
        .select("id, guest_list, pets")
        .eq("guest_id", guest.id)
        .eq("property_id", property.id)
        .eq("status", "active")
        .order("check_in_date", { ascending: false })
        .limit(1)
        .single();

      if (!reg) {
        setError("No active registration found for this property.");
        setLoading(false);
        return;
      }

      setRegistrationId(reg.id);
      setExistingGuests((reg.guest_list as GuestEntry[]) || []);

      const { data: vehicleData } = await supabase
        .from("vehicle")
        .select("*")
        .eq("registration_id", reg.id);

      setExistingVehicles(
        (vehicleData || []).map((v) => ({
          make: v.make || "",
          model: v.model || "",
          color: v.color || "",
          license_plate: v.license_plate || "",
          state_or_region: v.state_or_region || "",
          year: v.year || "",
          driver_name: v.driver_name || "",
        }))
      );

      setLoading(false);
    }

    loadRegistration();
  }, []);

  async function handleAddGuest() {
    if (!registrationId || !newGuest.first_name.trim() || !newGuest.last_name.trim()) return;
    setSavingGuest(true);

    const updatedGuests = [...existingGuests, newGuest];

    const res = await fetch("/api/guest/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_id: registrationId,
        section: "guest_list",
        guest_list: updatedGuests,
      }),
    });

    if (res.ok) {
      setExistingGuests(updatedGuests);
      setNewGuest({ first_name: "", last_name: "", age_group: "over_21" });
      setGuestSaved(true);
      setTimeout(() => setGuestSaved(false), 3000);
    }
    setSavingGuest(false);
  }

  async function handleAddDriver() {
    if (!registrationId || !newDriver.driver_name.trim() || !newDriver.license_plate.trim()) return;
    setSavingDriver(true);

    const updatedVehicles = [...existingVehicles, newDriver];

    const res = await fetch("/api/guest/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_id: registrationId,
        section: "vehicles",
        vehicles: updatedVehicles,
      }),
    });

    if (res.ok) {
      setExistingVehicles(updatedVehicles);
      setNewDriver({ make: "", model: "", color: "", license_plate: "", state_or_region: "", year: "", driver_name: "" });
      setDriverSaved(true);
      setTimeout(() => setDriverSaved(false), 3000);
    }
    setSavingDriver(false);
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading your registration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Update Your Registration</h1>
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  // --- Add Guest form ---
  if (view === "add-guest") {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <Button type="button" variant="ghost" size="sm" onClick={() => setView("menu")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add a Guest</h1>
          <p className="text-muted-foreground text-sm">
            Add a new guest to your registration. An updated form will be sent to the HOA.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input value={newGuest.first_name} onChange={(e) => setNewGuest({ ...newGuest, first_name: e.target.value })} placeholder="First" />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input value={newGuest.last_name} onChange={(e) => setNewGuest({ ...newGuest, last_name: e.target.value })} placeholder="Last" />
            </div>
            <div className="space-y-1">
              <Label>Age Group</Label>
              <div className="flex items-center gap-4 h-9 text-sm">
                {(["over_21", "under_21", "infant"] as AgeGroup[]).map((val) => (
                  <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="age-group" value={val}
                      checked={newGuest.age_group === val}
                      onChange={() => setNewGuest({ ...newGuest, age_group: val })} />
                    <span>{val === "over_21" ? "21+" : val === "under_21" ? "Under 21" : "Infant"}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {guestSaved && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" /> Guest added successfully
          </div>
        )}

        <Button
          className="w-full"
          disabled={savingGuest || !newGuest.first_name.trim() || !newGuest.last_name.trim()}
          onClick={handleAddGuest}
        >
          <Plus className="h-4 w-4 mr-2" />
          {savingGuest ? "Adding..." : "Add Guest"}
        </Button>

        {existingGuests.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Guests ({existingGuests.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {existingGuests.map((g, i) => (
                <p key={i} className="text-sm">
                  {g.first_name} {g.last_name} <span className="text-muted-foreground">({g.age_group === "over_21" ? "21+" : g.age_group === "under_21" ? "<21" : "Infant"})</span>
                </p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // --- Add Driver form ---
  if (view === "add-driver") {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <Button type="button" variant="ghost" size="sm" onClick={() => setView("menu")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add a Driver</h1>
          <p className="text-muted-foreground text-sm">
            Register a new vehicle and driver. An updated form will be sent to the HOA.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1">
              <Label>Driver *</Label>
              <Select value={newDriver.driver_name} onValueChange={(v) => setNewDriver({ ...newDriver, driver_name: v ?? "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a guest" />
                </SelectTrigger>
                <SelectContent>
                  {existingGuests.filter((g) => g.first_name || g.last_name).map((g, i) => {
                    const name = `${g.first_name} ${g.last_name}`.trim();
                    return (
                      <SelectItem key={i} value={name}>{name}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>License Plate</Label>
                <Input value={newDriver.license_plate} onChange={(e) => setNewDriver({ ...newDriver, license_plate: e.target.value })} placeholder="ABC-1234" />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input value={newDriver.state_or_region} onChange={(e) => setNewDriver({ ...newDriver, state_or_region: e.target.value })} placeholder="PA" />
              </div>
              <div className="space-y-1">
                <Label>Make</Label>
                <Input value={newDriver.make} onChange={(e) => setNewDriver({ ...newDriver, make: e.target.value })} placeholder="Toyota" />
              </div>
              <div className="space-y-1">
                <Label>Model</Label>
                <Input value={newDriver.model} onChange={(e) => setNewDriver({ ...newDriver, model: e.target.value })} placeholder="Camry" />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <Input value={newDriver.color} onChange={(e) => setNewDriver({ ...newDriver, color: e.target.value })} placeholder="Silver" />
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Input value={newDriver.year} onChange={(e) => setNewDriver({ ...newDriver, year: e.target.value })} placeholder="2024" />
              </div>
            </div>
          </CardContent>
        </Card>

        {driverSaved && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" /> Driver added successfully
          </div>
        )}

        <Button
          className="w-full"
          disabled={savingDriver || !newDriver.driver_name.trim() || !newDriver.license_plate.trim()}
          onClick={handleAddDriver}
        >
          <Plus className="h-4 w-4 mr-2" />
          {savingDriver ? "Adding..." : "Add Driver"}
        </Button>

        {existingVehicles.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Vehicles ({existingVehicles.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {existingVehicles.map((v, i) => (
                <p key={i} className="text-sm">
                  {v.year} {v.make} {v.model} <span className="text-muted-foreground">— {v.driver_name}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // --- Menu screen ---
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Update Your Registration</h1>
        <p className="text-muted-foreground text-sm">
          What would you like to add?
        </p>
      </div>

      <div className="grid gap-3">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setView("add-guest")}>
          <CardHeader className="flex flex-row items-center gap-4 p-5">
            <div className="rounded-full bg-primary/10 p-3">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Add a Guest</CardTitle>
              <CardDescription className="text-sm">Register a new guest for your stay</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setView("add-driver")}>
          <CardHeader className="flex flex-row items-center gap-4 p-5">
            <div className="rounded-full bg-primary/10 p-3">
              <Car className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Add a Driver</CardTitle>
              <CardDescription className="text-sm">Register a vehicle and driver</CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Link href={`/p/${property.slug}/add-ons`}>
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader className="flex flex-row items-center gap-4 p-5">
              <div className="rounded-full bg-primary/10 p-3">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Add an Add-On</CardTitle>
                <CardDescription className="text-sm">Extras and experiences for your stay</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
