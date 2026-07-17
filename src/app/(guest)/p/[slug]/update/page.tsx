"use client";

import { useState, useEffect } from "react";
import { useProperty } from "@/hooks/use-property";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { getGuestToken } from "@/lib/guest-session";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Users, Car, Gift, PawPrint, Plus, Minus, Loader2, Check, ChevronLeft, Upload, Truck, ShoppingBag, Package, Sparkles, CalendarPlus } from "lucide-react";

type AgeGroup = "over_21" | "under_21" | "infant";
type GuestEntry = { first_name: string; last_name: string; age_group: AgeGroup };
type Vehicle = { make: string; model: string; color: string; license_plate: string; state_or_region: string; year: string; driver_name: string };
type PetEntry = { name: string; kind: string; rabies_doc_path: string | null; vaccination_doc_path: string | null };

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
const PENDING_PET_KEY = "guest-portal-pending-pet";

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type View = "menu" | "add-guest" | "add-driver" | "add-pet" | "delivery";

type DeliveryCategory = "rideshare" | "food_grocery" | "other";

const RIDESHARE_PROVIDERS = [
  { id: "uber", name: "Uber", logo: true },
  { id: "lyft", name: "Lyft", logo: true },
  { id: "taxi", name: "Taxi", logo: false },
] as const;

const FOOD_PROVIDERS = [
  { id: "doordash", name: "DoorDash" },
  { id: "ubereats", name: "Uber Eats" },
  { id: "grubhub", name: "GrubHub" },
  { id: "seamless", name: "Seamless" },
  { id: "walmart", name: "Walmart" },
  { id: "bjs", name: "BJ's" },
  { id: "weiss", name: "Weis" },
  { id: "giant", name: "Giant" },
] as const;

const BRAND_LOGOS: Record<string, string> = {
  uber: "/logos/uber.png",
  lyft: "/logos/lyft.png",
  doordash: "/logos/doordash.png",
  ubereats: "/logos/ubereats.png",
  grubhub: "/logos/grubhub.png",
  seamless: "/logos/seamless.png",
  walmart: "/logos/walmart.png",
  bjs: "/logos/bjs.png",
  weiss: "/logos/weis.png",
  giant: "/logos/giant.png",
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function FoodProviderIcon({ id, name }: { id: string; name: string }) {
  const logo = BRAND_LOGOS[id];
  if (logo) {
    return <img src={logo} alt={name} className="w-10 h-10 object-contain" />;
  }
  return <Package className="h-6 w-6 text-muted-foreground" />;
}

export default function UpdateRegistrationPage() {
  const property = useProperty();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [maxGuests, setMaxGuests] = useState(12);
  const [view, setView] = useState<View>("menu");
  // null = not yet checked (card stays enabled), false = no open nights (grey it out).
  const [canExtend, setCanExtend] = useState<boolean | null>(null);

  // Delivery state
  const [deliveryStep, setDeliveryStep] = useState(1);
  const [deliveryCategory, setDeliveryCategory] = useState<DeliveryCategory | null>(null);
  const [deliveryProvider, setDeliveryProvider] = useState<string | null>(null);
  const [numCars, setNumCars] = useState(1);
  const [arrivalDate, setArrivalDate] = useState("");
  const [hasReturn, setHasReturn] = useState(false);
  const [returnCars, setReturnCars] = useState(1);
  const [returnDate, setReturnDate] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [deliverySubmitted, setDeliverySubmitted] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<{ id: string; check_in_date: string; check_out_date: string } | null>(null);

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

  // Add pet form
  const [newPet, setNewPet] = useState<{ name: string; kind: string }>({ name: "", kind: "" });
  const [rabiesFile, setRabiesFile] = useState<File | null>(null);
  const [vaccinationFile, setVaccinationFile] = useState<File | null>(null);
  const [savingPet, setSavingPet] = useState(false);
  const [petSaved, setPetSaved] = useState(false);
  const [existingPets, setExistingPets] = useState<PetEntry[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    async function loadRegistration() {
      const session = loadSession();
      if (!session) {
        setError("No active session found. Please look up your booking first.");
        setLoading(false);
        return;
      }

      // Extend-stay availability only needs the reservation id, so fire it in
      // parallel with the registration-details load instead of waiting for the
      // details round-trip (and registrationId) to resolve first. Fire-and-forget:
      // it only greys out the extend card. Only flip to false on a definitive
      // empty result — leave it enabled while loading or if the check fails.
      fetch("/api/guest/extend-stay/options", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ registration_id: session.reservation.id }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.options)) setCanExtend(data.options.length > 0);
        })
        .catch(() => {});

      const res = await fetch("/api/guest/registration-details", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ registration_id: session.reservation.id }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token missing or expired — send guest back to re-authenticate
          sessionStorage.removeItem(SESSION_KEY);
          window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        setError("Could not find your registration. Please contact support.");
        setLoading(false);
        return;
      }

      const data = await res.json();

      setRegistrationId(data.id);
      setMaxGuests(data.max_guests ?? 12);
      setExistingGuests((data.guest_list as GuestEntry[]) || []);
      setExistingPets((data.pets as PetEntry[]) || []);
      setHadPetsOnRegistration(data.has_pets_from_booking);
      setPetFeeCents(data.pet_fee_cents ?? 0);
      setLodgifyNumPets(data.lodgify_num_pets ?? 0);
      setExistingVehicles(data.vehicles);
      setReservation({
        id: session.reservation.id,
        check_in_date: session.reservation.check_in_date,
        check_out_date: session.reservation.check_out_date,
      });
      setLoading(false);
    }

    loadRegistration();
  }, []);

  // Handle return from Stripe pet payment
  useEffect(() => {
    const upsellSuccess = searchParams.get("upsell_success");
    const sessionId = searchParams.get("session_id");
    if (upsellSuccess !== "true" || !sessionId) return;

    // Clean up URL params
    window.history.replaceState({}, "", window.location.pathname);

    const pendingRaw = sessionStorage.getItem(PENDING_PET_KEY);
    if (!pendingRaw) return;

    let pending: { pet: PetEntry; registration_id: string };
    try {
      pending = JSON.parse(pendingRaw);
    } catch {
      return;
    }

    sessionStorage.removeItem(PENDING_PET_KEY);

    async function confirmAndSavePet() {
      setSavingPet(true);

      // Confirm Stripe payment
      const confirmRes = await fetch("/api/guest/upsells/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({ session_id: sessionId, registration_id: pending.registration_id }),
      });

      if (!confirmRes.ok) {
        setSavingPet(false);
        return;
      }

      // Fetch current pets to avoid stale data
      const supabase = createClient();
      const { data: reg } = await supabase
        .from("registration")
        .select("pets")
        .eq("id", pending.registration_id)
        .single();

      const currentPets = (reg?.pets as PetEntry[]) || [];
      const updatedPets = [...currentPets, pending.pet];

      // Save pet to registration
      const updateRes = await fetch("/api/guest/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({
          registration_id: pending.registration_id,
          section: "pets",
          pets: updatedPets,
        }),
      });

      if (updateRes.ok) {
        setExistingPets(updatedPets);
        setPetSaved(true);
        setTimeout(() => setPetSaved(false), 5000);
      }
      setSavingPet(false);
    }

    confirmAndSavePet();
  }, [searchParams]);

  async function handleAddGuest() {
    if (!registrationId || !newGuest.first_name.trim() || !newGuest.last_name.trim()) return;
    setSavingGuest(true);

    const updatedGuests = [...existingGuests, newGuest];

    const res = await fetch("/api/guest/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
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
    if (existingVehicles.length >= property.max_vehicles) return;
    setSavingDriver(true);

    const updatedVehicles = [...existingVehicles, newDriver];

    const res = await fetch("/api/guest/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
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

  // Whether this guest originally had pets — determines if pet fee applies
  const [hadPetsOnRegistration, setHadPetsOnRegistration] = useState(false);
  const [petFeeCents, setPetFeeCents] = useState(0);
  const [lodgifyNumPets, setLodgifyNumPets] = useState(0);

  async function uploadPetDocs(regId: string, petIndex: number) {
    let rabiesPath: string | null = null;
    let vaccinationPath: string | null = null;

    if (rabiesFile) {
      const fd = new FormData();
      fd.append("file", rabiesFile);
      fd.append("registration_id", regId);
      fd.append("pet_index", String(petIndex));
      fd.append("doc_type", "rabies");
      const res = await fetch("/api/guest/upload-pet-doc", { method: "POST", headers: { "x-guest-token": getGuestToken() }, body: fd });
      if (res.ok) {
        const data = await res.json();
        rabiesPath = data.path;
      }
    }

    if (vaccinationFile) {
      const fd = new FormData();
      fd.append("file", vaccinationFile);
      fd.append("registration_id", regId);
      fd.append("pet_index", String(petIndex));
      fd.append("doc_type", "vaccination");
      const res = await fetch("/api/guest/upload-pet-doc", { method: "POST", headers: { "x-guest-token": getGuestToken() }, body: fd });
      if (res.ok) {
        const data = await res.json();
        vaccinationPath = data.path;
      }
    }

    return { rabiesPath, vaccinationPath };
  }

  async function handleAddPet() {
    if (!registrationId || !newPet.name.trim() || !newPet.kind.trim()) return;
    setSavingPet(true);
    setUploadingDocs(true);

    const petIndex = existingPets.length;
    const { rabiesPath, vaccinationPath } = await uploadPetDocs(registrationId, petIndex);
    setUploadingDocs(false);

    const petEntry: PetEntry = {
      name: newPet.name.trim(),
      kind: newPet.kind.trim(),
      rabies_doc_path: rabiesPath,
      vaccination_doc_path: vaccinationPath,
    };

    // Charge pet fee if this pet exceeds the original Lodgify booking pet count
    const totalPetsAfterAdd = existingPets.length + 1;
    const needsFee = totalPetsAfterAdd > lodgifyNumPets && petFeeCents > 0;

    if (needsFee) {
      sessionStorage.setItem(PENDING_PET_KEY, JSON.stringify({ pet: petEntry, registration_id: registrationId }));

      const checkoutRes = await fetch("/api/guest/upsells/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({
          registration_id: registrationId,
          items: [{
            type: "pet_fee",
            label: `Pet Fee — ${petEntry.name} (${petEntry.kind})`,
            price_cents: petFeeCents,
            meta: { pet_name: petEntry.name, pet_kind: petEntry.kind },
          }],
          return_path: "update",
        }),
      });

      if (checkoutRes.ok) {
        const { url } = await checkoutRes.json();
        window.location.href = url;
      } else {
        sessionStorage.removeItem(PENDING_PET_KEY);
        setSavingPet(false);
      }
      return;
    }

    // No fee needed — add directly
    const updatedPets = [...existingPets, petEntry];
    const res = await fetch("/api/guest/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
      body: JSON.stringify({
        registration_id: registrationId,
        section: "pets",
        pets: updatedPets,
      }),
    });

    if (res.ok) {
      setExistingPets(updatedPets);
      setNewPet({ name: "", kind: "" });
      setRabiesFile(null);
      setVaccinationFile(null);
      setPetSaved(true);
      setTimeout(() => setPetSaved(false), 3000);
    }
    setSavingPet(false);
  }

  // --- Delivery helpers ---
  function getProviderLabel() {
    if (!deliveryProvider) return "Other";
    const ride = RIDESHARE_PROVIDERS.find((p) => p.id === deliveryProvider);
    if (ride) return ride.name;
    const food = FOOD_PROVIDERS.find((p) => p.id === deliveryProvider);
    if (food) return food.name;
    return deliveryProvider;
  }

  async function handleDeliverySubmit() {
    if (!reservation) return;
    setSubmittingDelivery(true);
    setDeliveryError(null);
    try {
      const res = await fetch("/api/guest/delivery-rideshare", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({
          registration_id: reservation.id,
          category: deliveryCategory,
          provider: getProviderLabel(),
          num_cars: deliveryCategory === "rideshare" ? numCars : 1,
          arrival_date: arrivalDate,
          has_return: deliveryCategory === "rideshare" ? hasReturn : false,
          return_cars: hasReturn ? returnCars : null,
          return_date: hasReturn ? returnDate : null,
          notes: deliveryNotes || null,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem(SESSION_KEY);
          window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        const data = await res.json();
        setDeliveryError(data.error || "Something went wrong");
      } else {
        setDeliverySubmitted(true);
      }
    } catch {
      setDeliveryError("Unable to connect. Please try again.");
    } finally {
      setSubmittingDelivery(false);
    }
  }

  function resetDeliveryForm() {
    setDeliveryStep(1);
    setDeliveryCategory(null);
    setDeliveryProvider(null);
    setNumCars(1);
    setArrivalDate("");
    setHasReturn(false);
    setReturnCars(1);
    setReturnDate("");
    setDeliveryNotes("");
    setDeliverySubmitted(false);
    setDeliveryError(null);
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
      <div className="space-y-6 max-w-md mx-auto kiosk-wide-md">
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
          <CardContent className="pt-6 space-y-4 kiosk-cols-2">
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input value={newGuest.first_name} onChange={(e) => setNewGuest({ ...newGuest, first_name: e.target.value })} placeholder="First" />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input value={newGuest.last_name} onChange={(e) => setNewGuest({ ...newGuest, last_name: e.target.value })} placeholder="Last" />
            </div>
            <div className="space-y-1 kiosk-col-span">
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

        {existingGuests.length >= maxGuests ? (
          <p className="text-sm text-destructive text-center">
            This property has a maximum capacity of {maxGuests} guests.
          </p>
        ) : (
          <Button
            className="w-full"
            disabled={savingGuest || !newGuest.first_name.trim() || !newGuest.last_name.trim()}
            onClick={handleAddGuest}
          >
            <Plus className="h-4 w-4 mr-2" />
            {savingGuest ? "Adding..." : `Add Guest (${existingGuests.length}/${maxGuests})`}
          </Button>
        )}

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

  // --- Add Pet form ---
  if (view === "add-pet") {
    return (
      <div className="space-y-6 max-w-md mx-auto kiosk-wide-md">
        <Button type="button" variant="ghost" size="sm" onClick={() => setView("menu")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add a Pet</h1>
          <p className="text-muted-foreground text-sm">
            {petFeeCents > 0 && existingPets.length + 1 > lodgifyNumPets
              ? `A $${(petFeeCents / 100).toFixed(petFeeCents % 100 === 0 ? 0 : 2)} pet fee applies for pets not included in your original reservation. An updated form will be sent to the HOA.`
              : "Add another pet to your registration. An updated form will be sent to the HOA."}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4 kiosk-cols-2">
            <div className="space-y-1">
              <Label>Pet Name *</Label>
              <Input value={newPet.name} onChange={(e) => setNewPet({ ...newPet, name: e.target.value })} placeholder="Buddy" />
            </div>
            <div className="space-y-1">
              <Label>Type *</Label>
              <Input value={newPet.kind} onChange={(e) => setNewPet({ ...newPet, kind: e.target.value })} placeholder="Dog, Cat, etc." />
            </div>
            <div className="space-y-1">
              <Label>Rabies Certificate</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 cursor-pointer rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className={rabiesFile ? "text-green-600" : "text-muted-foreground"}>
                    {rabiesFile ? rabiesFile.name : "Upload file"}
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setRabiesFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Vaccination Records</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 cursor-pointer rounded-md border border-input px-3 py-2 text-sm hover:bg-accent transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className={vaccinationFile ? "text-green-600" : "text-muted-foreground"}>
                    {vaccinationFile ? vaccinationFile.name : "Upload file"}
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setVaccinationFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {petSaved && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" /> Pet added successfully
          </div>
        )}

        <Button
          className="w-full"
          disabled={savingPet || !newPet.name.trim() || !newPet.kind.trim()}
          onClick={handleAddPet}
        >
          {savingPet
            ? uploadingDocs ? "Uploading documents..." : (petFeeCents > 0 && existingPets.length + 1 > lodgifyNumPets) ? "Redirecting to payment..." : "Adding..."
            : (petFeeCents > 0 && existingPets.length + 1 > lodgifyNumPets) ? `Add Pet — $${(petFeeCents / 100).toFixed(petFeeCents % 100 === 0 ? 0 : 2)}` : "Add Pet"}
        </Button>

        {existingPets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Pets ({existingPets.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {existingPets.map((p, i) => (
                <p key={i} className="text-sm">
                  {p.name} <span className="text-muted-foreground">({p.kind})</span>
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
      <div className="space-y-6 max-w-md mx-auto kiosk-wide-md">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

        {existingVehicles.length >= property.max_vehicles && (
          <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground">
            This property allows a maximum of {property.max_vehicles} vehicle{property.max_vehicles !== 1 ? "s" : ""}.
          </div>
        )}

        <Button
          className="w-full"
          disabled={savingDriver || !newDriver.driver_name.trim() || !newDriver.license_plate.trim() || existingVehicles.length >= property.max_vehicles}
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

  // --- Delivery view ---
  if (view === "delivery") {
    // Success screen
    if (deliverySubmitted) {
      return (
        <div className="space-y-6 max-w-md mx-auto kiosk-wide-md">
          <div className="text-center space-y-6 py-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Registration Submitted</h2>
              <p className="text-muted-foreground">
                Your {deliveryCategory === "rideshare" ? "rideshare" : "delivery"} from{" "}
                <span className="font-medium">{getProviderLabel()}</span> on{" "}
                <span className="font-medium">{formatDate(arrivalDate)}</span> has
                been registered with the community.
              </p>
            </div>
            <div className="space-y-3">
              <Button onClick={resetDeliveryForm} variant="outline" className="w-full">
                Register Another
              </Button>
              <Button onClick={() => { resetDeliveryForm(); setView("menu"); }} className="w-full">
                Back to Manage Stay
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-md mx-auto kiosk-wide-md">
        {deliveryStep === 1 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { resetDeliveryForm(); setView("menu"); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDeliveryStep(deliveryStep - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {deliveryStep === 1 && "What type of registration?"}
            {deliveryStep === 2 && (deliveryCategory === "rideshare" ? "Select ride service" : deliveryCategory === "food_grocery" ? "Select delivery service" : "Other details")}
            {deliveryStep === 3 && "Details"}
            {deliveryStep === 4 && "Confirm & Submit"}
          </h1>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${s <= deliveryStep ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Category selection */}
        {deliveryStep === 1 && (
          <div className="grid gap-4">
            {[
              { id: "rideshare" as DeliveryCategory, label: "Ride Share", description: "Uber, Lyft, Taxi", icon: Car },
              { id: "food_grocery" as DeliveryCategory, label: "Food / Grocery Delivery", description: "DoorDash, Walmart, and more", icon: ShoppingBag },
              { id: "other" as DeliveryCategory, label: "Other", description: "Any other delivery or service", icon: Package },
            ].map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer transition-all hover:border-primary ${deliveryCategory === item.id ? "border-primary ring-2 ring-primary/20" : ""}`}
                onClick={() => { setDeliveryCategory(item.id); setDeliveryProvider(null); setDeliveryStep(2); }}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-xl bg-primary/10 p-4">
                    <item.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 2: Provider selection */}
        {deliveryStep === 2 && deliveryCategory === "rideshare" && (
          <div className="grid gap-4">
            {RIDESHARE_PROVIDERS.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:border-primary ${deliveryProvider === p.id ? "border-primary ring-2 ring-primary/20" : ""}`}
                onClick={() => { setDeliveryProvider(p.id); setDeliveryStep(3); }}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-xl bg-muted p-2 w-16 h-16 flex items-center justify-center overflow-hidden">
                    {BRAND_LOGOS[p.id] ? (
                      <img src={BRAND_LOGOS[p.id]} alt={p.name} className="w-12 h-12 object-contain" />
                    ) : (
                      <Car className="h-8 w-8 text-yellow-500" />
                    )}
                  </div>
                  <p className="font-semibold text-lg">{p.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {deliveryStep === 2 && deliveryCategory === "food_grocery" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FOOD_PROVIDERS.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:border-primary ${deliveryProvider === p.id ? "border-primary ring-2 ring-primary/20" : ""}`}
                onClick={() => { setDeliveryProvider(p.id); setDeliveryStep(3); }}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                  <div className="rounded-xl bg-muted p-2 w-14 h-14 flex items-center justify-center overflow-hidden">
                    <FoodProviderIcon id={p.id} name={p.name} />
                  </div>
                  <p className="font-medium text-sm text-center">{p.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {deliveryStep === 2 && deliveryCategory === "other" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="other-provider">Service name</Label>
                <Input id="other-provider" placeholder="e.g. Amazon, FedEx..." value={deliveryProvider || ""} onChange={(e) => setDeliveryProvider(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="other-notes">Notes (optional)</Label>
                <Textarea id="other-notes" placeholder="Any details about the delivery..." value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
              </div>
              <Button className="w-full" disabled={!deliveryProvider?.trim()} onClick={() => setDeliveryStep(3)}>
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Details */}
        {deliveryStep === 3 && deliveryCategory === "rideshare" && reservation && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label>How many cars?</Label>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => setNumCars(Math.max(1, numCars - 1))} disabled={numCars <= 1}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-2xl font-bold w-8 text-center">{numCars}</span>
                  <Button variant="outline" size="icon" onClick={() => setNumCars(numCars + 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickup-date">Pickup date</Label>
                <Input id="pickup-date" type="date" value={arrivalDate} min={reservation.check_in_date} max={reservation.check_out_date} onChange={(e) => setArrivalDate(e.target.value)} />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Will they also drop off?</Label>
                  <Button variant={hasReturn ? "default" : "outline"} size="sm" onClick={() => setHasReturn(!hasReturn)}>
                    {hasReturn ? "Yes" : "No"}
                  </Button>
                </div>
                {hasReturn && (
                  <>
                    <div className="space-y-2">
                      <Label>How many cars for drop-off?</Label>
                      <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => setReturnCars(Math.max(1, returnCars - 1))} disabled={returnCars <= 1}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-2xl font-bold w-8 text-center">{returnCars}</span>
                        <Button variant="outline" size="icon" onClick={() => setReturnCars(returnCars + 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return-date">Drop-off date</Label>
                      <Input id="return-date" type="date" value={returnDate} min={arrivalDate || reservation.check_in_date} max={reservation.check_out_date} onChange={(e) => setReturnDate(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
              <Button className="w-full" disabled={!arrivalDate || (hasReturn && !returnDate)} onClick={() => setDeliveryStep(4)}>
                Review & Submit
              </Button>
            </CardContent>
          </Card>
        )}

        {deliveryStep === 3 && (deliveryCategory === "food_grocery" || deliveryCategory === "other") && reservation && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="delivery-date">Expected delivery date</Label>
                <Input id="delivery-date" type="date" value={arrivalDate} min={reservation.check_in_date} max={reservation.check_out_date} onChange={(e) => setArrivalDate(e.target.value)} />
              </div>
              {deliveryCategory === "food_grocery" && (
                <div className="space-y-2">
                  <Label htmlFor="food-notes">Notes (optional)</Label>
                  <Textarea id="food-notes" placeholder="Any special instructions..." value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
                </div>
              )}
              <Button className="w-full" disabled={!arrivalDate} onClick={() => setDeliveryStep(4)}>
                Review & Submit
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirmation */}
        {deliveryStep === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registration Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {deliveryCategory === "rideshare" ? "Ride Share" : deliveryCategory === "food_grocery" ? "Food / Grocery Delivery" : "Other"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{getProviderLabel()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{deliveryCategory === "rideshare" ? "Pickup date" : "Delivery date"}</span>
                  <span className="font-medium">{formatDate(arrivalDate)}</span>
                </div>
                {deliveryCategory === "rideshare" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cars</span>
                    <span className="font-medium">{numCars}</span>
                  </div>
                )}
                {hasReturn && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Drop-off</span>
                    <span className="font-medium">{returnCars} car{returnCars !== 1 ? "s" : ""} on {formatDate(returnDate)}</span>
                  </div>
                )}
                {deliveryNotes && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Notes</span>
                    <span className="font-medium">{deliveryNotes}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {deliveryError && <p className="text-sm text-destructive text-center">{deliveryError}</p>}

            <Button className="w-full" size="lg" disabled={submittingDelivery} onClick={handleDeliverySubmit}>
              {submittingDelivery ? "Submitting..." : "Submit Registration"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // --- Menu screen ---
  return (
    <div className="space-y-6 max-w-2xl mx-auto kiosk-wide-md">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Manage Your Stay</h1>
        <p className="text-muted-foreground text-sm">
          What would you like to do?
        </p>
      </div>

      {petSaved && (
        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
          <Check className="h-4 w-4" /> Pet added successfully — updated form sent to HOA
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setView("add-guest")}>
          <CardContent className="flex flex-col items-center text-center gap-3 p-4 sm:p-5">
            <div className="rounded-full bg-primary/10 p-3">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Add a Guest</CardTitle>
              <CardDescription className="text-xs mt-1 hidden sm:block">Register a new guest</CardDescription>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setView("add-driver")}>
          <CardContent className="flex flex-col items-center text-center gap-3 p-4 sm:p-5">
            <div className="rounded-full bg-primary/10 p-3">
              <Car className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Add a Driver</CardTitle>
              <CardDescription className="text-xs mt-1 hidden sm:block">Register a vehicle</CardDescription>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setView("add-pet")}>
          <CardContent className="flex flex-col items-center text-center gap-3 p-4 sm:p-5">
            <div className="rounded-full bg-primary/10 p-3">
              <PawPrint className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Add a Pet</CardTitle>
              <CardDescription className="text-xs mt-1 hidden sm:block">{petFeeCents > 0 && existingPets.length >= lodgifyNumPets ? `$${(petFeeCents / 100).toFixed(petFeeCents % 100 === 0 ? 0 : 2)} fee` : "Register a pet"}</CardDescription>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => { resetDeliveryForm(); setView("delivery"); }}>
          <CardContent className="flex flex-col items-center text-center gap-3 p-4 sm:p-5">
            <div className="rounded-full bg-primary/10 p-3">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold leading-tight">Delivery / Rideshare</CardTitle>
              <CardDescription className="text-xs mt-1 hidden sm:block">Register an arrival</CardDescription>
            </div>
          </CardContent>
        </Card>

        <Link href={`/p/${property.slug}/add-ons`} className="md:col-span-1">
          <Card className="cursor-pointer hover:bg-accent transition-colors h-full">
            <CardContent className="flex flex-col items-center text-center gap-3 p-4 sm:p-5">
              <div className="rounded-full bg-primary/10 p-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Browse Upgrades</CardTitle>
                <CardDescription className="text-xs mt-1 hidden sm:block">Extras and experiences</CardDescription>
              </div>
            </CardContent>
          </Card>
        </Link>

        {canExtend === false ? (
          <div className="md:col-span-1" aria-disabled="true">
            <Card className="h-full opacity-50 cursor-not-allowed">
              <CardContent className="flex flex-col items-center text-center gap-3 p-4 sm:p-5">
                <div className="rounded-full bg-muted p-3">
                  <CalendarPlus className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Extend Your Stay</CardTitle>
                  <CardDescription className="text-xs mt-1 hidden sm:block">No nights available</CardDescription>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Link href={`/p/${property.slug}/extend-stay`} className="md:col-span-1">
            <Card className="cursor-pointer hover:bg-accent transition-colors h-full">
              <CardContent className="flex flex-col items-center text-center gap-3 p-4 sm:p-5">
                <div className="rounded-full bg-primary/10 p-3">
                  <CalendarPlus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Extend Your Stay</CardTitle>
                  <CardDescription className="text-xs mt-1 hidden sm:block">Add extra nights</CardDescription>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}
