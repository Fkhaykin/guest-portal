import { AlertTriangle, Phone, Shield, ShieldAlert, type LucideIcon } from "lucide-react";

export interface HelpContact {
  label: string;
  sublabel: string;
  display: string; // human-readable number(s)
  tel: string | null; // first number, digits only, for a tel: link
  icon: LucideIcon;
  tone: "emergency" | "primary" | "normal";
}

function firstTel(display: string): string | null {
  const digits = display.replace(/[^\d]/g, "");
  return digits ? digits.slice(0, 11) : null;
}

// Contact numbers verified July 2026:
//  - Penn Estates Public Safety: (570) 424-7047 (pepoa.org)
//  - Stroud Area Regional Police non-emergency / Monroe County Control: (570) 992-9911
const PE_SECURITY = "(570) 424-7047";
const POLICE_NON_EMERGENCY = "(570) 992-9911";

/** Contacts for the Help card, tailored to the house's community. */
export function helpContacts(
  community: "penn-estates" | "blue-mountain-lake",
  hostPhone: string | null
): HelpContact[] {
  const contacts: HelpContact[] = [
    {
      label: "Emergency",
      sublabel: "Fire · Police · Medical",
      display: "911",
      tel: "911",
      icon: AlertTriangle,
      tone: "emergency",
    },
  ];

  if (hostPhone) {
    contacts.push({
      label: "Your Host",
      sublabel: "Questions about the house",
      display: hostPhone,
      tel: firstTel(hostPhone),
      icon: Phone,
      tone: "primary",
    });
  }

  if (community === "penn-estates") {
    contacts.push({
      label: "Penn Estates Security",
      sublabel: "Gate & community safety",
      display: PE_SECURITY,
      tel: firstTel(PE_SECURITY),
      icon: Shield,
      tone: "normal",
    });
  }

  contacts.push({
    label: "Local Police",
    sublabel: "Non-emergency line",
    display: POLICE_NON_EMERGENCY,
    tel: firstTel(POLICE_NON_EMERGENCY),
    icon: ShieldAlert,
    tone: "normal",
  });

  return contacts;
}
