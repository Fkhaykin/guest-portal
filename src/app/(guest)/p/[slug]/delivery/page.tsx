"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProperty } from "@/hooks/use-property";
import { getGuestToken } from "@/lib/guest-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Car,
  ShoppingBag,
  Package,
  ChevronLeft,
  Check,
  Plus,
  Minus,
  Truck,
} from "lucide-react";
const SESSION_KEY = "guest-portal-session";

type Category = "rideshare" | "food_grocery" | "other";

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

// Brand logo PNG paths (served from /public/logos/)
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

function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DeliveryPage() {
  const property = useProperty();
  const router = useRouter();
  const session = getSession();

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [numCars, setNumCars] = useState(1);
  const [arrivalDate, setArrivalDate] = useState("");
  const [hasReturn, setHasReturn] = useState(false);
  const [returnCars, setReturnCars] = useState(1);
  const [returnDate, setReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session?.reservation) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              Please find your booking first to register a delivery or rideshare.
            </p>
            <Button onClick={() => router.push("/checkin")} className="w-full">
              Find My Booking
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const reservation = session.reservation;

  function getProviderLabel() {
    if (!provider) return "Other";
    const ride = RIDESHARE_PROVIDERS.find((p) => p.id === provider);
    if (ride) return ride.name;
    const food = FOOD_PROVIDERS.find((p) => p.id === provider);
    if (food) return food.name;
    return provider;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/delivery-rideshare", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": getGuestToken() },
        body: JSON.stringify({
          registration_id: reservation.id,
          category,
          provider: getProviderLabel(),
          num_cars: category === "rideshare" ? numCars : 1,
          arrival_date: arrivalDate,
          has_return: category === "rideshare" ? hasReturn : false,
          return_cars: hasReturn ? returnCars : null,
          return_date: hasReturn ? returnDate : null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem("guest-portal-session");
          window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        const data = await res.json();
        setError(data.error || "Something went wrong");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setStep(1);
    setCategory(null);
    setProvider(null);
    setNumCars(1);
    setArrivalDate("");
    setHasReturn(false);
    setReturnCars(1);
    setReturnDate("");
    setNotes("");
    setSubmitted(false);
    setError(null);
  }

  // --- Success screen ---
  if (submitted) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Registration Submitted</h2>
            <p className="text-muted-foreground">
              Your {category === "rideshare" ? "rideshare" : "delivery"} from{" "}
              <span className="font-medium">{getProviderLabel()}</span> on{" "}
              <span className="font-medium">{formatDate(arrivalDate)}</span> has
              been registered with the community.
            </p>
          </div>
          <div className="space-y-3">
            <Button onClick={resetForm} variant="outline" className="w-full">
              Register Another
            </Button>
            <Button onClick={() => router.push("/")} className="w-full">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center p-4 sm:p-6">
      <div className="max-w-lg w-full space-y-6 kiosk-wide">
        {/* Header */}
        <div className="space-y-1">
          {step > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            {step === 1 && "What type of registration?"}
            {step === 2 && (category === "rideshare" ? "Select ride service" : category === "food_grocery" ? "Select delivery service" : "Other details")}
            {step === 3 && "Details"}
            {step === 4 && "Confirm & Submit"}
          </h1>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Category selection */}
        {step === 1 && (
          <div className="grid gap-4 kiosk-grid kiosk-grid-3">
            {[
              {
                id: "rideshare" as Category,
                label: "Ride Share",
                description: "Uber, Lyft, Taxi",
                logo: "/logos/uber.png",
                logoBg: "bg-black",
                icon: Car,
              },
              {
                id: "food_grocery" as Category,
                label: "Food / Grocery",
                description: "DoorDash, Walmart, and more",
                logo: "/logos/doordash.png",
                logoBg: "bg-white p-3",
                icon: ShoppingBag,
              },
              {
                id: "other" as Category,
                label: "Other",
                description: "Any other delivery or service",
                icon: Package,
              },
            ].map((item) => (
              <Card
                key={item.id}
                className={`h-full cursor-pointer transition-all hover:border-primary ${
                  category === item.id ? "border-primary ring-2 ring-primary/20" : ""
                }`}
                onClick={() => {
                  setCategory(item.id);
                  setProvider(null);
                  setStep(2);
                }}
              >
                <CardContent className="flex h-full items-center gap-4 p-6">
                  {item.logo ? (
                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl ${item.logoBg ?? ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.logo} alt={item.label} className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <item.icon className="h-8 w-8 text-primary" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-lg">{item.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 2: Provider selection */}
        {step === 2 && category === "rideshare" && (
          <div className="grid gap-4 kiosk-grid kiosk-grid-3">
            {RIDESHARE_PROVIDERS.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:border-primary ${
                  provider === p.id ? "border-primary ring-2 ring-primary/20" : ""
                }`}
                onClick={() => {
                  setProvider(p.id);
                  setStep(3);
                }}
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

        {step === 2 && category === "food_grocery" && (
          <div className="grid grid-cols-2 gap-3 kiosk-grid kiosk-grid-4">
            {FOOD_PROVIDERS.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:border-primary ${
                  provider === p.id ? "border-primary ring-2 ring-primary/20" : ""
                }`}
                onClick={() => {
                  setProvider(p.id);
                  setStep(3);
                }}
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

        {step === 2 && category === "other" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="other-provider">Service name</Label>
                <Input
                  id="other-provider"
                  placeholder="e.g. Amazon, FedEx..."
                  value={provider || ""}
                  onChange={(e) => setProvider(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="other-notes">Notes (optional)</Label>
                <Textarea
                  id="other-notes"
                  placeholder="Any details about the delivery..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!provider?.trim()}
                onClick={() => setStep(3)}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Details */}
        {step === 3 && category === "rideshare" && (
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Number of cars */}
              <div className="space-y-2">
                <Label>How many cars?</Label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNumCars(Math.max(1, numCars - 1))}
                    disabled={numCars <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-2xl font-bold w-8 text-center">
                    {numCars}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNumCars(numCars + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Pickup date */}
              <div className="space-y-2">
                <Label htmlFor="pickup-date">Pickup date</Label>
                <Input
                  id="pickup-date"
                  type="date"
                  value={arrivalDate}
                  min={reservation.check_in_date}
                  max={reservation.check_out_date}
                  onChange={(e) => setArrivalDate(e.target.value)}
                />
              </div>

              {/* Dropoff toggle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Will they also drop off?</Label>
                  <Button
                    variant={hasReturn ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHasReturn(!hasReturn)}
                  >
                    {hasReturn ? "Yes" : "No"}
                  </Button>
                </div>

                {hasReturn && (
                  <>
                    <div className="space-y-2">
                      <Label>How many cars for drop-off?</Label>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setReturnCars(Math.max(1, returnCars - 1))
                          }
                          disabled={returnCars <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-2xl font-bold w-8 text-center">
                          {returnCars}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setReturnCars(returnCars + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="return-date">Drop-off date</Label>
                      <Input
                        id="return-date"
                        type="date"
                        value={returnDate}
                        min={arrivalDate || reservation.check_in_date}
                        max={reservation.check_out_date}
                        onChange={(e) => setReturnDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <Button
                className="w-full"
                disabled={!arrivalDate || (hasReturn && !returnDate)}
                onClick={() => setStep(4)}
              >
                Review & Submit
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && (category === "food_grocery" || category === "other") && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="delivery-date">Expected delivery date</Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={arrivalDate}
                  min={reservation.check_in_date}
                  max={reservation.check_out_date}
                  onChange={(e) => setArrivalDate(e.target.value)}
                />
              </div>
              {category === "food_grocery" && (
                <div className="space-y-2">
                  <Label htmlFor="food-notes">Notes (optional)</Label>
                  <Textarea
                    id="food-notes"
                    placeholder="Any special instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              )}
              <Button
                className="w-full"
                disabled={!arrivalDate}
                onClick={() => setStep(4)}
              >
                Review & Submit
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registration Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {category === "rideshare"
                      ? "Ride Share"
                      : category === "food_grocery"
                        ? "Food / Grocery Delivery"
                        : "Other"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{getProviderLabel()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {category === "rideshare" ? "Pickup date" : "Delivery date"}
                  </span>
                  <span className="font-medium">{formatDate(arrivalDate)}</span>
                </div>
                {category === "rideshare" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cars</span>
                    <span className="font-medium">{numCars}</span>
                  </div>
                )}
                {hasReturn && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Drop-off</span>
                      <span className="font-medium">
                        {returnCars} car{returnCars !== 1 ? "s" : ""} on{" "}
                        {formatDate(returnDate)}
                      </span>
                    </div>
                  </>
                )}
                {notes && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Notes</span>
                    <span className="font-medium">{notes}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting..." : "Submit Registration"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function FoodProviderIcon({ id, name }: { id: string; name: string }) {
  const logo = BRAND_LOGOS[id];
  if (logo) {
    return <img src={logo} alt={name} className="w-10 h-10 object-contain" />;
  }
  return <Package className="h-6 w-6 text-muted-foreground" />;
}
