import PDFDocument from "pdfkit";
import { PDFDocument as PDFLib } from "pdf-lib";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import fs from "fs";
import path from "path";

// ---------- Types ----------

export type PEPOAData = {
  owner: {
    full_name: string;
    mailing_address: string;
    phone: string;
    email: string;
    signature_url: string | null;
  };
  property: {
    lot_section: string;
  };
  lease_start: string;
  lease_end: string;
  guest: {
    full_name: string;
    mailing_address: string;
    phone: string;
  };
  guests: Array<{ first_name: string; last_name: string; age_group: "over_21" | "under_21" | "infant" }>;
  pets: Array<{
    name: string;
    kind: string;
    rabies_doc_path: string | null;
    vaccination_doc_path: string | null;
  }>;
  vehicles: Array<{
    make: string;
    model: string;
    year: string;
    license_plate: string;
    state_or_region: string;
    color: string;
    driver_name: string;
  }>;
  tenant_signature_url: string | null;
  registration_date: string;
};

// ---------- Constants ----------

const LM = 55; // left margin
const PW = 500; // usable page width
const DARK = "#2c3e50";

// ---------- Helpers ----------

async function fetchStorageFile(bucket: string, filePath: string): Promise<Buffer | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error || !data) return null;
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function drawUnderlinedField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  fieldWidth: number
): number {
  doc.font("Helvetica").fontSize(10).fillColor("#000").text(label, x, y);
  const labelW = doc.widthOfString(label) + 3;
  doc.text(value || "", x + labelW, y, { width: fieldWidth - labelW, underline: true });
  return y + 18;
}

function drawBoldLabelField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  fieldWidth: number
): number {
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(label, x, y);
  const labelW = doc.widthOfString(label) + 6;
  doc.font("Helvetica").fontSize(10).text(value || "", x + labelW, y, { width: fieldWidth - labelW });
  return y + 18;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  headers: string[],
  rows: string[][],
  colWidths: number[]
): number {
  const rowHeight = 22;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row background
  doc.save();
  doc.rect(x, y, tableWidth, rowHeight).fill("#f0f0f0");
  doc.restore();

  // Header text
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cx + 2, y + 6, { width: colWidths[i] - 4, align: "center" });
    cx += colWidths[i];
  }

  // Header cell borders
  cx = x;
  doc.strokeColor("#999").lineWidth(0.5);
  for (let i = 0; i < headers.length; i++) {
    doc.rect(cx, y, colWidths[i], rowHeight).stroke();
    cx += colWidths[i];
  }

  // Data rows
  let ry = y + rowHeight;
  doc.font("Helvetica").fontSize(9).fillColor("#000");
  for (const row of rows) {
    cx = x;
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i] || "-", cx + 2, ry + 6, { width: colWidths[i] - 4, align: "center" });
      cx += colWidths[i];
    }
    cx = x;
    doc.strokeColor("#999").lineWidth(0.5);
    for (let i = 0; i < colWidths.length; i++) {
      doc.rect(cx, ry, colWidths[i], rowHeight).stroke();
      cx += colWidths[i];
    }
    ry += rowHeight;
  }

  return ry;
}

function drawAdminField(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  pw: number
): number {
  doc.font("Helvetica").fontSize(10).fillColor("#000").text(label, x, y);
  const fw = doc.widthOfString(label);
  doc.strokeColor("#333").lineWidth(0.5);
  doc.moveTo(x + fw + 4, y + 12).lineTo(x + 230, y + 12).stroke();
  doc.text("Date Received:", x + 260, y);
  doc.moveTo(x + 350, y + 12).lineTo(x + pw, y + 12).stroke();
  return y + 24;
}

/** Embed a signature image, flattening transparency onto a white background */
async function embedSignature(
  doc: PDFKit.PDFDocument,
  bucket: string,
  sigPath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<boolean> {
  const sigBuf = await fetchStorageFile(bucket, sigPath);
  if (!sigBuf) return false;
  try {
    const flattened = await sharp(sigBuf).flatten({ background: { r: 255, g: 255, b: 255 } }).png().toBuffer();
    doc.image(flattened, x, y, { width, height, fit: [width, height] });
    return true;
  } catch {
    return false;
  }
}

function tryLoadHeaderImage(): Buffer | null {
  try {
    const imgPath = path.join(process.cwd(), "public", "PEPOA-header.png");
    if (fs.existsSync(imgPath)) {
      return fs.readFileSync(imgPath);
    }
  } catch {
    // ignore
  }
  return null;
}

// ---------- Main Generator ----------

export async function generatePEPOARegistrationPDF(data: PEPOAData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "letter", margins: { top: 40, bottom: 50, left: LM, right: LM } });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ===== PAGE 1: Registration Form =====
  drawPage1(doc, data);

  // ===== PAGE 2: Animals & Vehicles & Admin =====
  doc.addPage();
  drawPage2(doc, data);

  // ===== PAGE 3+: Entered By + Lease Agreement + Signatures =====
  doc.addPage();
  await drawPage3AndSignatures(doc, data);

  // ===== APPENDIX: Pet document image attachments =====
  await drawImageAttachmentPages(doc, data);

  doc.end();
  const mainPdf = await finished;

  // ===== Merge any uploaded PDF pet documents =====
  return mergePetPdfAttachments(mainPdf, data);
}

// ---------- Text-based header fallback ----------

function drawTextHeader(doc: PDFKit.PDFDocument, y: number): number {
  doc.font("Helvetica-Bold").fontSize(13).fillColor(DARK);
  doc.text("PENN ESTATES PROPERTY OWNERS ASSOCIATION", LM, y, { width: PW, align: "center" });
  y += 16;

  doc.font("Helvetica").fontSize(9).fillColor("#555");
  doc.text("304 Cricket Dr. E. Stroudsburg, PA 18301", LM, y, { width: PW, align: "center" });
  y += 12;
  doc.text("P: 570.421.4265  F: 570.421.1092", LM, y, { width: PW, align: "center" });
  y += 18;

  doc.save();
  doc.roundedRect(LM, y, PW, 30, 4).fill(DARK);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#fff");
  doc.text("SHORT-TERM TENANT REGISTRATION FORM AND LEASE", LM, y + 9, { width: PW, align: "center" });
  doc.restore();
  y += 36;

  doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#555");
  doc.text(
    "Form must be filled out completely and shall be submitted at least three (3) days in advance of registration",
    LM, y, { width: PW, align: "center" }
  );
  y += 20;

  return y;
}

// ---------- Page 1: Registration Form ----------

function drawPage1(doc: PDFKit.PDFDocument, data: PEPOAData) {
  let y = 36;

  // Full letterhead image (logo + org name + address + title banner + subtitle)
  const headerImg = tryLoadHeaderImage();
  if (headerImg) {
    try {
      doc.image(headerImg, LM, y, { width: PW });
      // Image is 1750x714 (~2.45:1 aspect ratio)
      y += Math.round(PW / 2.45) + 16;
    } catch {
      // Fall back to text-based header
      y = drawTextHeader(doc, y);
    }
  } else {
    y = drawTextHeader(doc, y);
  }

  // Date
  y = drawUnderlinedField(doc, "Date", formatDate(data.registration_date), LM, y, PW);
  y += 6;

  // Owner info
  y = drawUnderlinedField(doc, "Owner of Record:", data.owner.full_name, LM, y, PW);
  y = drawUnderlinedField(doc, "Mailing Address:", data.owner.mailing_address, LM, y, PW);

  const halfW = PW / 2;
  drawUnderlinedField(doc, "Owner's Home No:", formatPhone(data.owner.phone), LM, y, halfW);
  y = drawUnderlinedField(doc, "Owner's Business No:", formatPhone(data.owner.phone), LM + halfW, y, halfW);

  drawUnderlinedField(doc, "Cell No:", formatPhone(data.owner.phone), LM, y, halfW);
  y = drawUnderlinedField(doc, "Email Address:", data.owner.email, LM + halfW, y, halfW);
  y += 8;

  // Lot/Section
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text("Lot/Section: ", LM, y, { continued: true });
  doc.font("Helvetica").text(data.property.lot_section || "");
  y += 22;

  // Lease dates
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  drawUnderlinedField(doc, "Lease Start Date", formatDate(data.lease_start), LM, y, halfW - 10);
  y = drawUnderlinedField(doc, "Lease Expiration Date", formatDate(data.lease_end), LM + halfW, y, halfW);
  y += 6;

  // Guest info
  y = drawBoldLabelField(doc, "Registered Guest:", data.guest.full_name, LM, y, PW);
  y += 2;

  // Current Mailing Address (multi-line)
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text("Current Mailing Address:", LM, y);
  const addrX = LM + doc.widthOfString("Current Mailing Address:") + 10;
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  const addrLines = (data.guest.mailing_address || "").split("\n");
  for (const line of addrLines) {
    doc.text(line.trim(), addrX, y);
    y += 14;
  }
  y += 4;

  // Guest phone
  drawBoldLabelField(doc, "Guest Home No:", formatPhone(data.guest.phone), LM, y, halfW);
  y = drawBoldLabelField(doc, "Guest Cell No:", formatPhone(data.guest.phone), LM + halfW, y, halfW);
  y += 12;

  // Section header: TENANT AND GUEST REGISTRATION
  doc.font("Helvetica-Bold").fontSize(14).fillColor(DARK);
  doc.text("TENANT AND GUEST REGISTRATION", LM, y, { width: PW, align: "center" });
  y += 20;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000");
  doc.text("Please provide the full name of each guest in your group:", LM, y);
  y += 16;

  // Guest table
  const allGuests = data.guests;
  const half = Math.ceil(allGuests.length / 2);
  const leftGuests = allGuests.slice(0, half);
  const rightGuests = allGuests.slice(half);

  const guestRows: string[][] = [];
  const minRows = Math.max(leftGuests.length, 6);
  for (let i = 0; i < minRows; i++) {
    const left = leftGuests[i];
    const right = rightGuests[i];
    guestRows.push([
      left?.first_name || "-",
      left?.last_name || "-",
      left ? (left.age_group === "under_21" ? "Yes" : left.age_group === "infant" ? "Infant" : "-") : "-",
      right?.first_name || "-",
      right?.last_name || "-",
      right ? (right.age_group === "under_21" ? "Yes" : right.age_group === "infant" ? "Infant" : "-") : "-",
    ]);
  }

  y = drawTable(
    doc, LM, y,
    ["First Name", "Last Name", "Under 21?", "First Name", "Last Name", "Under 21?"],
    guestRows,
    [90, 90, 55, 90, 90, 55]
  );
  y += 14;

  // Bullet notes
  doc.font("Helvetica").fontSize(9).fillColor("#000");
  doc.list([
    "If the length of stay of a Tenant will exceed twenty-nine (29) days, do not complete this form. Please submit the Long-term Tenant Registration Form. A copy of the Long-term Tenant Registration Form can be found at www.pepoa.org",
    "Tenants violating PEPOA governing documents, including but not limited to the rules and regulations, copies of which are available on our website (www.pepoa.org), may be cited for such violations.",
  ], LM + 10, y, { width: PW - 20, bulletRadius: 2, textIndent: 14, lineGap: 4 });
}

// ---------- Page 2: Animals & Vehicles & Admin ----------

function drawPage2(doc: PDFKit.PDFDocument, data: PEPOAData) {
  let y = 50;

  // REGISTERED ANIMALS
  doc.font("Helvetica-Bold").fontSize(16).fillColor(DARK);
  doc.text("REGISTERED ANIMALS", LM, y, { width: PW, align: "center" });
  y += 28;

  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(
    "Copies of vaccinations (rabies and distemper) must be provided for each animal, and they must be registered with PEPOA upon check-in.",
    LM, y, { width: PW }
  );
  y += 30;

  // List pets (text only — images go to appendix)
  if (data.pets.length > 0) {
    for (const pet of data.pets) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(`${pet.name}`, LM, y, { continued: true });
      doc.font("Helvetica").text(` — ${pet.kind}`);
      y += 14;

      const docs: string[] = [];
      if (pet.rabies_doc_path) docs.push("Rabies certificate attached");
      if (pet.vaccination_doc_path) docs.push("Vaccination records attached");
      if (docs.length > 0) {
        doc.font("Helvetica").fontSize(9).fillColor("#555").text(docs.join("  |  "), LM + 12, y);
        y += 14;
      }
      y += 4;
    }
  }

  y += 20;

  // TENANT VEHICLE INFORMATION
  doc.font("Helvetica-Bold").fontSize(16).fillColor(DARK);
  doc.text("TENANT VEHICLE INFORMATION", LM, y, { width: PW, align: "center" });
  y += 28;

  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(
    `Tenants and registered occupants listed on page 1 of this form that are driving vehicles must present requested information to obtain a "Gate Entrance Pass". This pass must be displayed on the dashboard at all times during the term of the tenancy. Tenants and guests of Tenants not displaying a valid Gate Entrance Pass may be stopped and denied access until proof of authority to enter the Community is provided.`,
    LM, y, { width: PW }
  );
  y = doc.y + 16;

  doc.text(
    `If the driver and vehicle information is not yet available, please enter "TBD" for the make and model info below. You may update the form at a later date closer to your reservation. You may also register vehicle info at the gate if the driver is listed as a registered occupant.`,
    LM, y, { width: PW }
  );
  y = doc.y + 16;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000");
  doc.text("Please provide driver and vehicle information requested below:", LM, y);
  y += 16;

  // Vehicle table
  const vRows: string[][] = [];
  for (const v of data.vehicles) {
    vRows.push([
      [v.make, v.model].filter(Boolean).join(" ") || "-",
      v.year || "-",
      v.license_plate || "-",
      v.state_or_region || "-",
      v.color || "-",
      v.driver_name || "-",
    ]);
  }
  while (vRows.length < 6) {
    vRows.push(["-", "-", "-", "-", "-", "-"]);
  }

  y = drawTable(
    doc, LM, y,
    ["Make/Model", "Year", "Plate #", "State", "Color", "Driver Name"],
    vRows,
    [100, 50, 75, 55, 60, 95]
  );
  y += 18;

  // Admin disclaimer
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(
    `A Tenant may not be registered or permitted entry into the Community if this form is unaccompanied by the Owner's payment of the applicable tenant registration fee and a signed Annual Owner Certification of Compliance Form is not on file. Also, the Owner of Record must supply an executed copy of the Short-Term Minimum Lease Agreement. Alternatively, if all of the terms of the Short-Term Minimum Lease Agreement are incorporated into a separate lease agreement, the Owner of Record may supply that alternative lease agreement instead.`,
    LM, y, { width: PW }
  );
  y = doc.y + 24;

  // FOR ADMINISTRATIVE USE ONLY
  doc.font("Helvetica-Bold").fontSize(14).fillColor(DARK);
  doc.text("FOR ADMINISTRATIVE USE ONLY", LM, y, { width: PW, align: "center" });
  y += 24;

  doc.strokeColor("#333").lineWidth(1);
  doc.moveTo(LM, y).lineTo(LM + PW, y).stroke();
  y += 18;

  y = drawAdminField(doc, "Received By:", LM, y, PW);
  y = drawAdminField(doc, "Tenant Registration Fee Paid:", LM, y, PW);
  y = drawAdminField(doc, "Lease Received:", LM, y, PW);
}

// ---------- Page 3+: Lease Agreement & Signatures ----------

async function drawPage3AndSignatures(doc: PDFKit.PDFDocument, data: PEPOAData) {
  let y = 50;

  // Entered By (continuation from page 2)
  y = drawAdminField(doc, "Entered By:", LM, y, PW);
  y += 30;

  // MINIMUM LEASE AGREEMENT
  doc.font("Helvetica-Bold").fontSize(16).fillColor(DARK);
  doc.text("MINIMUM LEASE AGREEMENT FOR SHORT TERM RENTAL", LM, y, { width: PW, align: "center" });
  y += 32;

  doc.font("Helvetica").fontSize(10).fillColor("#000");

  const intro = `The terms of this lease agreement (this "Lease") are between the Tenant and the Owner of Record ("Owner") pursuant to the Tenant's Lease of a property from the Owner within Penn Estates POA (the "Association") for twenty-nine (29) days or less. By signing this lease, in addition to the terms below, Tenant agrees to abide by all Association governing documents, including but not limited to the Association Rules and Regulations (collectively, the "Governing Documents") as well as all federal, state, and local laws and regulations (collectively, the "Laws and Regulations"). A copy of the Governing Documents may be viewed on our website at www.pepoa.org.`;

  doc.text(intro, LM, y, { width: PW, lineGap: 3 });
  y = doc.y + 14;

  const clauses = [
    `1. The Owner shall register Tenant and permitted guests of Tenant occupying the property (collectively, the "Occupants") with the Association no less than five (5) days in advance of the rental start date. Registration requires submitting the signed Short term Tenant Registration Form (the "Registration Form") and this lease between the Owner and the Tenant.`,
    `2. By signing this Lease, Tenant agrees to abide by and enforce the terms and conditions of this lease on behalf of all Occupants named on the Registration Form, including, but not limited to, the requirement to abide by all Governing Documents and Laws and Regulations. Only Occupants validly registered are entitled to enter the Community.`,
    `3. Applicable nonrefundable Tenant processing fees must be paid prior to the beginning of the Lease term.`,
    `4. Occupants shall have the privilege of using community facilities and amenities provided the Owner remains a member in good standing with current amenity badge.`,
    `5. Occupants are not permitted at any time to transfer a gate access card or temporary pass to anyone other than the person to whom it was originally issued. Transferring a gate access card or temporary pass to another person and use of such passes by a person other than the one to whom the pass was originally issued shall result in seizure of said gate access card or temporary pass and may result in eviction from the Community.`,
    `6. Tenants and Owners are responsible for all attorney's fees and costs incurred by the Association as a result of any Occupant's violation of the Governing Documents irrespective of whether a suit is instituted. Owners are responsible for fines levied resulting from Tenants' violation of the Governing Documents.`,
    `7. In no event shall it be determined that a landlord/tenant relationship exists between the Association and a Tenant.`,
    `8. Owners may provide a certain number of short-term rental amenity badges for use by Occupants based on local ordinances that govern occupancy of the home.`,
    `9. Security Deposits will be returned within 10 days of checkout if booked directly with Summit Lakeside Properties, or as per the standard platform policies of AirBnB, VRBO, Booking.com, or which ever other marketplace was used to book your reservation, after verification that no damages or incidentals have been incurred. In the event that you are billed for damages or incidentals, an itemized statement of fees will be provided within 5 days.`,
  ];

  for (const clause of clauses) {
    doc.text(clause, LM, y, { width: PW, lineGap: 3 });
    y = doc.y + 10;
  }

  y += 4;
  doc.text(
    `It is understood by our signatures below that all Occupants have reviewed a copy of the Governing Documents [www.pepoa.org] or [www.bluemountainlakeclub.com] and agree to be bound by them at all times, and the information provided on this form is complete and accurate.`,
    LM, y, { width: PW, lineGap: 3 }
  );
  y = doc.y + 10;

  doc.text(
    `In addition, nothing in this lease is intended to negate or override any Laws and Regulations which must be complied with by all Occupants in addition to the Governing Documents.`,
    LM, y, { width: PW, lineGap: 3 }
  );
  y = doc.y + 24;

  // ---------- Signature blocks ----------

  // Check if we need a new page for signatures
  if (y > 550) {
    doc.addPage();
    y = 50;
  }

  const halfW = PW / 2;
  const sigWidth = 200;
  const sigHeight = 60;

  // Tenant: Your Name / Date
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000");
  doc.text("Your Name", LM, y);
  doc.text("Date", LM + halfW, y);
  y += 16;

  doc.font("Helvetica").fontSize(10);
  doc.text(data.guest.full_name, LM, y);
  doc.text(formatDate(data.registration_date), LM + halfW, y);
  y += 22;

  // Tenant: Signature / Date
  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("Signature", LM, y);
  doc.text("Date", LM + halfW, y);
  y += 16;

  // Embed tenant signature
  if (data.tenant_signature_url) {
    const drawn = await embedSignature(doc, "registrations", data.tenant_signature_url, LM, y, sigWidth, sigHeight);
    if (!drawn) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555").text("[Signature on file]", LM, y);
    }
  }
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(formatDate(data.registration_date), LM + halfW, y);
  y += sigHeight + 24;

  // Owner of Record
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000");
  doc.font("Helvetica-BoldOblique").fontSize(11);
  doc.text("Owner of Record", LM, y);
  y += 16;

  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(data.owner.full_name, LM, y, { underline: true });
  doc.font("Helvetica-Bold").fontSize(11).text("Date", LM + halfW, y);
  y += 16;

  doc.font("Helvetica").fontSize(10);
  doc.text(formatDate(data.registration_date), LM + halfW, y);
  y += 26;

  // Owner signature / Date
  if (data.owner.signature_url) {
    const drawn = await embedSignature(doc, "registrations", data.owner.signature_url, LM, y, sigWidth, sigHeight);
    if (!drawn) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555").text("[Owner signature on file]", LM, y);
    }
  } else {
    // Blank signature line
    doc.strokeColor("#666").lineWidth(0.5);
    doc.moveTo(LM, y + 50).lineTo(LM + sigWidth, y + 50).stroke();
  }

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text("Date", LM + halfW, y);
  y += 16;
  doc.font("Helvetica").fontSize(10).text(formatDate(data.registration_date), LM + halfW, y);
}

// ---------- Appendix: Pet Document Image Attachments ----------

function getFileExt(filePath: string): string {
  return (filePath.split(".").pop() || "").toLowerCase();
}

async function drawImageAttachmentPages(doc: PDFKit.PDFDocument, data: PEPOAData) {
  const imageAttachments: { label: string; path: string }[] = [];

  for (const pet of data.pets) {
    if (pet.rabies_doc_path) {
      const ext = getFileExt(pet.rabies_doc_path);
      if (["jpg", "jpeg", "png"].includes(ext)) {
        imageAttachments.push({ label: `${pet.name} — Rabies Certificate`, path: pet.rabies_doc_path });
      }
    }
    if (pet.vaccination_doc_path) {
      const ext = getFileExt(pet.vaccination_doc_path);
      if (["jpg", "jpeg", "png"].includes(ext)) {
        imageAttachments.push({ label: `${pet.name} — Vaccination Records`, path: pet.vaccination_doc_path });
      }
    }
  }

  for (const attachment of imageAttachments) {
    const imgBuf = await fetchStorageFile("pet-documents", attachment.path);
    if (!imgBuf) continue;

    doc.addPage();

    // Attachment header
    doc.font("Helvetica-Bold").fontSize(12).fillColor(DARK);
    doc.text("ATTACHMENT", LM, 40, { width: PW, align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor("#000");
    doc.text(attachment.label, LM, 58, { width: PW, align: "center" });

    try {
      const maxW = PW;
      const maxH = 620;
      doc.image(imgBuf, LM, 82, { fit: [maxW, maxH] });
    } catch {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555");
      doc.text("[Could not embed document image]", LM, 82);
    }
  }
}

// ---------- Merge uploaded PDF pet documents ----------

async function mergePetPdfAttachments(mainPdfBytes: Buffer, data: PEPOAData): Promise<Buffer> {
  const pdfAttachments: { label: string; path: string }[] = [];

  for (const pet of data.pets) {
    if (pet.rabies_doc_path && getFileExt(pet.rabies_doc_path) === "pdf") {
      pdfAttachments.push({ label: `${pet.name} — Rabies Certificate`, path: pet.rabies_doc_path });
    }
    if (pet.vaccination_doc_path && getFileExt(pet.vaccination_doc_path) === "pdf") {
      pdfAttachments.push({ label: `${pet.name} — Vaccination Records`, path: pet.vaccination_doc_path });
    }
  }

  if (pdfAttachments.length === 0) return mainPdfBytes;

  const mergedPdf = await PDFLib.load(mainPdfBytes);

  for (const attachment of pdfAttachments) {
    const pdfBuf = await fetchStorageFile("pet-documents", attachment.path);
    if (!pdfBuf) continue;

    try {
      const attachedPdf = await PDFLib.load(pdfBuf);
      const pages = await mergedPdf.copyPages(attachedPdf, attachedPdf.getPageIndices());
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    } catch {
      // Skip unreadable PDFs
    }
  }

  const finalBytes = await mergedPdf.save();
  return Buffer.from(finalBytes);
}
