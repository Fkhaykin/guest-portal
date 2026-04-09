import PDFDocument from "pdfkit";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import fs from "fs";
import path from "path";

// ---------- Types ----------

export type BMLCData = {
  owner: {
    full_name: string;
    street_address: string;
    mailing_address: string;
    phone: string;
    signature_url: string | null;
  };
  emergency: {
    contact_name: string;
    relationship: string;
    phone: string;
    phone_2: string;
  };
  rental_agent: {
    enabled: boolean;
    agency_name: string;
    agency_contact: string;
  };
  property: {
    lot_number: string;
    rental_address: string;
  };
  lease_start: string;
  lease_end: string;
  guest: {
    full_name: string;
    mailing_address: string;
    phone: string;
    phone_2: string;
  };
  guests: Array<{ first_name: string; last_name: string; age_group: "over_21" | "under_21" | "infant" }>;
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

const LM = 55;
const PW = 500;
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

  // Header row
  doc.save();
  doc.rect(x, y, tableWidth, rowHeight).fill("#f0f0f0");
  doc.restore();

  let cx = x;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cx + 2, y + 6, { width: colWidths[i] - 4, align: "center" });
    cx += colWidths[i];
  }

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
      doc.text(row[i] || "", cx + 2, ry + 6, { width: colWidths[i] - 4, align: "center" });
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
    const imgPath = path.join(process.cwd(), "public", "BML-logo.png");
    if (fs.existsSync(imgPath)) {
      return fs.readFileSync(imgPath);
    }
  } catch {
    // ignore
  }
  return null;
}

// ---------- Main Generator ----------

export async function generateBMLCRegistrationPDF(data: BMLCData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "letter", margins: { top: 40, bottom: 50, left: LM, right: LM } });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Page 1: Owner Registration Form
  await drawPage1(doc, data);

  // Page 2: Rental Information
  doc.addPage();
  await drawPage2(doc, data);

  doc.end();
  return finished;
}

// ---------- Page 1: Short Term Rental Registration Form ----------

async function drawPage1(doc: PDFKit.PDFDocument, data: BMLCData) {
  let y = 36;

  // Header logo
  const headerImg = tryLoadHeaderImage();
  if (headerImg) {
    try {
      doc.image(headerImg, LM + (PW - 120) / 2, y, { width: 120 });
      y += 80;
    } catch {
      // skip logo
    }
  }

  // Title
  doc.font("Helvetica-Bold").fontSize(16).fillColor(DARK);
  doc.text("SHORT TERM RENTAL REGISTRATION FORM", LM, y, { width: PW, align: "center" });
  y += 28;

  // Intro paragraph
  doc.font("Helvetica").fontSize(9.5).fillColor("#000");
  doc.text(
    `Property owners who rent their homes are required to complete this form and return it to the Association along with a copy of the short term rental agreement, and payment of the rental fee in the amount of $145.00 for each rental booked. Please send the rental agreement and payment to: Blue Mountain Lake Club, 121 Pocahontas Rd., East Stroudsburg, PA 18301. Email Yvonnet@preferredmanagement.org phone: 570-421-2129`,
    LM, y, { width: PW, lineGap: 2, align: "center" }
  );
  y = doc.y + 20;

  // Owner info fields
  const halfW = PW / 2;

  drawUnderlinedField(doc, "Deeded Owner Name(s):", data.owner.full_name, LM, y, PW - 80);
  doc.font("Helvetica").fontSize(10).fillColor("#000").text("Lot #:", LM + PW - 75, y);
  doc.text(data.property.lot_number || "", LM + PW - 40, y, { underline: true });
  y += 18;

  y = drawUnderlinedField(doc, "Street Address:", data.property.rental_address, LM, y, PW);
  y = drawUnderlinedField(doc, "Mailing Address:", data.owner.mailing_address, LM, y, PW);

  drawUnderlinedField(doc, "Cell Phone:", formatPhone(data.owner.phone), LM, y, halfW);
  y = drawUnderlinedField(doc, "Home Phone:", formatPhone(data.owner.phone), LM + halfW, y, halfW);

  drawUnderlinedField(doc, "Emergency Contact:", data.emergency.contact_name, LM, y, halfW);
  y = drawUnderlinedField(doc, "Relationship:", data.emergency.relationship, LM + halfW, y, halfW);

  drawUnderlinedField(doc, "Emergency Phone:", formatPhone(data.emergency.phone), LM, y, halfW);
  y = drawUnderlinedField(doc, "Other Phone:", data.emergency.phone_2 ? formatPhone(data.emergency.phone_2) : "", LM + halfW, y, halfW);
  y += 8;

  // Rental Agent
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  const agentYes = data.rental_agent.enabled ? "[X]" : "[  ]";
  const agentNo = data.rental_agent.enabled ? "[  ]" : "[X]";
  doc.text(`Rental Agent: ${agentYes} Yes   ${agentNo} NO`, LM, y);
  y += 14;

  if (data.rental_agent.enabled) {
    doc.font("Helvetica-Oblique").fontSize(8.5).text("(If yes please provide name, address and phone#)", LM, y);
    y += 14;
    y = drawUnderlinedField(doc, "Rental Agency:", data.rental_agent.agency_name, LM, y, PW);
    y = drawUnderlinedField(doc, "Contact:", data.rental_agent.agency_contact, LM, y, PW);
  }

  y += 10;

  // Agreement text
  doc.font("Helvetica").fontSize(9).fillColor("#000");
  doc.text(
    `By signing below, I confirm that the mailing address provided is correct and will be used to update my account records. I understand that while I lease my property, I am not entitled to use the recreational facilities. I understand that my assessments must be current and that the account must remain in good standing for my short term tenants to be able to obtain amenity badges for any of the recreation facilities. By registering, the short term tenants and the members of his/her household named understand they are bound by the Association\u2019s Governing Documents and Rules and Regulations. By authorizing their use, I AGREE THAT I AM PERSONALLY RESPONSIBLE for their compliance with the Associations Governing Documents and that I am subject to any action related to the enforcement of these documents.`,
    LM, y, { width: PW, lineGap: 3 }
  );
  y = doc.y + 24;

  const sigWidth = 200;
  const sigHeight = 60;

  // Owner signature
  if (data.owner.signature_url) {
    const drawn = await embedSignature(doc, "registrations", data.owner.signature_url, LM, y, sigWidth, sigHeight);
    if (!drawn) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555").text("[Signature on file]", LM, y);
    }
  } else {
    doc.strokeColor("#666").lineWidth(0.5);
    doc.moveTo(LM, y + sigHeight - 10).lineTo(LM + sigWidth, y + sigHeight - 10).stroke();
  }

  // Date next to signature
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(formatDate(data.registration_date), LM + halfW, y, { underline: true });
  y += sigHeight + 10;

  // Labels
  doc.font("Helvetica").fontSize(8.5).fillColor("#555");
  doc.text("Deeded Owner\u2019s Signature", LM, y);
  doc.text("Date", LM + halfW, y);
}

// ---------- Page 2: Rental Information ----------

async function drawPage2(doc: PDFKit.PDFDocument, data: BMLCData) {
  let y = 40;
  const halfW = PW / 2;

  // Header
  doc.font("Helvetica-Bold").fontSize(14).fillColor(DARK);
  doc.text("BLUE MOUNTAIN LAKE CLUB SHORT TERM", LM, y, { width: PW, align: "center" });
  y += 22;
  doc.fontSize(16);
  doc.text("RENTAL INFORMATION", LM, y, { width: PW, align: "center" });
  y += 26;

  // Separator line
  doc.strokeColor(DARK).lineWidth(1.5);
  doc.moveTo(LM, y).lineTo(LM + PW, y).stroke();
  y += 16;

  // Rental Address
  y = drawBoldLabelField(doc, "Rental Address:", data.property.rental_address, LM, y, PW);
  y += 4;

  // Dates
  drawUnderlinedField(doc, "Arrival Date", formatDate(data.lease_start), LM, y, halfW - 10);
  y = drawUnderlinedField(doc, "Departure Date", formatDate(data.lease_end), LM + halfW, y, halfW);
  y += 4;

  // Renter info
  y = drawBoldLabelField(doc, "Renter Name", data.guest.full_name, LM, y, PW);
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
  y += 6;

  // Phone
  drawBoldLabelField(doc, "Guest Cell No:", formatPhone(data.guest.phone), LM, y, halfW);
  y = drawBoldLabelField(doc, "Guest Phone 2:", data.guest.phone_2 ? formatPhone(data.guest.phone_2) : "", LM + halfW, y, halfW);
  y += 10;

  // Guest list header
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#000");
  doc.text("All Occupants staying during the rental time period (List each person, including yourself)", LM, y, { width: PW, underline: true });
  y += 18;

  // Build guest rows — 2 per row
  const guestRows: string[][] = [];
  const allGuests = data.guests;
  const half = Math.ceil(allGuests.length / 2);
  const leftGuests = allGuests.slice(0, half);
  const rightGuests = allGuests.slice(half);

  const minRows = Math.max(leftGuests.length, 6);
  for (let i = 0; i < minRows; i++) {
    const left = leftGuests[i];
    const right = rightGuests[i];
    guestRows.push([
      left?.first_name || "",
      left?.last_name || "",
      left ? (left.age_group === "under_21" || left.age_group === "infant" ? "\u2713" : "") : "",
      right?.first_name || "",
      right?.last_name || "",
      right ? (right.age_group === "under_21" || right.age_group === "infant" ? "\u2713" : "") : "",
    ]);
  }

  y = drawTable(doc, LM, y,
    ["First Name", "Last Name", "Under 21?", "First Name", "Last Name", "Under 21?"],
    guestRows,
    [90, 90, 55, 90, 90, 55]
  );
  y += 16;

  // VEHICLES
  doc.font("Helvetica-Bold").fontSize(14).fillColor(DARK);
  doc.text("VEHICLES PARKED AT RENTAL", LM, y, { width: PW, align: "center" });
  y += 22;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000");
  doc.text("Please provide driver and vehicle information requested below:", LM, y);
  y += 16;

  const vRows: string[][] = [];
  for (const v of data.vehicles) {
    vRows.push([
      [v.make, v.model].filter(Boolean).join(" ") || "",
      v.year || "",
      v.license_plate || "",
      v.state_or_region || "",
      v.color || "",
      v.driver_name || "",
    ]);
  }
  // Pad to at least 1 row so the table shows
  if (vRows.length === 0) {
    vRows.push(["", "", "", "", "", ""]);
  }

  y = drawTable(doc, LM, y,
    ["Make/Model", "Year", "Plate #", "State", "Color", "Driver Name"],
    vRows,
    [100, 50, 75, 55, 60, 95]
  );
  y += 16;

  // Agreement text
  doc.font("Helvetica").fontSize(9.5).fillColor("#000");
  doc.text(
    "I, the undersigned, have received a copy of the Blue Mountain Lake Club Rules and Regulations and do hereby agree to abide by all the rules and regulations and policies established by the Association.",
    LM, y, { width: PW, lineGap: 2 }
  );
  y = doc.y + 18;

  // Renter signature block
  const sigWidth = 200;
  const sigHeight = 60;

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000");
  doc.text("Renter\u2019s Signature", LM, y);
  doc.text("Date", LM + halfW, y);
  y += 16;

  if (data.tenant_signature_url) {
    const drawn = await embedSignature(doc, "registrations", data.tenant_signature_url, LM, y, sigWidth, sigHeight);
    if (!drawn) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555").text("[Signature on file]", LM, y);
    }
  } else {
    doc.strokeColor("#666").lineWidth(0.5);
    doc.moveTo(LM, y + sigHeight - 10).lineTo(LM + sigWidth, y + sigHeight - 10).stroke();
  }

  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(formatDate(data.registration_date), LM + halfW, y);
  y += sigHeight + 16;

  // Office Use Only
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text("Office Use Only:", LM, y, { continued: true });
  doc.font("Helvetica").fontSize(9);
  doc.text(" Rental fee paid: Yes [  ] No [  ]   Amount: ____   Ch____   MO____   CC____");
  y += 16;
  doc.text("Amenity Passes: ____________    Parking Pass: ____________", LM, y);
}
