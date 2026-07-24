import { describe, it, expect } from "vitest";
import {
  daysBetween,
  registrationInstructions,
  REGISTRATION_LEAD_DAYS,
  formatMessageDate,
  formatStayRange,
  renderTemplate,
} from "./templates";

describe("formatStayRange", () => {
  it("prints the month and year once for a same-month stay", () => {
    expect(formatStayRange("2026-07-20", "2026-07-24")).toBe("July 20 – 24, 2026");
  });
  it("prints both months but the year once when the stay crosses a month", () => {
    expect(formatStayRange("2026-07-30", "2026-08-03")).toBe("July 30 – August 3, 2026");
  });
  it("prints both years when the stay crosses a year boundary", () => {
    expect(formatStayRange("2026-12-30", "2027-01-02")).toBe(
      "December 30, 2026 – January 2, 2027"
    );
  });
  it("falls back to a single formatted date when checkout is missing", () => {
    expect(formatStayRange("2026-07-20", null)).toBe("Monday, July 20, 2026");
  });
  it("falls back to the check-in date when the range is unparseable", () => {
    expect(formatStayRange("2026-07-20", "not-a-date")).toBe("Monday, July 20, 2026");
  });
});

describe("formatMessageDate", () => {
  it("renders a friendly Eastern-time date, never a raw YYYY-MM-DD", () => {
    expect(formatMessageDate("2026-07-20")).toBe("Monday, July 20, 2026");
  });
  it("does not roll the calendar day backward (noon-UTC anchor)", () => {
    // A midnight-UTC parse would render as July 19 in Eastern; this must not.
    expect(formatMessageDate("2026-07-20")).toContain("July 20");
  });
  it("accepts a full ISO timestamp", () => {
    expect(formatMessageDate("2026-12-25T00:00:00")).toBe("Friday, December 25, 2026");
  });
  it("returns empty string for missing dates", () => {
    expect(formatMessageDate(null)).toBe("");
    expect(formatMessageDate(undefined)).toBe("");
    expect(formatMessageDate("")).toBe("");
  });
  it("returns the raw input rather than 'Invalid Date' when unparseable", () => {
    expect(formatMessageDate("not-a-date")).toBe("not-a-date");
  });
});

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-07-15", "2026-07-20")).toBe(5);
  });
  it("is 0 for the same day", () => {
    expect(daysBetween("2026-07-15", "2026-07-15")).toBe(0);
  });
  it("is negative for past dates", () => {
    expect(daysBetween("2026-07-15", "2026-07-14")).toBe(-1);
  });
  it("ignores any time component on the target", () => {
    expect(daysBetween("2026-07-15", "2026-07-18T14:30:00")).toBe(3);
  });
  it("returns null for missing or unparseable dates", () => {
    expect(daysBetween("2026-07-15", null)).toBeNull();
    expect(daysBetween("2026-07-15", "")).toBeNull();
    expect(daysBetween("2026-07-15", "not-a-date")).toBeNull();
  });
});

describe("registrationInstructions", () => {
  it("uses the standard 5-day ask when booked well in advance", () => {
    const line = registrationInstructions(10);
    expect(line).toContain(`at least ${REGISTRATION_LEAD_DAYS} days before check-in`);
    expect(line).not.toMatch(/rush|as soon as possible/i);
  });
  it("uses the standard ask at exactly the lead-day boundary", () => {
    expect(registrationInstructions(REGISTRATION_LEAD_DAYS)).toContain("at least");
  });
  it("switches to the rush ASAP ask inside the window", () => {
    const line = registrationInstructions(REGISTRATION_LEAD_DAYS - 1);
    expect(line).toMatch(/as soon as possible/i);
    expect(line).toMatch(/rush-processed/i);
    expect(line).toMatch(/last-minute/i);
  });
  it("uses the rush ask for same-day and past bookings", () => {
    expect(registrationInstructions(0)).toMatch(/as soon as possible/i);
    expect(registrationInstructions(-2)).toMatch(/as soon as possible/i);
  });
  it("falls back to the standard ask when the day count is unknown", () => {
    expect(registrationInstructions(null)).toContain("at least");
  });
});

describe("booking_confirmation render", () => {
  const baseVars = {
    guest_name: "Sam",
    property_name: "Lakehouse",
    check_in_date: "Monday, July 20, 2026",
    check_out_date: "Friday, July 24, 2026",
    stay_dates: formatStayRange("2026-07-20", "2026-07-24"),
    portal_link: "https://guest.summitlakeside.com",
  };

  it("embeds the standard registration line for advance bookings", () => {
    const { body } = renderTemplate("booking_confirmation", {
      ...baseVars,
      registration_instructions: registrationInstructions(10),
    });
    expect(body).toContain("at least 5 days before check-in");
    expect(body).toContain("https://guest.summitlakeside.com");
  });

  it("shows the compact stay range, not a raw date or repeated month", () => {
    const { body } = renderTemplate("booking_confirmation", {
      ...baseVars,
      registration_instructions: registrationInstructions(10),
    });
    expect(body).toContain("July 20 – 24, 2026");
    expect(body).not.toContain("2026-07-20");
  });

  it("embeds the rush registration line for last-minute bookings", () => {
    const { body } = renderTemplate("booking_confirmation", {
      ...baseVars,
      registration_instructions: registrationInstructions(2),
    });
    expect(body).toMatch(/rush-processed/i);
    expect(body).not.toContain("at least 5 days");
  });
});
