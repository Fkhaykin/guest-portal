import { describe, it, expect } from "vitest";
import { petsMissingDocs, formatPetNames } from "./pet-doc-reminders";
import { TEMPLATES, interpolate, portalSectionLink, PORTAL_URL } from "./templates";
import type { PetEntry } from "@/types/database";

const pet = (over: Partial<PetEntry> = {}): PetEntry => ({
  name: "Nico",
  kind: "Hound mix",
  rabies_doc_path: "reg/pet-0-rabies.jpg",
  vaccination_doc_path: "reg/pet-0-vaccination.jpg",
  ...over,
});

describe("petsMissingDocs", () => {
  it("returns nothing when every record is on file", () => {
    expect(petsMissingDocs([pet(), pet({ name: "Luna" })])).toEqual([]);
  });

  it("catches a pet missing either record", () => {
    expect(petsMissingDocs([pet({ rabies_doc_path: null })])).toHaveLength(1);
    expect(petsMissingDocs([pet({ vaccination_doc_path: null })])).toHaveLength(1);
  });

  it("returns only the pets that are short, not the whole list", () => {
    const missing = petsMissingDocs([pet(), pet({ name: "Luna", vaccination_doc_path: null })]);
    expect(missing.map((p) => p.name)).toEqual(["Luna"]);
  });

  it("ignores blank rows and a null pets column", () => {
    expect(petsMissingDocs(null)).toEqual([]);
    expect(petsMissingDocs([pet({ name: "  ", rabies_doc_path: null })])).toEqual([]);
  });
});

describe("formatPetNames", () => {
  it("reads naturally for one, two, and three pets", () => {
    expect(formatPetNames([pet()])).toBe("Nico");
    expect(formatPetNames([pet(), pet({ name: "Luna" })])).toBe("Nico and Luna");
    expect(formatPetNames([pet(), pet({ name: "Luna" }), pet({ name: "Bo" })])).toBe(
      "Nico, Luna and Bo"
    );
  });

  it("never renders an empty subject", () => {
    expect(formatPetNames([])).toBe("your pet");
  });
});

describe("pet_docs_reminder template", () => {
  const vars = {
    guest_name: "Evelyn",
    property_name: "The Lakehouse",
    check_in_date: "Friday, September 11",
    check_out_date: "Sunday, September 13",
    check_in_time: "",
    check_out_time: "",
    pet_names: "Nico",
    portal_link: portalSectionLink("/p/the-lakehouse/update"),
  };

  it("leaves no unreplaced placeholders", () => {
    const subject = interpolate(TEMPLATES.pet_docs_reminder.subject, vars);
    const body = interpolate(TEMPLATES.pet_docs_reminder.body, vars);
    expect(subject).not.toMatch(/\{\{/);
    expect(body).not.toMatch(/\{\{/);
    expect(body).toContain("Nico");
    expect(body).toContain("The Lakehouse");
  });
});

describe("portalSectionLink", () => {
  it("routes through the root lookup, which forwards the guest onward", () => {
    expect(portalSectionLink("/p/the-lakehouse/update")).toBe(
      `${PORTAL_URL}/?redirect=%2Fp%2Fthe-lakehouse%2Fupdate`
    );
  });

  it("encodes the path so it survives as a single query parameter", () => {
    expect(portalSectionLink("/p/a b/update")).not.toContain(" ");
  });
});
