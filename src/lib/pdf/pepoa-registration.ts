import PDFDocument from "pdfkit";
import { createAdminClient } from "@/lib/supabase/admin";

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

type TableOptions = {
  headerBg?: string;
  fontSize?: number;
  headerFontSize?: number;
  rowHeight?: number;
};

function drawTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  headers: string[],
  rows: string[][],
  colWidths: number[],
  opts: TableOptions = {}
): number {
  const fontSize = opts.fontSize ?? 9;
  const headerFontSize = opts.headerFontSize ?? 9;
  const rowHeight = opts.rowHeight ?? 22;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  doc.save();
  doc.rect(x, y, tableWidth, rowHeight).fill("#f0f0f0").stroke("#999");

  let cx = x;
  doc.font("Helvetica-Bold").fontSize(headerFontSize).fillColor("#333");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cx + 4, y + 6, { width: colWidths[i] - 8, align: "left" });
    cx += colWidths[i];
  }

  // Draw header cell borders
  cx = x;
  doc.strokeColor("#999").lineWidth(0.5);
  for (let i = 0; i < headers.length; i++) {
    doc.rect(cx, y, colWidths[i], rowHeight).stroke();
    cx += colWidths[i];
  }
  doc.restore();

  // Data rows
  let ry = y + rowHeight;
  doc.font("Helvetica").fontSize(fontSize).fillColor("#000");
  for (const row of rows) {
    cx = x;
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i] || "-", cx + 4, ry + 6, { width: colWidths[i] - 8, align: "left" });
      cx += colWidths[i];
    }
    // Cell borders
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

function drawLabelField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width?: number): number {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text(label, x, y);
  const labelWidth = doc.widthOfString(label);
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  doc.text(value || "", x + labelWidth + 4, y, { width: width ? width - labelWidth - 4 : undefined });
  return y + 16;
}

function drawUnderlinedField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, fieldWidth: number): number {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text(label, x, y);
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  const labelW = doc.widthOfString(label) + 4;
  doc.text(value || "", x + labelW, y, { width: fieldWidth - labelW, underline: false });
  doc.moveTo(x + labelW, y + 13).lineTo(x + fieldWidth, y + 13).strokeColor("#666").lineWidth(0.5).stroke();
  return y + 20;
}

// ---------- Main Generator ----------

export async function generatePEPOARegistrationPDF(data: PEPOAData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "letter", margins: { top: 50, bottom: 50, left: 55, right: 55 } });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // ===== PAGE 1: Registration Form =====
  drawPage1(doc, data);

  // ===== PAGE 2: Animals & Vehicles =====
  doc.addPage();
  await drawPage2(doc, data);

  // ===== PAGE 3: Lease Agreement =====
  doc.addPage();
  drawPage3(doc);

  // ===== PAGE 4: Signatures =====
  doc.addPage();
  await drawPage4(doc, data);

  doc.end();
  return finished;
}

// ---------- Page Renderers ----------

function drawPage1(doc: PDFKit.PDFDocument, data: PEPOAData) {
  const pw = 500; // usable page width
  const lm = 55; // left margin

  // Header
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#2c3e50");
  doc.text("PENN ESTATES PROPERTY OWNERS ASSOCIATION", lm, 40, { width: pw, align: "center" });
  doc.font("Helvetica").fontSize(8).fillColor("#555");
  doc.text("304 Cricket Dr. E. Stroudsburg, PA 18301", lm, 56, { width: pw, align: "center" });
  doc.text("P: 570.421.4265  F: 570.421.1092", lm, 66, { width: pw, align: "center" });

  // Title bar
  doc.save();
  doc.roundedRect(lm, 82, pw, 28, 4).fill("#2c3e50");
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#fff");
  doc.text("SHORT-TERM TENANT REGISTRATION FORM AND LEASE", lm, 90, { width: pw, align: "center" });
  doc.restore();

  doc.font("Helvetica").fontSize(7).fillColor("#555");
  doc.text("Form must be filled out completely and shall be submitted at least three (3) days in advance of registration", lm, 115, { width: pw, align: "center" });

  let y = 135;

  // Date
  y = drawUnderlinedField(doc, "Date", formatDate(data.registration_date), lm, y, pw);
  y += 6;

  // Owner info
  y = drawUnderlinedField(doc, "Owner of Record:", data.owner.full_name, lm, y, pw);
  y += 2;
  y = drawUnderlinedField(doc, "Mailing Address:", data.owner.mailing_address, lm, y, pw);
  y += 2;

  const halfW = pw / 2;
  drawUnderlinedField(doc, "Owner's Home No:", formatPhone(data.owner.phone), lm, y, halfW);
  y = drawUnderlinedField(doc, "Owner's Business No:", formatPhone(data.owner.phone), lm + halfW, y, halfW);
  y += 2;

  drawUnderlinedField(doc, "Cell No:", formatPhone(data.owner.phone), lm, y, halfW);
  y = drawUnderlinedField(doc, "Email Address:", data.owner.email, lm + halfW, y, halfW);
  y += 8;

  // Lot/Section
  y = drawUnderlinedField(doc, "Lot/Section:", data.property.lot_section, lm, y, 200);
  y += 4;

  // Lease dates
  drawUnderlinedField(doc, "Lease Start Date:", formatDate(data.lease_start), lm, y, halfW);
  y = drawUnderlinedField(doc, "Lease Expiration Date:", formatDate(data.lease_end), lm + halfW, y, halfW);
  y += 4;

  // Guest info
  y = drawUnderlinedField(doc, "Registered Guest:", data.guest.full_name, lm, y, pw);
  y += 2;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text("Current Mailing Address:", lm, y);
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  const addrLines = (data.guest.mailing_address || "").split("\n");
  const addrX = lm + doc.widthOfString("Current Mailing Address:") + 8;
  for (const line of addrLines) {
    doc.text(line, addrX, y);
    y += 13;
  }
  y += 2;

  drawUnderlinedField(doc, "Guest Home No:", formatPhone(data.guest.phone), lm, y, halfW);
  y = drawUnderlinedField(doc, "Guest Cell No:", formatPhone(data.guest.phone), lm + halfW, y, halfW);
  y += 10;

  // Guest list table
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
  doc.text("Please provide the full name of each guest in your group:", lm, y);
  y += 16;

  // Build rows — 2 guests per row (left columns + right columns)
  const guestRows: string[][] = [];
  const allGuests = data.guests;
  const half = Math.ceil(allGuests.length / 2);
  const leftGuests = allGuests.slice(0, half);
  const rightGuests = allGuests.slice(half);

  for (let i = 0; i < Math.max(leftGuests.length, 6); i++) {
    const left = leftGuests[i];
    const right = rightGuests[i];
    guestRows.push([
      left?.first_name || "-",
      left?.last_name || "-",
      left ? (left.age_group === "under_21" ? "Under 21" : left.age_group === "infant" ? "Infant" : "-") : "-",
      right?.first_name || "-",
      right?.last_name || "-",
      right ? (right.age_group === "under_21" ? "Under 21" : right.age_group === "infant" ? "Infant" : "-") : "-",
    ]);
  }

  drawTable(doc, lm, y,
    ["First Name", "Last Name", "Age Group", "First Name", "Last Name", "Age Group"],
    guestRows,
    [90, 90, 55, 90, 90, 55]
  );
}

async function drawPage2(doc: PDFKit.PDFDocument, data: PEPOAData) {
  const pw = 500;
  const lm = 55;
  let y = 50;

  // Registered Animals
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#2c3e50");
  doc.text("REGISTERED ANIMALS", lm, y, { width: pw, align: "center" });
  y += 22;

  doc.font("Helvetica").fontSize(9).fillColor("#000");
  doc.text(
    "Copies of vaccinations (rabies and distemper) must be provided for each animal, and they must be registered with PEPOA upon check-in.",
    lm, y, { width: pw }
  );
  y += 28;

  if (data.pets.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9).text("No pets registered.", lm, y);
    y += 20;
  } else {
    for (const pet of data.pets) {
      doc.font("Helvetica-Bold").fontSize(9).text(`${pet.name}`, lm, y);
      doc.font("Helvetica").text(` — ${pet.kind}`, lm + doc.widthOfString(pet.name) + 4, y);
      y += 14;

      const docs: string[] = [];
      if (pet.rabies_doc_path) docs.push("Rabies certificate on file");
      if (pet.vaccination_doc_path) docs.push("Vaccination records on file");
      if (docs.length > 0) {
        doc.font("Helvetica").fontSize(8).fillColor("#555").text(docs.join("  |  "), lm + 10, y);
        y += 12;
      }

      // Embed pet doc images if they are images
      for (const docPath of [pet.rabies_doc_path, pet.vaccination_doc_path]) {
        if (!docPath) continue;
        const ext = docPath.split(".").pop()?.toLowerCase();
        if (ext && ["jpg", "jpeg", "png"].includes(ext)) {
          const imgBuf = await fetchStorageFile("pet-documents", docPath);
          if (imgBuf) {
            try {
              doc.image(imgBuf, lm + 10, y, { width: 140 });
              y += 110;
            } catch {
              // skip if image can't be embedded
            }
          }
        }
      }
      y += 6;
    }
  }

  y += 10;

  // Vehicles
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#2c3e50");
  doc.text("TENANT VEHICLE INFORMATION", lm, y, { width: pw, align: "center" });
  y += 22;

  doc.font("Helvetica").fontSize(9).fillColor("#000");
  doc.text(
    "Tenants and registered occupants listed on page 1 of this form that are driving vehicles must present requested information to obtain a \"Gate Entrance Pass\". This pass must be displayed on the dashboard at all times during the term of the tenancy.",
    lm, y, { width: pw }
  );
  y += 38;

  doc.text(
    "Please provide driver and vehicle information requested below:",
    lm, y, { width: pw }
  );
  y += 16;

  // Vehicle table
  const vRows: string[][] = [];
  for (const v of data.vehicles) {
    vRows.push([
      [v.make, v.model].filter(Boolean).join(" "),
      v.year || "-",
      v.license_plate || "-",
      v.state_or_region || "-",
      v.color || "-",
      v.driver_name || "-",
    ]);
  }
  // Pad to 6 rows
  while (vRows.length < 6) {
    vRows.push(["-", "-", "-", "-", "-", "-"]);
  }

  y = drawTable(doc, lm, y,
    ["Make/Model", "Year", "Plate #", "State", "Color", "Driver Name"],
    vRows,
    [100, 50, 75, 50, 60, 100]
  );

  y += 20;

  // Admin use section
  doc.font("Helvetica").fontSize(8).fillColor("#555");
  doc.text(
    "A Tenant may not be registered or permitted entry into the Community if this form is unaccompanied by the Owner's payment of the applicable tenant registration fee and a signed Annual Owner Certification of Compliance Form is not on file.",
    lm, y, { width: pw }
  );
  y += 30;

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#2c3e50");
  doc.text("FOR ADMINISTRATIVE USE ONLY", lm, y, { width: pw, align: "center" });
  y += 20;

  doc.strokeColor("#333").lineWidth(1);
  doc.moveTo(lm, y).lineTo(lm + pw, y).stroke();
  y += 14;

  const adminFields = [
    "Received By:",
    "Tenant Registration Fee Paid:",
    "Lease Received:",
    "Entered By:",
  ];
  for (const field of adminFields) {
    doc.font("Helvetica").fontSize(9).fillColor("#000");
    doc.text(field, lm, y);
    const fw = doc.widthOfString(field);
    doc.moveTo(lm + fw + 4, y + 12).lineTo(lm + 220, y + 12).stroke();
    doc.text("Date Received:", lm + 250, y);
    doc.moveTo(lm + 330, y + 12).lineTo(lm + pw, y + 12).stroke();
    y += 22;
  }
}

function drawPage3(doc: PDFKit.PDFDocument) {
  const pw = 500;
  const lm = 55;
  let y = 50;

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#2c3e50");
  doc.text("MINIMUM LEASE AGREEMENT FOR SHORT TERM RENTAL", lm, y, { width: pw, align: "center" });
  y += 24;

  doc.font("Helvetica").fontSize(9).fillColor("#000");

  const intro = `The terms of this lease agreement (this "Lease") are between the Tenant and the Owner of Record ("Owner") pursuant to the Tenant's Lease of a property from the Owner within Penn Estates POA (the "Association") for twenty-nine (29) days or less. By signing this lease, in addition to the terms below, Tenant agrees to abide by all Association governing documents, including but not limited to the Association Rules and Regulations (collectively, the "Governing Documents") as well as all federal, state, and local laws and regulations (collectively, the "Laws and Regulations"). A copy of the Governing Documents may be viewed on our website at www.pepoa.org.`;

  doc.text(intro, lm, y, { width: pw, lineGap: 2 });
  y = doc.y + 12;

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
    doc.text(clause, lm, y, { width: pw, lineGap: 2 });
    y = doc.y + 8;
  }

  y += 4;
  doc.text(
    `It is understood by our signatures below that all Occupants have reviewed a copy of the Governing Documents (www.pepoa.org) and agree to be bound by them at all times, and the information provided on this form is complete and accurate.`,
    lm, y, { width: pw, lineGap: 2 }
  );
  y = doc.y + 6;

  doc.text(
    `In addition, nothing in this lease is intended to negate or override any Laws and Regulations which must be complied with by all Occupants in addition to the Governing Documents.`,
    lm, y, { width: pw, lineGap: 2 }
  );
}

async function drawPage4(doc: PDFKit.PDFDocument, data: PEPOAData) {
  const pw = 500;
  const lm = 55;
  let y = 50;
  const halfW = pw / 2;

  // Tenant signature block
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000");
  doc.text("Your Name", lm, y);
  doc.text("Date", lm + halfW, y);
  y += 14;

  doc.font("Helvetica").fontSize(10);
  doc.text(data.guest.full_name, lm, y);
  doc.text(formatDate(data.registration_date), lm + halfW, y);
  y += 24;

  doc.font("Helvetica-Bold").fontSize(10).text("Signature", lm, y);
  doc.text("Date", lm + halfW, y);
  y += 14;

  // Embed tenant signature
  if (data.tenant_signature_url) {
    const sigBuf = await fetchStorageFile("registrations", data.tenant_signature_url);
    if (sigBuf) {
      try {
        doc.image(sigBuf, lm, y, { width: 180, height: 70 });
      } catch {
        doc.font("Helvetica-Oblique").fontSize(9).text("[Signature on file]", lm, y);
      }
    }
  }
  doc.font("Helvetica").fontSize(10).text(formatDate(data.lease_end), lm + halfW, y);
  y += 80;

  // Divider
  y += 10;
  doc.font("Helvetica-Bold").fontSize(10).text("Date", lm + halfW, y);
  y += 14;
  doc.font("Helvetica").text(formatDate(data.registration_date), lm + halfW, y);
  y += 24;

  // Owner signature block
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#c00");
  doc.text("Owner of Record", lm, y);
  doc.fillColor("#000");
  doc.text("Date", lm + halfW, y);
  y += 14;

  doc.font("Helvetica").fontSize(10);
  doc.text(data.owner.full_name, lm, y);
  doc.text(formatDate(data.registration_date), lm + halfW, y);
  y += 14;

  // Embed owner signature
  if (data.owner.signature_url) {
    const ownerSigBuf = await fetchStorageFile("registrations", data.owner.signature_url);
    if (ownerSigBuf) {
      try {
        doc.image(ownerSigBuf, lm, y, { width: 180, height: 70 });
      } catch {
        doc.font("Helvetica-Oblique").fontSize(9).text("[Owner signature on file]", lm, y);
      }
    }
  } else {
    // Leave blank line for manual signing
    doc.moveTo(lm, y + 50).lineTo(lm + 200, y + 50).strokeColor("#666").lineWidth(0.5).stroke();
  }
}
