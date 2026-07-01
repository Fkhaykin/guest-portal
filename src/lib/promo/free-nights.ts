// Free-nights promo discount: the guest's cheapest nights are comped, never the
// average. Applying the discount to the cheapest eligible nights keeps the host's
// payout as high as possible (the expensive weekend nights stay billed) and
// matches how "stay 3, pay 2" promos are normally advertised.

export type PromoNight = { date: string; price_cents: number };

export type FreeNightsScope = "any" | "weeknight" | "weekend";

// A night is identified by the date you sleep over. Weekend nights are Friday and
// Saturday; everything else (Sun–Thu) is a weeknight.
export function isWeeknight(date: string): boolean {
  const dow = new Date(date + "T00:00:00").getDay(); // 0=Sun … 6=Sat
  return dow !== 5 && dow !== 6;
}

export function isWeekend(date: string): boolean {
  return !isWeeknight(date);
}

// Total discount for a free-nights promo: the sum of the `freeNights` cheapest
// eligible nights. With scope "weeknight" only Sun–Thu nights are eligible (and
// "weekend" only Fri/Sat), so a stay with none of the eligible nights gets
// nothing.
export function freeNightsDiscountCents(
  nights: PromoNight[],
  freeNights: number,
  scope: FreeNightsScope = "any",
): number {
  const eligible =
    scope === "weeknight"
      ? nights.filter((n) => isWeeknight(n.date))
      : scope === "weekend"
        ? nights.filter((n) => isWeekend(n.date))
        : nights;
  const cheapestFirst = [...eligible].sort((a, b) => a.price_cents - b.price_cents);
  const count = Math.min(freeNights, cheapestFirst.length);
  let discount = 0;
  for (let i = 0; i < count; i++) discount += cheapestFirst[i].price_cents;
  return discount;
}
