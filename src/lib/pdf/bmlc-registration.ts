import PDFDocument from "pdfkit";
import { createAdminClient } from "@/lib/supabase/admin";

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

// ---------- Helpers ----------

async function fetchStorageFile(bucket: string, path: string): Promise<Buffer | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(bucket).download(path);
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
  return phone;
}

function drawUnderlinedField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, fieldWidth: number): number {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text(label, x, y);
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  const labelW = doc.widthOfString(label) + 4;
  doc.text(value || "", x + labelW, y, { width: fieldWidth - labelW, underline: true });
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

  // Header
  doc.save();
  doc.rect(x, y, tableWidth, rowHeight).fill("#f0f0f0").stroke("#999");
  let cx = x;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cx + 4, y + 6, { width: colWidths[i] - 8, align: "left" });
    cx += colWidths[i];
  }
  cx = x;
  doc.strokeColor("#999").lineWidth(0.5);
  for (let i = 0; i < headers.length; i++) {
    doc.rect(cx, y, colWidths[i], rowHeight).stroke();
    cx += colWidths[i];
  }
  doc.restore();

  // Rows
  let ry = y + rowHeight;
  doc.font("Helvetica").fontSize(9).fillColor("#000");
  for (const row of rows) {
    cx = x;
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i] || "", cx + 4, ry + 6, { width: colWidths[i] - 8, align: "left" });
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

// ---------- Main Generator ----------

export async function generateBMLCRegistrationPDF(data: BMLCData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "letter", margins: { top: 40, bottom: 50, left: 55, right: 55 } });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ===== PAGE 1: Owner Registration Form =====
  await drawPage1(doc, data);

  // ===== PAGE 2: Rental Information =====
  doc.addPage();
  await drawPage2(doc, data);

  doc.end();
  return finished;
}

// ---------- Page 1: Short Term Rental Registration Form ----------

async function drawPage1(doc: PDFKit.PDFDocument, data: BMLCData) {
  const pw = 500;
  const lm = 55;

  // Header
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#2c3e50");
  doc.text("SHORT TERM RENTAL REGISTRATION FORM", lm, 50, { width: pw, align: "center" });
  doc.moveDown(0.5);

  doc.font("Helvetica").fontSize(9).fillColor("#000");
  doc.text(
    "Property owners who rent their homes are required to complete this form and return it to the Association along with a copy of the short term rental agreement, and payment of the rental fee in the amount of $145.00 for each rental booked. Please send the rental agreement and payment to: Blue Mountain Lake Club, 121 Pocahontas Rd., East Stroudsburg, PA 18301. Email Yvonnet@preferredmanagement.org phone: 570-421-2129",
    lm, doc.y, { width: pw, lineGap: 2 }
  );

  let y = doc.y + 16;

  // Owner info fields
  const halfW = pw / 2;

  drawUnderlinedField(doc, "Deeded Owner Name(s):", data.owner.full_name, lm, y, pw - 80);
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text("Lot #:", lm + pw - 75, y);
  doc.font("Helvetica").fontSize(10).fillColor("#000").text(data.property.lot_number || "", lm + pw - 40, y, { underline: true });
  y += 18;

  y = drawUnderlinedField(doc, "Street Address:", data.property.rental_address, lm, y, pw);
  y = drawUnderlinedField(doc, "Mailing Address:", data.owner.mailing_address, lm, y, pw);

  drawUnderlinedField(doc, "Cell Phone:", formatPhone(data.owner.phone), lm, y, halfW);
  y = drawUnderlinedField(doc, "Home Phone:", formatPhone(data.owner.phone), lm + halfW, y, halfW);

  drawUnderlinedField(doc, "Emergency Contact:", data.emergency.contact_name, lm, y, halfW);
  y = drawUnderlinedField(doc, "Relationship:", data.emergency.relationship, lm + halfW, y, halfW);

  drawUnderlinedField(doc, "Emergency Phone:", formatPhone(data.emergency.phone), lm, y, halfW);
  y = drawUnderlinedField(doc, "Other Phone:", data.emergency.phone_2 ? formatPhone(data.emergency.phone_2) : "", lm + halfW, y, halfW);
  y += 6;

  // Rental Agent
  doc.font("Helvetica").fontSize(9).fillColor("#000");
  const agentYes = data.rental_agent.enabled ? "[X]" : "[  ]";
  const agentNo = data.rental_agent.enabled ? "[  ]" : "[X]";
  doc.text(`Rental Agent: ${agentYes} Yes   ${agentNo} NO`, lm, y);
  y += 14;

  if (data.rental_agent.enabled) {
    doc.font("Helvetica-Oblique").fontSize(8).text("(If yes please provide name, address and phone#)", lm, y);
    y += 12;
    y = drawUnderlinedField(doc, "Rental Agency:", data.rental_agent.agency_name, lm, y, pw);
    y = drawUnderlinedField(doc, "Contact:", data.rental_agent.agency_contact, lm, y, pw);
  }

  y += 8;

  // Agreement text
  doc.font("Helvetica").fontSize(8.5).fillColor("#000");
  doc.text(
    `By signing below, I confirm that the mailing address provided is correct and will be used to update my account records. I understand that while I lease my property, I am not entitled to use the recreational facilities. I understand that my assessments must be current and that the account must remain in good standing for my short term tenants to be able to obtain amenity badges for any of the recreation facilities. By registering, the short term tenants and the members of his/her household named understand they are bound by the Association's Governing Documents and Rules and Regulations. By authorizing their use, I AGREE THAT I AM PERSONALLY RESPONSIBLE for their compliance with the Associations Governing Documents and that I am subject to any action related to the enforcement of these documents.`,
    lm, y, { width: pw, lineGap: 2 }
  );
  y = doc.y + 20;

  // Owner signature
  if (data.owner.signature_url) {
    const sigBuf = await fetchStorageFile("registrations", data.owner.signature_url);
    if (sigBuf) {
      try {
        doc.image(sigBuf, lm, y, { width: 180, height: 60 });
      } catch {
        doc.font("Helvetica-Oblique").fontSize(8).fillColor("#555").text("[Signature on file]", lm, y);
      }
    }
  } else {
    doc.moveTo(lm, y + 30).lineTo(lm + 200, y + 30).strokeColor("#666").lineWidth(0.5).stroke();
  }

  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(formatDate(data.registration_date), lm + halfW, y);
  y += 40;

  doc.font("Helvetica").fontSize(8).fillColor("#555");
  doc.text("Deeded Owner's Signature", lm, y);
  doc.text("Date", lm + halfW, y);
}

// ---------- Page 2: Rental Information ----------

async function drawPage2(doc: PDFKit.PDFDocument, data: BMLCData) {
  const pw = 500;
  const lm = 55;
  let y = 40;
  const halfW = pw / 2;

  // Header
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#2c3e50");
  doc.text("BLUE MOUNTAIN LAKE CLUB SHORT TERM", lm, y, { width: pw, align: "center" });
  y += 18;
  doc.fontSize(14);
  doc.text("RENTAL INFORMATION", lm, y, { width: pw, align: "center" });
  y += 24;

  // Separator
  doc.strokeColor("#2c3e50").lineWidth(1.5);
  doc.moveTo(lm, y).lineTo(lm + pw, y).stroke();
  y += 12;

  // Rental Address
  y = drawUnderlinedField(doc, "Rental Address:", data.property.rental_address, lm, y, pw);
  y += 4;

  // Dates
  drawUnderlinedField(doc, "Arrival Date", formatDate(data.lease_start), lm, y, halfW);
  y = drawUnderlinedField(doc, "Departure Date", formatDate(data.lease_end), lm + halfW, y, halfW);
  y += 4;

  // Renter info
  y = drawUnderlinedField(doc, "Renter Name", data.guest.full_name, lm, y, pw);
  y += 2;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text("Current Mailing Address:", lm, y);
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  const addrX = lm + doc.widthOfString("Current Mailing Address:") + 8;
  const addrLines = (data.guest.mailing_address || "").split("\n");
  for (const line of addrLines) {
    doc.text(line, addrX, y);
    y += 13;
  }
  y += 4;

  drawUnderlinedField(doc, "Guest Cell No:", formatPhone(data.guest.phone), lm, y, halfW);
  y = drawUnderlinedField(doc, "Guest Phone 2:", data.guest.phone_2 ? formatPhone(data.guest.phone_2) : "", lm + halfW, y, halfW);
  y += 8;

  // Guest list
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
  doc.text("All Occupants staying during the rental time period (List each person, including yourself)", lm, y, { width: pw, underline: true });
  y += 16;

  // Build guest rows — 2 per row
  const guestRows: string[][] = [];
  const allGuests = data.guests;
  const half = Math.ceil(allGuests.length / 2);
  const leftGuests = allGuests.slice(0, half);
  const rightGuests = allGuests.slice(half);

  for (let i = 0; i < Math.max(leftGuests.length, 6); i++) {
    const left = leftGuests[i];
    const right = rightGuests[i];
    guestRows.push([
      left?.first_name || "",
      left?.last_name || "",
      left ? (left.age_group === "under_21" ? "Under 21" : left.age_group === "infant" ? "Infant" : "") : "",
      right?.first_name || "",
      right?.last_name || "",
      right ? (right.age_group === "under_21" ? "Under 21" : right.age_group === "infant" ? "Infant" : "") : "",
    ]);
  }

  y = drawTable(doc, lm, y,
    ["First Name", "Last Name", "Age Group", "First Name", "Last Name", "Age Group"],
    guestRows,
    [90, 90, 55, 90, 90, 55]
  );
  y += 14;

  // Vehicles
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#2c3e50");
  doc.text("VEHICLES PARKED AT RENTAL", lm, y, { width: pw, align: "center" });
  y += 20;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
  doc.text("Please provide driver and vehicle information requested below:", lm, y);
  y += 14;

  const vRows: string[][] = [];
  for (const v of data.vehicles) {
    vRows.push([
      [v.make, v.model].filter(Boolean).join(" "),
      v.year || "",
      v.license_plate || "",
      v.state_or_region || "",
      v.color || "",
      v.driver_name || "",
    ]);
  }
  while (vRows.length < 3) {
    vRows.push(["", "", "", "", "", ""]);
  }

  y = drawTable(doc, lm, y,
    ["Make/Model", "Year", "Plate #", "State", "Color", "Driver Name"],
    vRows,
    [100, 50, 75, 50, 60, 100]
  );
  y += 14;

  // Agreement text
  doc.font("Helvetica").fontSize(9).fillColor("#000");
  doc.text(
    "I, the undersigned, have received a copy of the Blue Mountain Lake Club Rules and Regulations and do hereby agree to abide by all the rules and regulations and policies established by the Association.",
    lm, y, { width: pw, lineGap: 2 }
  );
  y = doc.y + 16;

  // Renter signature
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000");
  doc.text("Renter's Signature", lm, y);
  doc.text("Date", lm + halfW, y);
  y += 14;

  if (data.tenant_signature_url) {
    const sigBuf = await fetchStorageFile("registrations", data.tenant_signature_url);
    if (sigBuf) {
      try {
        doc.image(sigBuf, lm, y, { width: 180, height: 60 });
      } catch {
        doc.font("Helvetica-Oblique").fontSize(9).text("[Signature on file]", lm, y);
      }
    }
  }
  doc.font("Helvetica").fontSize(10).text(formatDate(data.registration_date), lm + halfW, y);
  y += 70;

  // Office use only
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
  doc.text("Office Use Only:", lm, y);
  doc.font("Helvetica").fontSize(8);
  doc.text("Rental fee paid: Yes [  ] No [  ]   Amount: ____   Ch____   MO____   CC____", lm + 80, y);
  y += 14;
  doc.text("Amenity Passes: ____________    Parking Pass: ____________", lm, y);
}
