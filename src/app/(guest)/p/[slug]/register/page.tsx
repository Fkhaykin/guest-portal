"use client";

import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useProperty } from "@/hooks/use-property";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Car, ChevronRight, ChevronLeft, Check, User, Mail, Users, PawPrint, Upload, FileCheck, ShoppingCart, Sparkles, X, PenLine, Undo2, Clock } from "lucide-react";

type AgeGroup = "over_21" | "under_21" | "infant";

type GuestEntry = {
  first_name: string;
  last_name: string;
  age_group: AgeGroup;
};

type PetEntry = {
  name: string;
  kind: string;
  rabies_doc_path: string | null;
  rabies_doc_name: string | null;
  vaccination_doc_path: string | null;
  vaccination_doc_name: string | null;
};

type UpsellOption = {
  type: string;
  group: string;
  label: string;
  description: string;
  price_cents: number;
  image?: string;
  available: boolean;
  unavailable_reason?: string | null;
  purchased?: boolean;
  meta?: {
    dates?: string[];
    num_guests?: number;
    per_guest_cost?: number;
    per_guest_per_day_cost?: number;
    vendor_url?: string;
    menu_options?: Array<{
      menu: string;
      ingredient_cost_per_guest: number;
      total_ingredient_cost: number;
      total_price: number;
    }>;
  };
};

type CartItem = {
  type: string;
  label: string;
  price_cents: number;
  meta?: Record<string, unknown>;
};

type PurchasedUpsell = {
  type: string;
  label: string;
  price_cents: number;
  status: string;
};

type Vehicle = {
  make: string;
  model: string;
  color: string;
  license_plate: string;
  state_or_region: string;
  year: string;
  driver_name: string;
};

type SessionData = {
  guestName: string;
  reservation: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    num_guests: number;
    property: {
      slug: string;
    };
  };
};

function splitName(fullName: string): GuestEntry {
  const parts = fullName.trim().split(/\s+/);
  const first_name = parts[0] || "";
  const last_name = parts.slice(1).join(" ") || "";
  return { first_name, last_name, age_group: "over_21" as AgeGroup };
}

const SESSION_KEY = "guest-portal-session";
const REG_KEY = "guest-portal-registration";
const STRIPE_BACKUP_SESSION = "guest-portal-stripe-session";
const STRIPE_BACKUP_REG = "guest-portal-stripe-reg";

function loadSession(): SessionData | null {
  try {
    let raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      // Restore from localStorage backup after Stripe redirect
      const backup = localStorage.getItem(STRIPE_BACKUP_SESSION);
      if (backup) {
        sessionStorage.setItem(SESSION_KEY, backup);
        localStorage.removeItem(STRIPE_BACKUP_SESSION);
        raw = backup;
      }
    }
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveRegistrationProgress(data: {
  step: number;
  fullName: string;
  email: string;
  phone: string;
  address: { street1: string; street2: string; city: string; state: string; zip: string; country: string };
  guests: GuestEntry[];
  hasPets: boolean;
  pets: PetEntry[];
  notes: string;
  vehicles: Vehicle[];
}) {
  try {
    sessionStorage.setItem(REG_KEY, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

function loadRegistrationProgress() {
  try {
    let raw = sessionStorage.getItem(REG_KEY);
    if (!raw) {
      // Restore from localStorage backup after Stripe redirect
      const backup = localStorage.getItem(STRIPE_BACKUP_REG);
      if (backup) {
        sessionStorage.setItem(REG_KEY, backup);
        localStorage.removeItem(STRIPE_BACKUP_REG);
        raw = backup;
      }
    }
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Save session + registration data to localStorage before Stripe redirect */
function backupForStripeRedirect() {
  try {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session) localStorage.setItem(STRIPE_BACKUP_SESSION, session);
    const reg = sessionStorage.getItem(REG_KEY);
    if (reg) localStorage.setItem(STRIPE_BACKUP_REG, reg);
  } catch {
    // Ignore
  }
}

export default function RegisterPage() {
  const property = useProperty();
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  // Step 2 fields
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState({ street1: "", street2: "", city: "", state: "", zip: "", country: "US" });
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [hasPets, setHasPets] = useState(false);
  const [pets, setPets] = useState<PetEntry[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showGuestCountWarning, setShowGuestCountWarning] = useState(false);

  // Upsells
  const [upsellOptions, setUpsellOptions] = useState<UpsellOption[]>([]);
  const [upsellsLoading, setUpsellsLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [purchasedUpsells, setPurchasedUpsells] = useState<PurchasedUpsell[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [chefDate, setChefDate] = useState("");
  const [chefMenu, setChefMenu] = useState("");
  const [picnicDate, setPicnicDate] = useState("");
  const [breakfastDays, setBreakfastDays] = useState<Array<{ date: string; servings: number; time: string }>>([]);
  const [tips, setTips] = useState({ breakfast: "", delivery: "", cleaning: "" });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // ID upload (front + back)
  const [idFrontPath, setIdFrontPath] = useState<string | null>(null);
  const [idFrontName, setIdFrontName] = useState<string | null>(null);
  const [idBackPath, setIdBackPath] = useState<string | null>(null);
  const [idBackName, setIdBackName] = useState<string | null>(null);
  const [uploadingIdSide, setUploadingIdSide] = useState<string | null>(null);

  // Signature
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawing = useRef(false);
  const sigHasBackground = useRef(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.push("/");
      return;
    }
    setSession(s);

    // Restore progress if any
    const progress = loadRegistrationProgress();
    if (progress) {
      setStep(Math.min(progress.step || 1, 7));
      setFullName(progress.fullName || s.guestName);
      setEmail(progress.email || "");
      setPhone(progress.phone || "");
      setAddress(progress.address || { street1: "", street2: "", city: "", state: "", zip: "", country: "US" });
      setGuests(progress.guests || [splitName(s.guestName)]);
      setHasPets(progress.hasPets || false);
      setPets(progress.pets || []);
      setNotes(progress.notes || "");
      setVehicles(progress.vehicles || []);
    } else {
      setFullName(s.guestName);
      // Pre-populate guest list with the primary guest
      setGuests([splitName(s.guestName)]);
    }

    setLoaded(true);
  }, [router]);

  // Persist progress on changes
  useEffect(() => {
    if (!loaded) return;
    saveRegistrationProgress({ step, fullName, email, phone, address, guests, hasPets, pets, notes, vehicles });
  }, [step, fullName, email, phone, address, guests, hasPets, pets, notes, vehicles, loaded]);

  // Load upsells when entering step 6
  async function loadUpsells() {
    if (!session) return;
    setUpsellsLoading(true);
    try {
      const res = await fetch("/api/guest/upsells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: session.reservation.id,
          num_pets: hasPets ? pets.filter((p) => p.name.trim()).length : 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const options = data.upsells || [];
        setUpsellOptions(options);
        setPurchasedUpsells(data.purchased || []);
        // Auto-add required fees (pet fee) to cart, or remove if no longer needed
        const petFee = options.find((o: UpsellOption) => o.type === "pet_fee" && o.available && !o.purchased);
        if (petFee) {
          setCart((prev) => {
            const without = prev.filter((c) => c.type !== "pet_fee");
            return [...without, { type: "pet_fee", label: petFee.label, price_cents: petFee.price_cents }];
          });
        } else {
          setCart((prev) => prev.filter((c) => c.type !== "pet_fee"));
        }
      }
    } catch {
      // Non-critical
    } finally {
      setUpsellsLoading(false);
    }
  }

  // Handle Stripe return
  useEffect(() => {
    if (!loaded || !session) return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("upsell_success");
    const sessionId = params.get("session_id");
    if (success && sessionId) {
      // Confirm the payment
      fetch("/api/guest/upsells/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, registration_id: session.reservation.id }),
      }).then((res) => {
        if (res.ok) {
          setCart([]);
          setStep(7);
        }
      });
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    const cancelled = params.get("upsell_cancelled");
    if (cancelled) {
      setStep(6);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loaded, session]);

  function addToCart(item: CartItem) {
    if (cart.some((c) => c.type === item.type)) return;
    setCart([...cart, item]);
  }

  function removeFromCart(type: string) {
    if (type === "pet_fee") return; // Pet fee is required and cannot be removed
    setCart(cart.filter((c) => c.type !== type));
  }

  async function handleUpsellCheckout() {
    if (!session || cart.length === 0) return;
    setCheckingOut(true);
    try {
      const res = await fetch("/api/guest/upsells/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: session.reservation.id,
          items: cart,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          backupForStripeRedirect();
          window.location.href = data.url;
        }
      }
    } catch {
      // Handle error
    } finally {
      setCheckingOut(false);
    }
  }

  function formatCents(cents: number) {
    return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  }

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setNameError("Please enter your full name.");
      return;
    }
    if (!email.trim()) return;
    setNameError(null);
    setStep(2);
  }

  async function handlePetDocUpload(petIndex: number, docType: "rabies" | "vaccination", file: File) {
    if (!session) return;
    const key = `${petIndex}-${docType}`;
    setUploadingDoc(key);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("registration_id", session.reservation.id);
    formData.append("pet_index", String(petIndex));
    formData.append("doc_type", docType);

    try {
      const res = await fetch("/api/guest/upload-pet-doc", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const updated = [...pets];
        if (docType === "rabies") {
          updated[petIndex] = {
            ...updated[petIndex],
            rabies_doc_path: data.path,
            rabies_doc_name: file.name,
          };
        } else {
          updated[petIndex] = {
            ...updated[petIndex],
            vaccination_doc_path: data.path,
            vaccination_doc_name: file.name,
          };
        }
        setPets(updated);
      }
    } catch {
      // Handle error silently
    } finally {
      setUploadingDoc(null);
    }
  }

  async function handleIdUpload(side: "front" | "back", file: File) {
    if (!session) return;
    setUploadingIdSide(side);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("registration_id", session.reservation.id);
    formData.append("side", side);

    try {
      const res = await fetch("/api/guest/upload-id", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (side === "front") {
          setIdFrontPath(data.path);
          setIdFrontName(file.name);
        } else {
          setIdBackPath(data.path);
          setIdBackName(file.name);
        }
      }
    } catch {
      // Handle error silently
    } finally {
      setUploadingIdSide(null);
    }
  }

  function addVehicle() {
    setVehicles([
      ...vehicles,
      { make: "", model: "", color: "", license_plate: "", state_or_region: "", year: "", driver_name: "" },
    ]);
  }

  function removeVehicle(index: number) {
    setVehicles(vehicles.filter((_, i) => i !== index));
  }

  function updateVehicle(index: number, field: keyof Vehicle, value: string) {
    const updated = [...vehicles];
    updated[index] = { ...updated[index], [field]: value };
    setVehicles(updated);
  }

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSaving(true);

    try {
      const res = await fetch("/api/guest/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: session.reservation.id,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          address: {
            street1: address.street1.trim(),
            street2: address.street2.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            zip: address.zip.trim(),
            country: address.country.trim(),
          },
          guests: guests.filter((g) => g.first_name.trim() && g.last_name.trim()),
          pets: hasPets ? pets.filter((p) => p.name.trim()) : [],
          notes: notes.trim() || null,
          tips: {
            breakfast: tips.breakfast ? parseInt(tips.breakfast) * 100 : 0,
            delivery: tips.delivery ? parseInt(tips.delivery) * 100 : 0,
            cleaning: tips.cleaning ? parseInt(tips.cleaning) * 100 : 0,
          },
          vehicles: vehicles.filter((v) => v.license_plate.trim()),
          signature: signatureDataUrl,
        }),
      });

      if (res.ok) {
        setSaved(true);
        try {
          sessionStorage.removeItem(REG_KEY);
        } catch {
          // Ignore
        }
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Registration submit error:", err);
      alert(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;
  if (!session) return null;

  // --- Success state ---
  if (saved) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">Registration Complete!</h2>
          <p className="text-muted-foreground">
            Thanks, {fullName.split(" ")[0]}! Your guest registration has been
            submitted. We&apos;ll have everything ready for your arrival.
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() => router.push("/")}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const totalSteps = 7;
  const stepLabels: Record<number, string> = {
    1: "Your Details",
    2: "Contact Info",
    3: "Guest List",
    4: "Pets",
    5: "Vehicles",
    6: "Extras & Tips",
    7: "Review & Submit",
  };

  const configTypes = new Set(["private_chef", "luxury_picnic", "breakfast_delivery"]);
  function hasConfig(type: string) { return configTypes.has(type); }

  const emptyPet = (): PetEntry => ({
    name: "", kind: "",
    rabies_doc_path: null, rabies_doc_name: null,
    vaccination_doc_path: null, vaccination_doc_name: null,
  });

  function navButtons(back: number, opts?: { submit?: boolean }) {
    return (
      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" onClick={() => setStep(back)}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {opts?.submit ? (
          <Button type="submit" size="lg" className="flex-1" disabled={saving}>
            {saving ? "Submitting..." : "Submit Registration"}
          </Button>
        ) : (
          <Button type="submit" size="lg" className="flex-1">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step} of {totalSteps}</span>
          <span>{stepLabels[step]}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Identity */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Verify Your Identity
              </CardTitle>
              <CardDescription>
                Confirm your name as it appears on your booking and provide
                an email address for portal access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setNameError(null); }}
                  placeholder="As shown on your booking"
                  required
                />
                {nameError && <p className="text-sm text-destructive">{nameError}</p>}
                <p className="text-xs text-muted-foreground">
                  Enter your full legal name as it appears on your ID.
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email Address
                </Label>
                <Input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                />
                <p className="text-xs text-muted-foreground">
                  You&apos;ll use this email to access the guest portal and receive updates about your stay.
                </p>
              </div>
            </CardContent>
          </Card>
          <Button type="submit" size="lg" className="w-full">
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </form>
      )}

      {/* Step 2: Contact */}
      {step === 2 && (
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!idFrontPath || !idBackPath) return;
          setStep(3);
        }} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                How can we reach you before and during your stay?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone" type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000" required
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll use this to reach you with check-in details and during your stay.
                </p>
              </div>
              <Separator />
              <p className="text-sm font-medium">Mailing Address</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="street1" className="text-xs">Street Address</Label>
                  <Input id="street1" value={address.street1}
                    onChange={(e) => setAddress({ ...address, street1: e.target.value })}
                    placeholder="123 Main St" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="street2" className="text-xs">Street Address 2 (optional)</Label>
                  <Input id="street2" value={address.street2}
                    onChange={(e) => setAddress({ ...address, street2: e.target.value })}
                    placeholder="Apt 4B" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="city" className="text-xs">City</Label>
                    <Input id="city" value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      placeholder="New York" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="addrState" className="text-xs">State / Province</Label>
                    <Input id="addrState" value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      placeholder="NY" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="zip" className="text-xs">ZIP / Postal Code</Label>
                    <Input id="zip" value={address.zip}
                      onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                      placeholder="10001" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="country" className="text-xs">Country</Label>
                    <Input id="country" value={address.country}
                      onChange={(e) => setAddress({ ...address, country: e.target.value })}
                      placeholder="US" required />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Government-Issued ID
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload photos of the front and back of your driver&apos;s license, passport, or other government-issued ID.
                </p>
                <div className="grid grid-cols-2 gap-3">
                {/* Front of ID */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Front of ID</p>
                  {idFrontPath ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                      <FileCheck className="h-5 w-5 text-green-600 shrink-0" />
                      <span className="text-sm truncate flex-1">{idFrontName}</span>
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={() => { setIdFrontPath(null); setIdFrontName(null); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {uploadingIdSide === "front" ? "Uploading..." : "Tap to upload front of ID"}
                      </span>
                      <input
                        type="file" className="hidden"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={uploadingIdSide === "front"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleIdUpload("front", file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                {/* Back of ID */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Back of ID</p>
                  {idBackPath ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                      <FileCheck className="h-5 w-5 text-green-600 shrink-0" />
                      <span className="text-sm truncate flex-1">{idBackName}</span>
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={() => { setIdBackPath(null); setIdBackName(null); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {uploadingIdSide === "back" ? "Uploading..." : "Tap to upload back of ID"}
                      </span>
                      <input
                        type="file" className="hidden"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        disabled={uploadingIdSide === "back"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleIdUpload("back", file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {(!idFrontPath || !idBackPath) && (
            <p className="text-sm text-destructive text-center">
              Please upload both sides of your ID to continue.
            </p>
          )}
          {navButtons(1)}
        </form>
      )}

      {/* Step 3: Guest List */}
      {step === 3 && (
        <form onSubmit={(e) => {
          e.preventDefault();
          const expected = session?.reservation.num_guests || 0;
          if (guests.length < expected && !showGuestCountWarning) {
            setShowGuestCountWarning(true);
            return;
          }
          setShowGuestCountWarning(false);
          setStep(4);
        }} className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Guest List
                </CardTitle>
                <CardDescription>
                  List everyone staying at the property, including yourself
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => { setGuests([...guests, { first_name: "", last_name: "", age_group: "over_21" as AgeGroup }]); setShowGuestCountWarning(false); }}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Primary guest (read-only) */}
              {guests.length > 0 && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Primary Guest (you)</div>
                  <p className="font-medium">
                    {guests[0].first_name && guests[0].last_name
                      ? `${guests[0].first_name} ${guests[0].last_name}`
                      : fullName}
                  </p>
                </div>
              )}

              {/* Additional guests */}
              {guests.slice(1).map((guest, i) => {
                const index = i + 1;
                return (
                  <div key={index}>
                    <Separator className="mb-3" />
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          Guest {index + 1}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={guest.first_name} placeholder="First name" required
                            onChange={(e) => {
                              const u = [...guests]; u[index] = { ...u[index], first_name: e.target.value }; setGuests(u);
                            }} />
                          <Input value={guest.last_name} placeholder="Last name" required
                            onChange={(e) => {
                              const u = [...guests]; u[index] = { ...u[index], last_name: e.target.value }; setGuests(u);
                            }} />
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {(["over_21", "under_21", "infant"] as AgeGroup[]).map((val) => (
                            <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name={`age-group-${index}`} value={val}
                                checked={guest.age_group === val}
                                onChange={() => {
                                  const u = [...guests]; u[index] = { ...u[index], age_group: val }; setGuests(u);
                                }} />
                              <span className="text-muted-foreground">
                                {val === "over_21" ? "Over 21" : val === "under_21" ? "Under 21" : "Infant"}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {(() => {
                        const gName = `${guest.first_name} ${guest.last_name}`.trim();
                        const isDriver = vehicles.some(v => v.driver_name === gName);
                        return (
                          <Button type="button" variant="ghost" size="icon" className="shrink-0 mt-6"
                            disabled={isDriver}
                            title={isDriver ? "Remove this guest as a vehicle driver first" : undefined}
                            onClick={() => setGuests(guests.filter((_, j) => j !== index))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              {guests.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Add at least one guest.</p>
              )}
              <p className="text-xs text-muted-foreground pt-2">
                {guests.length} guest{guests.length !== 1 ? "s" : ""} listed
              </p>
            </CardContent>
          </Card>

          {showGuestCountWarning && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                Your booking is for {session?.reservation.num_guests} guest{(session?.reservation.num_guests || 0) !== 1 ? "s" : ""}, but you&apos;ve only listed {guests.length}.
              </p>
              <p className="text-sm text-amber-800">
                Are you sure you want to continue? All guests staying at the property must be registered.
              </p>
              <p className="text-xs text-amber-700">
                Click &ldquo;Next&rdquo; again to proceed, or add the remaining guests above.
              </p>
            </div>
          )}

          {navButtons(2)}
        </form>
      )}

      {/* Step 4: Pets */}
      {step === 4 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(5); }} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PawPrint className="h-5 w-5" /> Pets
              </CardTitle>
              <CardDescription>
                Are you bringing any pets to the property?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button type="button" size="sm"
                  variant={hasPets ? "default" : "outline"}
                  onClick={() => { setHasPets(true); if (pets.length === 0) setPets([emptyPet()]); }}>
                  Yes
                </Button>
                <Button type="button" size="sm"
                  variant={!hasPets ? "default" : "outline"}
                  onClick={() => { setHasPets(false); setPets([]); }}>
                  No
                </Button>
              </div>

              {hasPets && (
                <div className="space-y-4 pt-2">
                  {pets.map((pet, index) => (
                    <div key={index}>
                      {index > 0 && <Separator className="mb-4" />}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Pet {index + 1}</span>
                          {index > 0 && (
                            <Button type="button" variant="ghost" size="icon"
                              onClick={() => setPets(pets.filter((_, i) => i !== index))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Pet Name *</Label>
                            <Input value={pet.name} placeholder="Buddy" required
                              onChange={(e) => {
                                const u = [...pets]; u[index] = { ...u[index], name: e.target.value }; setPets(u);
                              }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Type / Breed *</Label>
                            <Input value={pet.kind} placeholder="Golden Retriever" required
                              onChange={(e) => {
                                const u = [...pets]; u[index] = { ...u[index], kind: e.target.value }; setPets(u);
                              }} />
                          </div>
                        </div>

                        {/* Rabies Certificate */}
                        <div className="space-y-1">
                          <Label className="text-xs">Rabies Certificate *</Label>
                          {pet.rabies_doc_name ? (
                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-2">
                              <FileCheck className="h-4 w-4 shrink-0" />
                              <span className="truncate">{pet.rabies_doc_name}</span>
                              <Button type="button" variant="ghost" size="sm"
                                className="ml-auto h-auto p-1 text-muted-foreground"
                                onClick={() => {
                                  const u = [...pets]; u[index] = { ...u[index], rabies_doc_path: null, rabies_doc_name: null }; setPets(u);
                                }}>
                                Replace
                              </Button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed p-3 hover:bg-accent transition-colors">
                              <Upload className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {uploadingDoc === `${index}-rabies` ? "Uploading..." : "Upload PDF or image"}
                              </span>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                                disabled={uploadingDoc !== null}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handlePetDocUpload(index, "rabies", f);
                                  e.target.value = "";
                                }} />
                            </label>
                          )}
                        </div>

                        {/* Vaccination Records */}
                        <div className="space-y-1">
                          <Label className="text-xs">Vaccination Records *</Label>
                          {pet.vaccination_doc_name ? (
                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-2">
                              <FileCheck className="h-4 w-4 shrink-0" />
                              <span className="truncate">{pet.vaccination_doc_name}</span>
                              <Button type="button" variant="ghost" size="sm"
                                className="ml-auto h-auto p-1 text-muted-foreground"
                                onClick={() => {
                                  const u = [...pets]; u[index] = { ...u[index], vaccination_doc_path: null, vaccination_doc_name: null }; setPets(u);
                                }}>
                                Replace
                              </Button>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed p-3 hover:bg-accent transition-colors">
                              <Upload className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {uploadingDoc === `${index}-vaccination` ? "Uploading..." : "Upload PDF or image"}
                              </span>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                                disabled={uploadingDoc !== null}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handlePetDocUpload(index, "vaccination", f);
                                  e.target.value = "";
                                }} />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setPets([...pets, emptyPet()])}>
                    <Plus className="h-4 w-4 mr-1" /> Add Another Pet
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          {navButtons(3)}
        </form>
      )}

      {/* Step 5: Vehicles */}
      {step === 5 && (
        <form onSubmit={(e) => { e.preventDefault(); loadUpsells(); setStep(6); }} className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" /> Vehicles
                </CardTitle>
                <CardDescription>
                  Register your vehicles for community parking
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addVehicle}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                All vehicles must be registered prior to arrival. Unregistered vehicles may experience delays at the community security gate.
              </div>

              {vehicles.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    No vehicles added. Click &ldquo;Add&rdquo; to register your vehicles.
                  </p>
                </div>
              ) : (
                vehicles.map((vehicle, index) => (
                  <div key={index}>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Vehicle {index + 1}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeVehicle(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">License Plate *</Label>
                          <Input value={vehicle.license_plate} placeholder="ABC-1234" required
                            onChange={(e) => updateVehicle(index, "license_plate", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">State/Region *</Label>
                          <Input value={vehicle.state_or_region} placeholder="PA" required
                            onChange={(e) => updateVehicle(index, "state_or_region", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Make *</Label>
                          <Input value={vehicle.make} placeholder="Toyota" required
                            onChange={(e) => updateVehicle(index, "make", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Model *</Label>
                          <Input value={vehicle.model} placeholder="Camry" required
                            onChange={(e) => updateVehicle(index, "model", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Color *</Label>
                          <Input value={vehicle.color} placeholder="Silver" required
                            onChange={(e) => updateVehicle(index, "color", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Year</Label>
                          <Input value={vehicle.year} placeholder="2024"
                            onChange={(e) => updateVehicle(index, "year", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Driver Name *</Label>
                          <Select value={vehicle.driver_name} onValueChange={(v) => updateVehicle(index, "driver_name", v ?? "")} required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select driver" />
                            </SelectTrigger>
                            <SelectContent>
                              {guests.filter(g => g.first_name || g.last_name).map((g, i) => {
                                const name = `${g.first_name} ${g.last_name}`.trim();
                                return (
                                  <SelectItem key={i} value={name}>{name}</SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {navButtons(4)}
        </form>
      )}

      {/* Step 6: Upsells / Extras */}
      {step === 6 && (
        <div className="space-y-6">
          {/* Confirmed purchases */}
          {purchasedUpsells.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Check className="h-5 w-5" /> Confirmed Purchases
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {purchasedUpsells.map((u, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{u.label}</span>
                    <Badge variant="secondary" className="text-green-700 bg-green-50">
                      Paid — {formatCents(u.price_cents)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {upsellsLoading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-muted-foreground text-center">Loading available extras...</p>
              </CardContent>
            </Card>
          ) : (
            <>
            {[
              { group: "fees", title: "Required Fees", description: "Fees based on your registration details", icon: <PawPrint className="h-5 w-5" /> },
              { group: "timing", title: "Check-In & Check-Out", description: "Adjust your arrival and departure times", icon: <Clock className="h-5 w-5" /> },
              { group: "convenience", title: "Convenience", description: "Little extras to make your stay easier", icon: <Sparkles className="h-5 w-5" /> },
              { group: "experience", title: "Experiences", description: "Unforgettable moments during your stay", icon: <Sparkles className="h-5 w-5" /> },
            ].map(({ group, title, description, icon }) => {
              const groupOptions = upsellOptions.filter((o) => o.group === group && !purchasedUpsells.some((p) => p.type === o.type && p.status === "paid"));
              if (groupOptions.length === 0) return null;
              return (
                <Card key={group}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {icon} {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {groupOptions.map((option) => {
                      const inCart = cart.some((c) => c.type === option.type);

                      return (
                        <div key={option.type} className="rounded-lg border overflow-hidden">
                      <div className="flex">
                        {option.image && (
                          <div className="w-24 h-24 shrink-0">
                            <img src={option.image} alt={option.label}
                              className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 px-4 py-3 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-medium text-sm">{option.label}</p>
                              <p className="text-xs text-muted-foreground leading-snug">{option.description}</p>
                            </div>
                            {option.type !== "private_chef" && (
                              <span className="text-sm font-semibold whitespace-nowrap shrink-0">
                                {formatCents(option.price_cents)}
                                {option.meta?.per_guest_cost && (
                                  <span className="block text-xs font-normal text-muted-foreground text-right">
                                    {formatCents(option.meta.per_guest_cost)}/guest
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          {/* Inline button for simple items (no config needed) */}
                          {option.available && !hasConfig(option.type) && (
                            <div className="mt-2">
                              {option.type === "pet_fee" ? (
                                <Badge variant="secondary" className="text-xs">
                                  <Check className="h-3 w-3 mr-1" /> Added to cart (required)
                                </Badge>
                              ) : inCart ? (
                                <Button type="button" variant="outline" size="sm"
                                  onClick={() => {
                                    removeFromCart(option.type);
                                    if (option.type === "firewood") {
                                      setTips((t) => ({ ...t, delivery: "" }));
                                      setCart((prev) => prev.filter((c) => c.type !== "tip_delivery"));
                                    }
                                  }}>
                                  <X className="h-3 w-3 mr-1" /> Remove
                                </Button>
                              ) : (
                                <Button type="button" variant="secondary" size="sm"
                                  className="hover:bg-primary hover:text-primary-foreground transition-colors"
                                  onClick={() => addToCart({ type: option.type, label: option.label, price_cents: option.price_cents })}>
                                  <ShoppingCart className="h-3 w-3 mr-1" /> Add to cart
                                </Button>
                              )}
                            </div>
                          )}
                          {!option.available && option.unavailable_reason && (
                            <p className="text-xs text-amber-600 mt-2">{option.unavailable_reason}</p>
                          )}
                        </div>
                      </div>

                      {/* Firewood delivery tip */}
                      {option.type === "firewood" && inCart && (
                        <div className="px-4 pb-3 pt-2 border-t">
                          <div className="space-y-2">
                            <Label className="text-xs">Add a tip for the delivery crew (optional)</Label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                type="number" min="0" step="1"
                                value={tips.delivery}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTips({ ...tips, delivery: val });
                                  const cents = parseInt(val || "0") * 100;
                                  if (cents > 0) {
                                    setCart((prev) => {
                                      const without = prev.filter((c) => c.type !== "tip_delivery");
                                      return [...without, { type: "tip_delivery", label: `Tip — Delivery Crew`, price_cents: cents }];
                                    });
                                  } else {
                                    setCart((prev) => prev.filter((c) => c.type !== "tip_delivery"));
                                  }
                                }}
                                placeholder="0"
                                className="max-w-24 h-8 text-sm"
                              />
                              {[10, 20, 30].map((amt) => (
                                <Button key={amt} type="button" variant="outline" size="sm" className={`h-8 text-xs ${tips.delivery === String(amt) ? "border-primary bg-primary/5" : ""}`}
                                  onClick={() => {
                                    setTips({ ...tips, delivery: String(amt) });
                                    setCart((prev) => {
                                      const without = prev.filter((c) => c.type !== "tip_delivery");
                                      return [...without, { type: "tip_delivery", label: `Tip — Delivery Crew`, price_cents: amt * 100 }];
                                    });
                                  }}>
                                  ${amt}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expandable config for complex items */}
                      {hasConfig(option.type) && (
                      <div className="px-4 pb-4 pt-2 border-t space-y-3">

                      {/* Private chef has extra config */}
                      {option.type === "private_chef" && option.available && (
                        <div className="space-y-3 pt-1">
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Select value={chefDate} onValueChange={(v) => setChefDate(v ?? "")}>
                              <SelectTrigger><SelectValue placeholder="Select a date" /></SelectTrigger>
                              <SelectContent>
                                {(option.meta?.dates || []).map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Menu</Label>
                            <Select value={chefMenu} onValueChange={(v) => setChefMenu(v ?? "")}>
                              <SelectTrigger><SelectValue placeholder="Select a menu" /></SelectTrigger>
                              <SelectContent>
                                {(option.meta?.menu_options || []).map((m) => (
                                  <SelectItem key={m.menu} value={m.menu}>
                                    {m.menu} — {formatCents(m.total_price)} total
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {chefMenu && (
                            <div className="rounded-lg bg-muted/50 p-2 text-xs space-y-1">
                              {(() => {
                                const m = option.meta?.menu_options?.find((o) => o.menu === chefMenu);
                                if (!m) return null;
                                return (
                                  <>
                                    <div className="flex justify-between">
                                      <span>Chef fee</span><span>{formatCents(50000)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Ingredients ({option.meta?.num_guests} guests × {formatCents(m.ingredient_cost_per_guest)})</span>
                                      <span>{formatCents(m.total_ingredient_cost)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between font-semibold">
                                      <span>Total</span><span>{formatCents(m.total_price)}</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Luxury picnic date picker */}
                      {option.type === "luxury_picnic" && option.available && (
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Select value={picnicDate} onValueChange={(v) => setPicnicDate(v ?? "")}>
                            <SelectTrigger><SelectValue placeholder="Select a date" /></SelectTrigger>
                            <SelectContent>
                              {(option.meta?.dates || []).map((d) => (
                                <SelectItem key={d} value={d}>
                                  {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Breakfast delivery configurator */}
                      {option.type === "breakfast_delivery" && option.available && (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Served by <a href={option.meta?.vendor_url as string} target="_blank" rel="noopener noreferrer" className="underline text-primary">Archie&apos;s Corner</a>
                          </p>
                          {(option.meta?.dates || []).map((d) => {
                            const existing = breakfastDays.find((b) => b.date === d);
                            return (
                              <div key={d} className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                  </span>
                                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!existing}
                                      className="rounded border-input"
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setBreakfastDays([...breakfastDays, { date: d, servings: Math.max(3, option.meta?.num_guests || 3), time: "8:00 AM" }]);
                                        } else {
                                          setBreakfastDays(breakfastDays.filter((b) => b.date !== d));
                                        }
                                      }}
                                    />
                                    Order
                                  </label>
                                </div>
                                {existing && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Servings</Label>
                                      <Input
                                        type="number" min={3} max={20}
                                        value={existing.servings}
                                        onChange={(e) => {
                                          setBreakfastDays(breakfastDays.map((b) =>
                                            b.date === d ? { ...b, servings: Math.max(3, parseInt(e.target.value) || 3) } : b
                                          ));
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Delivery Time</Label>
                                      <Select
                                        value={existing.time}
                                        onValueChange={(v) => {
                                          setBreakfastDays(breakfastDays.map((b) =>
                                            b.date === d ? { ...b, time: v ?? "8:00 AM" } : b
                                          ));
                                        }}
                                      >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {["7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM"].map((t) => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {breakfastDays.length > 0 && (
                            <>
                            <div className="rounded-lg bg-muted/50 p-2 text-xs space-y-1">
                              <div className="flex justify-between">
                                <span>Total servings</span>
                                <span>{breakfastDays.reduce((s, b) => s + b.servings, 0)} across {breakfastDays.length} day{breakfastDays.length !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Delivery fee</span>
                                <span>{formatCents(breakfastDays.length * 500)}</span>
                              </div>
                              <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{formatCents(breakfastDays.reduce((s, b) => s + b.servings * (option.meta?.per_guest_per_day_cost as number || 1500), 0) + breakfastDays.length * 500)}</span>
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <Label className="text-xs">Add a tip for the breakfast crew (optional)</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">$</span>
                                <Input
                                  type="number" min="0" step="1"
                                  value={tips.breakfast}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTips({ ...tips, breakfast: val });
                                    const cents = parseInt(val || "0") * 100;
                                    if (cents > 0) {
                                      setCart((prev) => {
                                        const without = prev.filter((c) => c.type !== "tip_breakfast");
                                        return [...without, { type: "tip_breakfast", label: "Tip — Breakfast Crew", price_cents: cents }];
                                      });
                                    } else {
                                      setCart((prev) => prev.filter((c) => c.type !== "tip_breakfast"));
                                    }
                                  }}
                                  placeholder="0"
                                  className="max-w-24 h-8 text-sm"
                                />
                                {[10, 20, 30].map((amt) => (
                                  <Button key={amt} type="button" variant="outline" size="sm" className={`h-8 text-xs ${tips.breakfast === String(amt) ? "border-primary bg-primary/5" : ""}`}
                                    onClick={() => {
                                      setTips({ ...tips, breakfast: String(amt) });
                                      setCart((prev) => {
                                        const without = prev.filter((c) => c.type !== "tip_breakfast");
                                        return [...without, { type: "tip_breakfast", label: "Tip — Breakfast Crew", price_cents: amt * 100 }];
                                      });
                                    }}>
                                    ${amt}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Add to cart for config items */}
                      {option.available && hasConfig(option.type) && (
                        <div>
                          {inCart ? (
                            <Button type="button" variant="outline" size="sm"
                              onClick={() => {
                                removeFromCart(option.type);
                                if (option.type === "private_chef") { setChefDate(""); setChefMenu(""); }
                                if (option.type === "luxury_picnic") { setPicnicDate(""); }
                                if (option.type === "breakfast_delivery") { setBreakfastDays([]); setTips((t) => ({ ...t, breakfast: "" })); setCart((prev) => prev.filter((c) => c.type !== "tip_breakfast")); }
                              }}>
                              <X className="h-3 w-3 mr-1" /> Remove from cart
                            </Button>
                          ) : (
                            <Button type="button" variant="secondary" size="sm"
                              className="hover:bg-primary hover:text-primary-foreground transition-colors"
                              disabled={
                                (option.type === "private_chef" && (!chefDate || !chefMenu)) ||
                                (option.type === "luxury_picnic" && !picnicDate) ||
                                (option.type === "breakfast_delivery" && breakfastDays.length === 0)
                              }
                              onClick={() => {
                                if (option.type === "private_chef") {
                                  const m = option.meta?.menu_options?.find((o) => o.menu === chefMenu);
                                  if (!m) return;
                                  addToCart({
                                    type: option.type,
                                    label: `Private Chef — ${chefMenu} (${new Date(chefDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
                                    price_cents: m.total_price,
                                    meta: { date: chefDate, menu: chefMenu, num_guests: option.meta?.num_guests },
                                  });
                                } else if (option.type === "luxury_picnic") {
                                  addToCart({
                                    type: option.type,
                                    label: `Luxury Picnic (${new Date(picnicDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}) — ${option.meta?.num_guests} guests`,
                                    price_cents: option.price_cents,
                                    meta: { date: picnicDate, num_guests: option.meta?.num_guests },
                                  });
                                } else if (option.type === "breakfast_delivery") {
                                  const totalServings = breakfastDays.reduce((s, b) => s + b.servings, 0);
                                  const perServing = option.meta?.per_guest_per_day_cost as number || 1500;
                                  addToCart({
                                    type: option.type,
                                    label: `Breakfast Delivery — ${totalServings} servings across ${breakfastDays.length} day${breakfastDays.length !== 1 ? "s" : ""}`,
                                    price_cents: totalServings * perServing + breakfastDays.length * 500,
                                    meta: { days: breakfastDays, tip: tips.breakfast ? parseInt(tips.breakfast) * 100 : 0 },
                                  });
                                }
                              }}>
                              <ShoppingCart className="h-3 w-3 mr-1" /> Add to cart
                            </Button>
                          )}
                        </div>
                      )}
                      </div>
                      )}
                    </div>
                  );
                    })}
                  </CardContent>
                </Card>
              );
            })}
            </>
          )}

          {/* Cleaning crew tip */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tip the Cleaning Crew</CardTitle>
              <CardDescription>
                For the team who prepares the property before your arrival and cleans up after checkout. Added to your cart.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number" min="0" step="1"
                  value={tips.cleaning}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTips({ ...tips, cleaning: val });
                    const cents = parseInt(val || "0") * 100;
                    if (cents > 0) {
                      setCart((prev) => {
                        const without = prev.filter((c) => c.type !== "tip_cleaning");
                        return [...without, { type: "tip_cleaning", label: "Tip — Cleaning Crew", price_cents: cents }];
                      });
                    } else {
                      setCart((prev) => prev.filter((c) => c.type !== "tip_cleaning"));
                    }
                  }}
                  placeholder="0"
                  className="max-w-24 h-8 text-sm"
                />
                {[20, 40, 60, 100].map((amt) => (
                  <Button key={amt} type="button" variant="outline" size="sm" className={`h-8 text-xs ${tips.cleaning === String(amt) ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => {
                      setTips({ ...tips, cleaning: String(amt) });
                      setCart((prev) => {
                        const without = prev.filter((c) => c.type !== "tip_cleaning");
                        return [...without, { type: "tip_cleaning", label: "Tip — Cleaning Crew", price_cents: amt * 100 }];
                      });
                    }}>
                    ${amt}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shopping cart */}
          {cart.length > 0 && (
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" /> Your Cart
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.map((item) => (
                  <div key={item.type} className="flex items-center justify-between text-sm">
                    <span>{item.label}{item.type === "pet_fee" && <span className="text-xs text-muted-foreground ml-1">(required)</span>}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCents(item.price_cents)}</span>
                      {item.type !== "pet_fee" && (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => removeFromCart(item.type)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCents(cart.reduce((sum, i) => sum + i.price_cents, 0))}</span>
                </div>
                <Button className="w-full" size="lg" disabled={checkingOut} onClick={handleUpsellCheckout}>
                  {checkingOut ? "Redirecting to checkout..." : "Checkout"}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(5)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button type="button" size="lg" className="flex-1"
              disabled={cart.some((c) => c.type === "pet_fee")}
              onClick={() => setStep(7)}>
              {cart.some((c) => c.type === "pet_fee") ? "Pay pet fee to continue" : cart.length > 0 ? "Skip extras" : "Next"} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 7: Special Requests + Terms + Signature + Submit */}
      {step === 7 && (
        <form onSubmit={handleFinalSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anything Else?</CardTitle>
              <CardDescription>
                Let us know if there&apos;s anything we can do to make your stay better
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Special Requests (optional)</Label>
                <Textarea
                  id="notes" value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Early check-in, extra towels, accessibility needs..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Terms &amp; Conditions</CardTitle>
              <CardDescription>
                Please read and agree to the following before submitting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="h-64 overflow-y-auto rounded-lg border p-4 text-sm text-muted-foreground space-y-3 scroll-smooth"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) {
                    setHasScrolledTerms(true);
                  }
                }}
              >
                <h4 className="font-semibold text-foreground">Summit Lakeside Rentals — Guest Agreement</h4>

                <p><strong>1. Check-In &amp; Check-Out.</strong> Check-in time is 4:00 PM and check-out time is 11:00 AM unless otherwise communicated. Early check-in and late check-out are subject to availability and must be arranged in advance.</p>

                <p><strong>2. Occupancy.</strong> The property may not be occupied by more guests than the number listed on your reservation. All guests must be registered through the guest portal. Any unregistered guests found on the property may result in immediate termination of the rental agreement without refund.</p>

                <p><strong>3. Age Requirement.</strong> The primary guest must be at least 25 years of age. All guests under 21 must be accompanied by a parent or legal guardian who is also a registered guest.</p>

                <p><strong>4. Quiet Hours.</strong> Quiet hours are from 10:00 PM to 8:00 AM. Excessive noise at any time that disturbs neighbors or other guests is grounds for immediate eviction without refund. The property is located in a residential community — please be respectful.</p>

                <p><strong>5. Pets.</strong> Pets are allowed with prior approval and a non-refundable pet fee. All pets must have current rabies vaccination and vaccination records uploaded during registration. Guests are responsible for cleaning up after their pets. Pets must not be left unattended on the property. Any damage caused by pets will be charged to the guest.</p>

                <p><strong>6. Vehicles &amp; Parking.</strong> All vehicles must be registered during the guest registration process. Parking is limited to designated areas only. Vehicles parked in unauthorized areas may be towed at the owner&apos;s expense. The community speed limit is 15 MPH.</p>

                <p><strong>7. Property Care.</strong> Guests are expected to treat the property with care. Any damage beyond normal wear and tear will be assessed and charged to the guest. Please report any issues or damage upon arrival so you are not held responsible.</p>

                <p><strong>8. Prohibited Activities.</strong> The following are strictly prohibited: smoking or vaping inside the property, illegal substances, fireworks, use of the property for commercial purposes, events or parties exceeding registered occupancy, and any activity that violates local laws or community rules.</p>

                <p><strong>9. Lake &amp; Amenities.</strong> Use of the lake, boats, hot tub, fire pit, and other amenities is at your own risk. Children must be supervised at all times near water. Life jackets are provided and must be worn by non-swimmers and children under 12.</p>

                <p><strong>10. Trash &amp; Recycling.</strong> All trash must be placed in the designated bins. Trash should be taken out before check-out. Failure to properly dispose of trash may result in an additional cleaning fee.</p>

                <p><strong>11. Liability.</strong> Summit Lakeside Rentals is not responsible for any injury, loss, or damage to personal property during your stay. By agreeing to these terms, you acknowledge and accept these risks.</p>

                <p><strong>12. Cancellation.</strong> Cancellation policies are governed by the platform through which the reservation was made (Airbnb, VRBO, direct booking). Please refer to your booking confirmation for details.</p>

                <p><strong>13. Indemnification.</strong> Guest agrees to indemnify and hold harmless Summit Lakeside Rentals, its owners, agents, and employees from any claims, damages, or expenses arising from the guest&apos;s use of the property.</p>

                <p className="pt-2 font-medium text-foreground">By checking the box below, you acknowledge that you have read, understood, and agree to abide by all terms and conditions listed above.</p>
              </div>

              <label className={`flex items-start gap-3 text-sm cursor-pointer ${!hasScrolledTerms ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  disabled={!hasScrolledTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="rounded border-input mt-0.5"
                />
                <span>
                  I have read and agree to the Terms &amp; Conditions
                  {!hasScrolledTerms && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Please scroll to the bottom of the terms to enable this checkbox
                    </span>
                  )}
                </span>
              </label>
            </CardContent>
          </Card>

          {/* Signature capture — visible after agreeing to terms */}
          {agreedToTerms && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenLine className="h-5 w-5" /> Signature
                </CardTitle>
                <CardDescription>
                  Sign below to confirm you agree to the terms above
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      // Fill white background on first stroke so exported image isn't transparent
                      if (!sigHasBackground.current) {
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        sigHasBackground.current = true;
                      }
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
                      if (!sigDrawing.current) return;
                      sigDrawing.current = false;
                      const canvas = sigCanvasRef.current;
                      if (canvas) {
                        setSignatureDataUrl(canvas.toDataURL("image/png"));
                      }
                    }}
                    onPointerLeave={() => {
                      if (!sigDrawing.current) return;
                      sigDrawing.current = false;
                      const canvas = sigCanvasRef.current;
                      if (canvas) {
                        setSignatureDataUrl(canvas.toDataURL("image/png"));
                      }
                    }}
                  />
                  {!signatureDataUrl && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-sm">
                      Draw your signature here
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const canvas = sigCanvasRef.current;
                      if (canvas) {
                        const ctx = canvas.getContext("2d");
                        ctx?.clearRect(0, 0, canvas.width, canvas.height);
                      }
                      sigHasBackground.current = false;
                      setSignatureDataUrl(null);
                    }}
                  >
                    <Undo2 className="h-4 w-4 mr-1" /> Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(6)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={saving || !agreedToTerms || !signatureDataUrl}>
              {saving ? "Submitting..." : !agreedToTerms ? "Agree to terms first" : !signatureDataUrl ? "Sign above to submit" : "Submit Registration"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
