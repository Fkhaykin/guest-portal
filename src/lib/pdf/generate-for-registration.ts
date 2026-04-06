import { createAdminClient } from "@/lib/supabase/admin";
import { generatePEPOARegistrationPDF, type PEPOAData } from "./pepoa-registration";
import { generateBMLCRegistrationPDF, type BMLCData } from "./bmlc-registration";

type RegistrationData = {
  reg: Record<string, unknown>;
  property: Record<string, unknown>;
  host: Record<string, unknown>;
  guest: Record<string, unknown>;
  vehicles: Array<Record<string, unknown>>;
};

/**
 * Fetch all data needed for PDF generation from a registration ID.
 * Uses admin client (service role) to bypass RLS.
 */
export async function fetchRegistrationData(registrationId: string): Promise<RegistrationData | null> {
  const supabase = createAdminClient();

  const { data: reg, error } = await supabase
    .from("registration")
    .select(`
      *,
      guest:guest_id(*),
      property:property_id(*, host:host_id(*))
    `)
    .eq("id", registrationId)
    .single();

  if (error || !reg) return null;

  const property = reg.property as Record<string, unknown>;
  const host = property.host as Record<string, unknown>;
  const guest = reg.guest as Record<string, unknown>;

  const { data: vehicles } = await supabase
    .from("vehicle")
    .select("*")
    .eq("registration_id", registrationId);

  return { reg, property, host, guest, vehicles: vehicles || [] };
}

/**
 * Generate the correct PDF based on the property's hoa_type.
 */
export async function generateRegistrationPDF(data: RegistrationData): Promise<Buffer> {
  const { reg, property, host, guest, vehicles } = data;
  const hoaType = (property.hoa_type as string) || "pepoa";

  const vehicleList = vehicles.map((v) => ({
    make: (v.make as string) || "",
    model: (v.model as string) || "",
    year: (v.year as string) || "",
    license_plate: (v.license_plate as string) || "",
    state_or_region: (v.state_or_region as string) || "",
    color: (v.color as string) || "",
    driver_name: (v.driver_name as string) || "",
  }));

  if (hoaType === "bmlc") {
    const bmlcData: BMLCData = {
      owner: {
        full_name: (property.owner_name as string) || (host.full_name as string) || "",
        street_address: (property.address as string) || "",
        mailing_address: (property.owner_mailing_address as string) || "",
        phone: (property.owner_phone as string) || "",
        signature_url: (property.owner_signature_url as string) || null,
      },
      emergency: {
        contact_name: (property.emergency_contact_name as string) || "",
        relationship: (property.emergency_contact_relationship as string) || "",
        phone: (property.emergency_contact_phone as string) || "",
        phone_2: (property.emergency_contact_phone_2 as string) || "",
      },
      rental_agent: {
        enabled: (property.rental_agent_enabled as boolean) ?? true,
        agency_name: (property.rental_agency_name as string) || "",
        agency_contact: (property.rental_agency_contact as string) || "",
      },
      property: {
        lot_number: (property.lot_section as string) || "",
        rental_address: (property.address as string) || "",
      },
      lease_start: reg.check_in_date as string,
      lease_end: reg.check_out_date as string,
      guest: {
        full_name: (guest.full_name as string) || "",
        mailing_address: (guest.mailing_address as string) || "",
        phone: (guest.phone as string) || "",
        phone_2: "",
      },
      guests: (reg.guest_list as BMLCData["guests"]) || [],
      vehicles: vehicleList,
      tenant_signature_url: (reg.signature_url as string) || null,
      registration_date: reg.check_in_date as string,
    };
    return generateBMLCRegistrationPDF(bmlcData);
  }

  // Default: PEPOA
  const pepoaData: PEPOAData = {
    owner: {
      full_name: (property.owner_name as string) || (host.full_name as string) || "",
      mailing_address: (property.owner_mailing_address as string) || "",
      phone: (property.owner_phone as string) || "",
      email: (property.owner_email as string) || (host.email as string) || "",
      signature_url: (property.owner_signature_url as string) || null,
    },
    property: {
      lot_section: (property.lot_section as string) || "",
    },
    lease_start: reg.check_in_date as string,
    lease_end: reg.check_out_date as string,
    guest: {
      full_name: (guest.full_name as string) || "",
      mailing_address: (guest.mailing_address as string) || "",
      phone: (guest.phone as string) || "",
    },
    guests: (reg.guest_list as PEPOAData["guests"]) || [],
    pets: (reg.pets as PEPOAData["pets"]) || [],
    vehicles: vehicleList,
    tenant_signature_url: (reg.signature_url as string) || null,
    registration_date: reg.check_in_date as string,
  };
  return generatePEPOARegistrationPDF(pepoaData);
}
