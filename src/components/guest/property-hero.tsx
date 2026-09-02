import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The first thing a guest sees after scanning the QR code on the fridge.
 * Previously this was a centered "Welcome!" over the property description —
 * no image at all, on a portal for a lakefront house.
 *
 * Full-bleed on phones (it bleeds through the layout's px-4/py-6), inset and
 * rounded from sm up. Hidden on the kiosk, which runs its own welcome board.
 */
export function PropertyHero({
  name,
  description,
  imageUrl,
  className,
}: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  className?: string;
}) {
  const blurb = plainText(description);
  return (
    <section
      data-kiosk-hide
      className={cn(
        "relative -mx-4 -mt-6 overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-3xl",
        "aspect-[4/3] sm:aspect-[21/9]",
        // Without a cover the scrim would sit on nothing, so the panel falls
        // back to the brand gradient rather than a grey box.
        !imageUrl && "bg-gradient-to-br from-primary to-primary/70",
        className
      )}
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 100vw, 896px"
          className="object-cover"
        />
      )}
      {/* Two stops, weighted to the bottom: the name has to clear AA against
          whatever the photo happens to be doing behind it. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
        <p className="text-eyebrow text-white/70">Welcome to</p>
        <h1 className="mt-1.5 font-display text-display text-white text-balance">
          {name}
        </h1>
        {blurb && (
          <p className="mt-2 max-w-xl line-clamp-2 text-sm text-white/80 text-pretty sm:text-base">
            {blurb}
          </p>
        )}
      </div>
      {/* Inset hairline so the panel keeps an edge on a light canvas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10 sm:rounded-3xl"
      />
    </section>
  );
}

/**
 * Property descriptions come out of Lodgify carrying raw markup — `<p>`,
 * `<br>`, `&nbsp;` — which the old centered block rendered as literal text on
 * the page. Strip to something that can sit on a scrim.
 */
function plainText(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
