import { REVIEWS, type Review } from "@/lib/reviews-data";
import { houseReviewNames } from "@/lib/house-aliases";

const NEGATIVE =
  /issue|problem|however|but |unfortunately|broke|broken|dirty|cold|smell|wasn|didn|couldn|except|complaint|replied|misleading/i;

/** Short, glowing 5-star quotes for the given houses (by property name),
 *  newest first. Used for server-rendered pull-quote grids on content pages. */
export function pickReviewQuotes(
  propertyNames: string[],
  limit = 4
): Review[] {
  const names = new Set(propertyNames.flatMap((n) => houseReviewNames(n)));
  return REVIEWS.filter(
    (r) =>
      names.has(r.property) &&
      r.rating === 5 &&
      r.text.length >= 70 &&
      r.text.length <= 260 &&
      !NEGATIVE.test(r.text) &&
      !/<br/i.test(r.text)
  ).slice(0, limit);
}
