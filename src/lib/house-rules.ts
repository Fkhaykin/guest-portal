import {
  Ban,
  CigaretteOff,
  Clock,
  IdCard,
  Moon,
  PawPrint,
  Sailboat,
  Users,
  type LucideIcon,
} from "lucide-react";

export type HouseRule = {
  icon: LucideIcon;
  rule: string;
  detail: string;
  href: string;
  section: string;
};

/* The eight rules that answer 90% of guest questions, linked to their
   full sections on /rental-policies. Shared by the policies page and the
   in-house kiosk. */
export const QUICK_RULES: HouseRule[] = [
  { icon: Clock, rule: "Check-in 4 PM · check-out 11 AM", detail: "Early or late only with written approval.", href: "#checkin", section: "09" },
  { icon: IdCard, rule: "21+ to book — and stays on-site", detail: "Valid ID required before access codes go out.", href: "#eligibility", section: "03" },
  { icon: Ban, rule: "No parties. Ever.", detail: "$2,500 minimum fee and immediate removal.", href: "#parties", section: "13" },
  { icon: Moon, rule: "Quiet hours 10 PM – 8 AM", detail: "Noise sensors alert us before neighbors do.", href: "#noise", section: "14" },
  { icon: PawPrint, rule: "Dogs welcome — two max", detail: "$100 per dog per stay. Cats can't come.", href: "#pets", section: "19" },
  { icon: Users, rule: "Day guests count toward occupancy", detail: "The township counts every person the same.", href: "#visitors", section: "11" },
  { icon: CigaretteOff, rule: "No smoking indoors", detail: "$500 minimum remediation fee.", href: "#smoking", section: "15" },
  { icon: Sailboat, rule: "Flip the boats after use", detail: "A hull left full of rainwater is a $200 fine.", href: "#watercraft", section: "22" },
];
