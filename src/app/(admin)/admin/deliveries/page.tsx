"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Car,
  ShoppingBag,
  Package,
  Truck,
  Check,
  Plus,
  Minus,
  Search,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type Registration = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  guest: { full_name: string; email: string | null } | null;
  property: { id: string; name: string; nickname: string | null } | null;
};

type SentDelivery = {
  id: string;
  created_at: string;
  category: "rideshare" | "food_grocery" | "other";
  provider: string | null;
  arrival_date: string;
  email_subject: string | null;
  email_body: string | null;
  email_recipients: string[] | null;
  registration: {
    guest: { full_name: string } | null;
    property: { name: string; nickname: string | null } | null;
  } | null;
};

type Category = "rideshare" | "food_grocery" | "other";

const RIDESHARE_PROVIDERS = ["Uber", "Lyft", "Taxi", "Other"];
const FOOD_PROVIDERS = [
  "DoorDash",
  "Uber Eats",
  "GrubHub",
  "Seamless",
  "Walmart",
  "BJ's",
  "Weis",
  "Giant",
  "Other",
];

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isCurrentOrUpcoming(reg: Registration) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkOut = new Date(reg.check_out_date + "T00:00:00");
  return checkOut >= today;
}

export default function AdminDeliveriesPage() {
  const supabase = createClient();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [sentHistory, setSentHistory] = useState<SentDelivery[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState<Category>("food_grocery");
  const [provider, setProvider] = useState("");
  const [numCars, setNumCars] = useState(1);
  const [arrivalDate, setArrivalDate] = useState("");
  const [hasReturn, setHasReturn] = useState(false);
  const [returnCars, setReturnCars] = useState(1);
  const [returnDate, setReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("registration")
      .select(
        "id, check_in_date, check_out_date, status, guest:guest_id(full_name, email), property:property_id(id, name, nickname)"
      )
      .eq("status", "active")
      .order("check_in_date", { ascending: true });
    if (data) {
      setRegistrations(
        (data as unknown as Registration[]).filter(isCurrentOrUpcoming)
      );
    }
    setLoading(false);
  }

  async function loadHistory() {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("delivery_rideshare")
      .select(
        "id, created_at, category, provider, arrival_date, email_subject, email_body, email_recipients, registration:registration_id(guest:guest_id(full_name), property:property_id(name, nickname))"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setSentHistory(data as unknown as SentDelivery[]);
    setHistoryLoading(false);
  }

  function openDialog(reg: Registration) {
    setSelectedReg(reg);
    setCategory("food_grocery");
    setProvider("");
    setNumCars(1);
    setArrivalDate(reg.check_in_date);
    setHasReturn(false);
    setReturnCars(1);
    setReturnDate("");
    setNotes("");
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  }

  function closeDialog() {
    setSelectedReg(null);
    setSubmitted(false);
  }

  async function handleSubmit() {
    if (!selectedReg || !category || !arrivalDate) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration_id: selectedReg.id,
          category,
          provider: provider || undefined,
          num_cars: category === "rideshare" ? numCars : 1,
          arrival_date: arrivalDate,
          has_return: category === "rideshare" ? hasReturn : false,
          return_cars: hasReturn ? returnCars : undefined,
          return_date: hasReturn ? returnDate : undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Something went wrong");
      } else {
        setSubmitted(true);
        setTimeout(() => loadHistory(), 2000);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const providerOptions =
    category === "rideshare" ? RIDESHARE_PROVIDERS : FOOD_PROVIDERS;

  const filtered = registrations.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const guestName = r.guest?.full_name?.toLowerCase() ?? "";
    const propName = (r.property?.nickname || r.property?.name || "").toLowerCase();
    return guestName.includes(q) || propName.includes(q);
  });

  const isRideshare = category === "rideshare";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deliveries</h1>
          <p className="text-muted-foreground text-sm">
            Register a delivery or rideshare for a current guest
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search guest or property..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading bookings...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No active or upcoming bookings found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((reg) => {
            const propertyLabel =
              reg.property?.nickname || reg.property?.name || "—";
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const checkIn = new Date(reg.check_in_date + "T00:00:00");
            const checkOut = new Date(reg.check_out_date + "T00:00:00");
            const isCurrent = checkIn <= today && checkOut >= today;

            return (
              <Card key={reg.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {propertyLabel}
                    </CardTitle>
                    {isCurrent ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0">
                        Staying Now
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">
                        Upcoming
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div>
                    <p className="font-medium text-sm">
                      {reg.guest?.full_name || "Unknown guest"}
                    </p>
                    {reg.guest?.email && (
                      <p className="text-xs text-muted-foreground">
                        {reg.guest.email}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(reg.check_in_date)} →{" "}
                    {formatDate(reg.check_out_date)}
                  </div>
                  <Button
                    className="w-full mt-auto"
                    size="sm"
                    onClick={() => openDialog(reg)}
                  >
                    <Truck className="h-3.5 w-3.5 mr-1.5" />
                    Register Delivery
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sent History */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Sent History</h2>
        </div>

        {historyLoading ? (
          <div className="text-muted-foreground text-sm">Loading history...</div>
        ) : sentHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries sent yet.</p>
        ) : (
          <div className="space-y-2">
            {sentHistory.map((item) => {
              const isExpanded = expandedId === item.id;
              const label =
                item.registration?.property?.nickname ||
                item.registration?.property?.name ||
                "Unknown property";
              const guestName =
                item.registration?.guest?.full_name || "Unknown guest";
              const sentAt = new Date(item.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              const categoryLabel =
                item.category === "rideshare"
                  ? "Ride Share"
                  : item.category === "food_grocery"
                  ? "Food / Grocery"
                  : "Other";

              return (
                <Card key={item.id} className="overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <CardHeader className="pb-3 pt-4 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug truncate">
                            {item.email_subject || `${item.provider || categoryLabel} — ${formatDate(item.arrival_date)}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {guestName} · {label} · {sentAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {categoryLabel}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {isExpanded && (
                    <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t">
                      {item.email_recipients && item.email_recipients.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Recipients
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.email_recipients.map((r) => (
                              <span
                                key={r}
                                className="text-xs bg-muted rounded px-2 py-0.5 font-mono"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.email_subject && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Subject
                          </p>
                          <p className="text-sm">{item.email_subject}</p>
                        </div>
                      )}
                      {item.email_body && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Body
                          </p>
                          <pre className="text-sm whitespace-pre-wrap font-sans bg-muted rounded p-3 leading-relaxed">
                            {item.email_body}
                          </pre>
                        </div>
                      )}
                      {!item.email_subject && !item.email_body && (
                        <p className="text-sm text-muted-foreground italic">
                          No email preview available for this record.
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delivery Dialog */}
      <Dialog open={!!selectedReg} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Delivery Registered</h2>
                <p className="text-sm text-muted-foreground">
                  Notification sent to HOA for{" "}
                  {selectedReg?.property?.nickname ||
                    selectedReg?.property?.name}.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (selectedReg) openDialog(selectedReg);
                  }}
                >
                  Register Another
                </Button>
                <Button className="flex-1" onClick={closeDialog}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Register Delivery</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedReg?.guest?.full_name} ·{" "}
                  {selectedReg?.property?.nickname ||
                    selectedReg?.property?.name}
                </p>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Category */}
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: "food_grocery", label: "Food / Grocery", icon: ShoppingBag },
                        { id: "rideshare", label: "Ride Share", icon: Car },
                        { id: "other", label: "Other", icon: Package },
                      ] as { id: Category; label: string; icon: React.ElementType }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setCategory(opt.id);
                          setProvider("");
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
                          category === opt.id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        <opt.icon className="h-5 w-5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Provider */}
                {category !== "other" ? (
                  <div className="space-y-2">
                    <Label>Service</Label>
                    <Select value={provider} onValueChange={(v) => setProvider(v ?? "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider..." />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="other-provider">Service name</Label>
                    <Input
                      id="other-provider"
                      placeholder="e.g. Amazon, FedEx..."
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    />
                  </div>
                )}

                {/* Number of cars (rideshare only) */}
                {isRideshare && (
                  <div className="space-y-2">
                    <Label>Number of cars</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setNumCars(Math.max(1, numCars - 1))}
                        disabled={numCars <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-xl font-bold w-6 text-center">
                        {numCars}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setNumCars(numCars + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Arrival date */}
                <div className="space-y-2">
                  <Label htmlFor="arrival-date">
                    {isRideshare ? "Pickup date" : "Delivery date"}
                  </Label>
                  <Input
                    id="arrival-date"
                    type="date"
                    value={arrivalDate}
                    min={selectedReg?.check_in_date}
                    max={selectedReg?.check_out_date}
                    onChange={(e) => setArrivalDate(e.target.value)}
                  />
                </div>

                {/* Return (rideshare only) */}
                {isRideshare && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Drop-off return?</Label>
                      <button
                        type="button"
                        onClick={() => setHasReturn(!hasReturn)}
                        className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                          hasReturn
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {hasReturn ? "Yes" : "No"}
                      </button>
                    </div>
                    {hasReturn && (
                      <div className="space-y-3 pl-0">
                        <div className="space-y-2">
                          <Label>Cars for drop-off</Label>
                          <div className="flex items-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                setReturnCars(Math.max(1, returnCars - 1))
                              }
                              disabled={returnCars <= 1}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xl font-bold w-6 text-center">
                              {returnCars}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setReturnCars(returnCars + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="return-date">Drop-off date</Label>
                          <Input
                            id="return-date"
                            type="date"
                            value={returnDate}
                            min={arrivalDate || selectedReg?.check_in_date}
                            max={selectedReg?.check_out_date}
                            onChange={(e) => setReturnDate(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    !arrivalDate ||
                    (category !== "other" && !provider) ||
                    (isRideshare && hasReturn && !returnDate)
                  }
                >
                  {submitting ? "Sending..." : "Submit & Notify HOA"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
