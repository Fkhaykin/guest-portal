import { REVIEWS, type Review } from "@/lib/reviews-data";

// Some houses have an old + new property row (retired duplicate Lodgify
// listings). Reviews in reviews-data.ts are keyed by the listing name that was
// live when they were scraped, so merge both histories wherever reviews are
// aggregated for a house.
export const HOUSE_NAME_ALIASES: Record<string, string[]> = {
  "Lakeview Chalet w/ hot tub, sauna, fire pit & decks": [
    "Lakeview Chalet w/ Hot Tub, Sauna, Decks, Boats, & Fire Pit!",
  ],
  "Poconos Lakefront with Hot Tub, boats, and more!": [
    "Lakefront Home w/ Hot Tub, Game Room, Deck, Boats, Fire Pit",
  ],
};

/** All names a house's reviews may be filed under. */
export function houseReviewNames(propertyName: string): string[] {
  return [propertyName, ...(HOUSE_NAME_ALIASES[propertyName] ?? [])];
}

/** Reviews for a house across all of its listing names (newest first). */
export function reviewsForProperty(propertyName: string): Review[] {
  const names = houseReviewNames(propertyName);
  return REVIEWS.filter((r) => names.includes(r.property));
}
