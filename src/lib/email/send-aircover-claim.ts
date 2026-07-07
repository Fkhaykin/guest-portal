import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export type ClaimEmailPhoto = {
  /** File name shown in the attachment list. */
  filename: string;
  /** Base64-encoded file contents. */
  contentBase64: string;
  /** MIME type, e.g. "image/jpeg". */
  contentType: string;
  /** Content-ID used to embed the image inline via cid:. */
  contentId: string;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ACCENT = "#0f172a"; // slate-900 — brand/CTA
const MUTED = "#64748b"; // slate-500
const BORDER = "#e2e8f0"; // slate-200
const BG = "#f1f5f9"; // slate-100

export type AircoverClaimEmailParams = {
  to: string;
  hostName: string;
  propertyName: string;
  claimType: string;
  claimId: string;
  guestName?: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  checkInDate?: string;
  checkOutDate?: string;
  reportedByName?: string | null;
  portalBookingUrl?: string;
  airbnbUrl?: string | null;
  adminClaimUrl?: string;
  damageDescription?: string | null;
  photos?: ClaimEmailPhoto[];
  petDescription?: string | null;
  reportedPetCount?: number | null;
  reportedPetLabels?: string[];
  expectedPetCount?: number | null;
  registeredPets?: { name: string | null; kind: string | null }[];
};

/** Build the subject/html/text/attachments for a potential-claim email. Pure — no network. */
export function buildAircoverClaimEmail({
  hostName,
  propertyName,
  claimType,
  claimId,
  guestName,
  guestEmail,
  guestPhone,
  checkInDate,
  checkOutDate,
  reportedByName,
  portalBookingUrl,
  airbnbUrl,
  adminClaimUrl,
  // Damage
  damageDescription,
  photos = [],
  // Pet discrepancy
  petDescription,
  reportedPetCount,
  reportedPetLabels = [],
  expectedPetCount,
  registeredPets = [],
}: Omit<AircoverClaimEmailParams, "to">) {
  const isDamage = claimType === "damage";
  const typeLabel = isDamage ? "Damage Report" : "Pet Discrepancy";
  const bannerColor = isDamage ? "#b91c1c" : "#b45309"; // red-700 / amber-700
  const bannerIcon = isDamage ? "⚠️" : "🐾";

  const subject = `New Potential Claim: ${typeLabel} — ${propertyName}`;
  const guest = guestName || "Unknown guest";

  // ---- HTML building blocks ------------------------------------------------

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 0;color:${MUTED};font-size:13px;white-space:nowrap;vertical-align:top;width:120px;">${esc(
        label
      )}</td>
      <td style="padding:6px 0;color:#0f172a;font-size:14px;vertical-align:top;">${value}</td>
    </tr>`;

  // Claim-specific detail section
  let detailHtml = "";
  if (isDamage) {
    const desc = damageDescription?.trim();
    detailHtml += `
      <p style="margin:0 0 4px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">What the cleaner reported</p>
      <p style="margin:0 0 16px;color:#0f172a;font-size:15px;line-height:1.5;white-space:pre-wrap;">${
        desc ? esc(desc) : "<em style='color:" + MUTED + "'>No description provided.</em>"
      }</p>`;

    if (photos.length > 0) {
      // 2-column photo grid using a table for email-client compatibility.
      const cells = photos.map(
        (p, i) => `
          <td width="50%" style="padding:4px;vertical-align:top;">
            <img src="cid:${p.contentId}" alt="Damage photo ${
          i + 1
        }" width="260" style="width:100%;max-width:260px;height:auto;border-radius:8px;border:1px solid ${BORDER};display:block;" />
            <p style="margin:4px 0 0;color:${MUTED};font-size:11px;">Photo ${
          i + 1
        }</p>
          </td>`
      );
      const rows: string[] = [];
      for (let i = 0; i < cells.length; i += 2) {
        const pair = cells.slice(i, i + 2).join("");
        const filler = cells.length - i === 1 ? '<td width="50%"></td>' : "";
        rows.push(`<tr>${pair}${filler}</tr>`);
      }
      detailHtml += `
        <p style="margin:0 0 6px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Photos (${photos.length})</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">${rows.join(
          ""
        )}</table>
        <p style="margin:8px 0 0;color:${MUTED};font-size:12px;">Full-resolution photos are also attached to this email.</p>`;
    } else {
      detailHtml += `<p style="margin:0;color:${MUTED};font-size:13px;">No photos were attached to this report.</p>`;
    }
  } else {
    const expected = expectedPetCount ?? 0;
    const reported = reportedPetCount ?? 0;
    const overage = Math.max(0, reported - expected);
    detailHtml += `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
        <tr>
          <td style="padding:0 24px 0 0;">
            <p style="margin:0;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Expected</p>
            <p style="margin:2px 0 0;color:#0f172a;font-size:22px;font-weight:700;">${expected}</p>
          </td>
          <td style="padding:0 24px 0 0;">
            <p style="margin:0;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Reported</p>
            <p style="margin:2px 0 0;color:#b45309;font-size:22px;font-weight:700;">${reported}</p>
          </td>
          <td>
            <p style="margin:0;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Over</p>
            <p style="margin:2px 0 0;color:#b91c1c;font-size:22px;font-weight:700;">+${overage}</p>
          </td>
        </tr>
      </table>`;

    if (reportedPetLabels.length > 0) {
      const chips = reportedPetLabels
        .map(
          (l) =>
            `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 10px;background:${BG};border:1px solid ${BORDER};border-radius:999px;font-size:12px;color:#0f172a;">🐾 ${esc(
              l
            )}</span>`
        )
        .join("");
      detailHtml += `
        <p style="margin:0 0 6px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Pets found on site</p>
        <div style="margin:0 0 12px;">${chips}</div>`;
    }

    const namedPets = registeredPets.filter((p) => p.name?.trim());
    detailHtml += `
      <p style="margin:0 0 4px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Registered on the booking</p>
      <p style="margin:0 0 16px;color:#0f172a;font-size:14px;">${
        namedPets.length > 0
          ? namedPets
              .map((p) => esc(`${p.name}${p.kind ? ` (${p.kind})` : ""}`))
              .join(", ")
          : "<em style='color:" + MUTED + "'>No pets registered.</em>"
      }</p>`;

    const desc = petDescription?.trim();
    if (desc) {
      detailHtml += `
        <p style="margin:0 0 4px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Cleaner's note</p>
        <p style="margin:0;color:#0f172a;font-size:15px;line-height:1.5;white-space:pre-wrap;">${esc(
          desc
        )}</p>`;
    }
  }

  // Booking / guest detail rows
  const detailRows = [
    row("Property", esc(propertyName)),
    row("Guest", esc(guest)),
    guestEmail
      ? row(
          "Guest email",
          `<a href="mailto:${esc(guestEmail)}" style="color:${ACCENT};">${esc(
            guestEmail
          )}</a>`
        )
      : "",
    guestPhone
      ? row(
          "Guest phone",
          `<a href="tel:${esc(guestPhone)}" style="color:${ACCENT};">${esc(
            guestPhone
          )}</a>`
        )
      : "",
    checkInDate ? row("Check-in", esc(checkInDate)) : "",
    checkOutDate ? row("Check-out", esc(checkOutDate)) : "",
    reportedByName ? row("Reported by", esc(reportedByName)) : "",
  ]
    .filter(Boolean)
    .join("");

  // Links list
  const links: string[] = [];
  if (portalBookingUrl)
    links.push(
      `<a href="${esc(
        portalBookingUrl
      )}" style="color:${ACCENT};font-size:13px;">Guest portal booking →</a>`
    );
  if (airbnbUrl)
    links.push(
      `<a href="${esc(
        airbnbUrl
      )}" style="color:${ACCENT};font-size:13px;">Airbnb listing →</a>`
    );
  const linksHtml =
    links.length > 0
      ? `<p style="margin:16px 0 0;line-height:2;">${links.join(
          '&nbsp;&nbsp;·&nbsp;&nbsp;'
        )}</p>`
      : "";

  const ctaHtml = adminClaimUrl
    ? `<tr><td style="padding:8px 24px 24px;">
        <a href="${esc(
          adminClaimUrl
        )}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">Review &amp; file this claim →</a>
      </td></tr>`
    : "";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
        <!-- Banner -->
        <tr><td style="background:${bannerColor};padding:20px 24px;">
          <p style="margin:0;color:rgba(255,255,255,.85);font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">New Potential Claim</p>
          <p style="margin:4px 0 0;color:#ffffff;font-size:20px;font-weight:700;">${bannerIcon} ${esc(
    typeLabel
  )}</p>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:24px 24px 8px;">
          <p style="margin:0 0 4px;color:#0f172a;font-size:15px;">Hi ${esc(
            hostName || "there"
          )},</p>
          <p style="margin:0;color:${MUTED};font-size:14px;line-height:1.5;">Your cleaner${
    reportedByName ? ` <strong style="color:#0f172a;">${esc(reportedByName)}</strong>` : ""
  } flagged a potential claim at <strong style="color:#0f172a;">${esc(
    propertyName
  )}</strong>. Details are below.</p>
        </td></tr>

        <!-- Claim details -->
        <tr><td style="padding:8px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};border:1px solid ${BORDER};border-radius:10px;">
            <tr><td style="padding:18px 18px;">${detailHtml}</td></tr>
          </table>
        </td></tr>

        <!-- Booking details -->
        <tr><td style="padding:20px 24px 0;">
          <p style="margin:0 0 4px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Booking</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table>
          ${linksHtml}
        </td></tr>

        <!-- CTA -->
        ${ctaHtml}

        <!-- Footer -->
        <tr><td style="padding:16px 24px 24px;border-top:1px solid ${BORDER};">
          <p style="margin:0;color:${MUTED};font-size:11px;line-height:1.5;">Claim ID: ${esc(
    claimId
  )}<br/>Sent by Summit Lakeside. This is an automated notification about a cleaner report — it is not an insurance filing.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ---- Plain-text fallback -------------------------------------------------
  const textLines = [
    `NEW POTENTIAL CLAIM — ${typeLabel}`,
    "",
    `Hi ${hostName || "there"},`,
    "",
    `Your cleaner${
      reportedByName ? ` (${reportedByName})` : ""
    } flagged a potential claim at ${propertyName}.`,
    "",
    "--- Claim ---",
    `Type: ${typeLabel}`,
  ];
  if (isDamage) {
    textLines.push(
      `Description: ${damageDescription?.trim() || "(none provided)"}`,
      `Photos: ${photos.length} attached`
    );
  } else {
    textLines.push(
      `Expected pets: ${expectedPetCount ?? 0}`,
      `Reported pets: ${reportedPetCount ?? 0}`,
      ...(reportedPetLabels.length > 0
        ? [`Found on site: ${reportedPetLabels.join(", ")}`]
        : []),
      `Registered: ${
        registeredPets
          .filter((p) => p.name?.trim())
          .map((p) => `${p.name}${p.kind ? ` (${p.kind})` : ""}`)
          .join(", ") || "(none)"
      }`,
      ...(petDescription?.trim() ? [`Note: ${petDescription.trim()}`] : [])
    );
  }
  textLines.push(
    "",
    "--- Booking ---",
    `Property: ${propertyName}`,
    `Guest: ${guest}`,
    ...(guestEmail ? [`Guest email: ${guestEmail}`] : []),
    ...(guestPhone ? [`Guest phone: ${guestPhone}`] : []),
    ...(checkInDate ? [`Check-in: ${checkInDate}`] : []),
    ...(checkOutDate ? [`Check-out: ${checkOutDate}`] : []),
    ...(portalBookingUrl ? ["", `Portal: ${portalBookingUrl}`] : []),
    ...(airbnbUrl ? [`Airbnb: ${airbnbUrl}`] : []),
    ...(adminClaimUrl ? [`Review claim: ${adminClaimUrl}`] : []),
    "",
    `Claim ID: ${claimId}`,
    "— Summit Lakeside"
  );

  const attachments = photos.map((p) => ({
    filename: p.filename,
    content: p.contentBase64,
    contentType: p.contentType,
    contentId: p.contentId,
  }));

  return { subject, html, text: textLines.join("\n"), attachments };
}

export async function sendAircoverClaimEmail(params: AircoverClaimEmailParams) {
  const { subject, html, text, attachments } = buildAircoverClaimEmail(params);

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: "contact@summitlakeside.com",
    to: params.to,
    subject,
    html,
    text,
    ...(attachments.length > 0 ? { attachments } : {}),
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}
