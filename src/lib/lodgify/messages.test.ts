import { describe, it, expect } from "vitest";
import { deriveChannel, type LodgifyMessage } from "./messages";

function msg(overrides: Partial<LodgifyMessage>): LodgifyMessage {
  return {
    id: "1",
    message: "hello",
    subject: "",
    type: "Renter",
    created_at: "2026-07-24T14:09:25Z",
    sender_name: "Guest",
    ...overrides,
  };
}

describe("deriveChannel", () => {
  it("prefers an explicit route when any message carries one", () => {
    const messages = [
      msg({ route: null, subject: "vrbo: 3dafa3d0, 07/24/2026 14:09:25" }),
      msg({ id: "2", route: "Airbnb" }),
    ];
    expect(deriveChannel(messages)).toBe("Airbnb");
  });

  it("falls back to the enquiry subject prefix when route is null", () => {
    const messages = [
      msg({ route: null, subject: "vrbo: 3dafa3d0-874c-4d14-a005-16f33ec58c00, 07/24/2026 14:09:25" }),
    ];
    expect(deriveChannel(messages)).toBe("Vrbo");
  });

  it("maps known prefixes case-insensitively to route vocabulary", () => {
    expect(deriveChannel([msg({ subject: "Airbnb: abc, 01/01/2026" })])).toBe("Airbnb");
    expect(deriveChannel([msg({ subject: "HomeAway: abc, 01/01/2026" })])).toBe("Vrbo");
    expect(deriveChannel([msg({ subject: "bookingcom: abc, 01/01/2026" })])).toBe("Booking.com");
  });

  it("never matches ordinary reply subjects", () => {
    expect(deriveChannel([msg({ subject: "Re: question about the lake house" })])).toBeNull();
    expect(deriveChannel([msg({ subject: "Booking question" })])).toBeNull();
    expect(deriveChannel([msg({ subject: "" })])).toBeNull();
  });

  it("returns null when nothing identifies a channel", () => {
    expect(deriveChannel([msg({ route: null, subject: "hello there" })])).toBeNull();
    expect(deriveChannel([])).toBeNull();
  });
});
