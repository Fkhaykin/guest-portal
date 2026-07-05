import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { AlertTriangle, ArrowRight, Mail, Phone } from "lucide-react";
import { QUICK_RULES } from "@/lib/house-rules";
import {
  ChapterNav,
  HeroMedia,
  ParallaxBand,
  ReadingProgress,
} from "./visuals";

export const metadata = {
  title: "Rental Policies & Terms — Summit Lakeside",
  description:
    "The complete terms, conditions, and house rules for staying at a Summit Lakeside property. Please read carefully before booking.",
};

/* ------------------------------------------------------------------ */
/*  Policy sections                                                    */
/* ------------------------------------------------------------------ */

type PolicySection = {
  id: string;
  number: string;
  title: string;
  paragraphs?: string[];
  items?: { label?: string; body: string }[];
};

const SECTIONS: PolicySection[] = [
  {
    id: "acceptance",
    number: "01",
    title: "Acceptance of These Terms",
    paragraphs: [
      "These Rental Policies and Terms (the \"Agreement\") constitute a legally binding contract between you (the \"Guest,\" \"Renter,\" or \"you\") and Summit Lakeside Rentals, its owners, operators, managers, affiliates, and authorized representatives (collectively, \"Summit Lakeside,\" \"we,\" \"us,\" or \"the Host\"). By booking, reserving, paying for, occupying, or in any manner accessing a Summit Lakeside vacation rental property (each, a \"Property\"), you acknowledge that you have read, understood, and agreed to be bound by every provision of this Agreement in full.",
      "This Agreement applies to every guest, invitee, visitor, child, service provider, contractor, or other person whom the Guest brings onto, or allows onto, the Property during the rental period. The Guest who makes the reservation (the \"Primary Guest\" or \"Lead Guest\") is solely and personally responsible for the conduct of every such person, whether or not that person has read this Agreement.",
      "If you do not agree with any part of this Agreement, you must not book a Property, must not occupy a Property, and must cancel any existing reservation subject to the cancellation terms set forth below. Continued possession of a Property after receipt of this Agreement constitutes acceptance of its terms in their entirety.",
    ],
  },
  {
    id: "definitions",
    number: "02",
    title: "Definitions",
    paragraphs: [
      "The following terms, wherever capitalized in this Agreement, have the meanings set forth below:",
    ],
    items: [
      { label: "Property", body: "The specific vacation rental home, unit, or dwelling reserved by the Guest, including all land, structures, furnishings, fixtures, appliances, outdoor areas, docks, driveways, garages, and shared amenities associated with it." },
      { label: "Rental Period", body: "The dates and times between the scheduled check-in and scheduled check-out of the confirmed reservation." },
      { label: "Rental Fee", body: "The total amount the Guest has agreed to pay, including nightly rate, cleaning fee, pet fee (if any), taxes, service charges, resort or HOA fees, and any add-on purchases." },
      { label: "Security Deposit", body: "An amount held, authorized, or pre-authorized on the Guest's payment method as security against damage, excess cleaning, rule violations, or other recoverable costs." },
      { label: "Authorized Occupants", body: "The exact number and identity of individuals named or counted on the reservation, not exceeding the posted maximum occupancy of the Property." },
      { label: "Visitors", body: "Persons not listed as Authorized Occupants who enter the Property temporarily with the Guest's invitation." },
      { label: "HOA", body: "The homeowners' association, master association, community association, or any similar governing body that has jurisdiction over the Property or the community in which it is located." },
      { label: "House Rules", body: "The specific property-level rules posted in the welcome book, on signage inside the Property, in the pre-arrival email, or on the listing page, which are incorporated into this Agreement by reference." },
    ],
  },
  {
    id: "eligibility",
    number: "03",
    title: "Eligibility, Age, and Identity Requirements",
    paragraphs: [
      "The Primary Guest must be at least twenty-one (21) years of age at the time of booking and must remain physically present at the Property throughout the entirety of the Rental Period. Reservations made on behalf of a person who will not personally occupy the Property, or made by a person under the age of twenty-one, are strictly prohibited and may be cancelled without refund upon discovery.",
      "The Primary Guest must provide a valid government-issued photo identification (driver's license, passport, or state-issued ID), a functional phone number, a functional email address, and a valid payment method in the Primary Guest's own name. We may require additional verification, including selfie verification, address verification, or a credit-card pre-authorization, prior to releasing access credentials to the Property.",
      "Providing false, incomplete, or misleading information (including but not limited to age, identity, guest count, the purpose of the stay, or the presence of pets) is a material breach of this Agreement and will result in immediate termination of the reservation without refund and, where appropriate, referral to law enforcement.",
    ],
  },
  {
    id: "booking",
    number: "04",
    title: "Booking, Confirmation, and Reservation Changes",
    paragraphs: [
      "A reservation is not confirmed until (a) payment has been successfully processed in accordance with the payment schedule set forth below, and (b) the Guest has received a written confirmation from Summit Lakeside identifying the Property, the Rental Period, and the total Rental Fee. Listings, calendars, and third-party platforms may occasionally display availability that is no longer accurate; we reserve the right to decline any reservation request prior to confirmation for any lawful reason.",
      "All requests to modify a reservation (including changes to dates, length of stay, guest count, properties, or add-on services) must be submitted in writing and are subject to availability, seasonal pricing, and any applicable change fees. Modifications are not effective until we acknowledge them in writing. Verbal, text, or social-media approvals are not binding.",
      "We reserve the right, in our sole discretion, to refuse, cancel, reassign, or relocate any reservation where we determine (i) a material misrepresentation was made by the Guest; (ii) the Property has become uninhabitable or unavailable due to damage, maintenance, force majeure, or circumstances beyond our control; or (iii) the intended use of the Property violates this Agreement or applicable law. Where relocation is offered, every reasonable effort will be made to provide a comparable Property; any difference in rate will be refunded or charged as appropriate.",
    ],
  },
  {
    id: "payment",
    number: "05",
    title: "Payment Schedule and Accepted Methods",
    paragraphs: [
      "Unless otherwise specified in writing, the following payment terms apply to all direct bookings:",
    ],
    items: [
      { label: "Full Payment at Booking", body: "The entire Rental Fee, including all taxes and fees, is due in full at the time of booking and is charged immediately to the Guest's payment method. A reservation is not confirmed until the full amount has successfully cleared; until then, the reservation is tentative only. We do not offer partial deposits, installment plans, or pay-at-check-in arrangements." },
      { label: "Authorization Failures", body: "If the Guest's payment method is declined, reversed, or insufficient to cover the full Rental Fee, the reservation will not be held and may be released to other guests without notice." },
      { label: "Accepted Payment Methods", body: "Major credit and debit cards (Visa, MasterCard, American Express, Discover), Apple Pay, Google Pay, and, for long-term bookings of thirty nights or more, ACH bank transfer. Cash, personal checks, cashier's checks, money orders, gift cards, cryptocurrency, and wire transfers from foreign banks are not accepted." },
      { label: "Declines & Chargebacks", body: "If a payment is later reversed or charged back, the Guest agrees to pay a processing fee of fifty dollars ($50) per incident in addition to the original amount owed and any collection costs, attorneys' fees, and interest at the maximum rate permitted by law." },
      { label: "Third-Party Platforms", body: "Reservations made through Airbnb, Vrbo, Booking.com, or other third-party platforms are also governed by that platform's payment terms, which control to the extent they differ from this Section 5." },
    ],
  },
  {
    id: "deposit",
    number: "06",
    title: "Security Deposit and Incidental Charges",
    paragraphs: [
      "A refundable Security Deposit, typically in the range of five hundred dollars ($500) to two thousand dollars ($2,000) depending on the Property and length of stay, may be collected by charge, hold, or pre-authorization on the Guest's payment method prior to check-in. The specific amount is disclosed at the time of booking or in the pre-arrival message.",
      "The Security Deposit secures, without limitation: (a) damage to the Property, its contents, the land, landscaping, docks, or shared community assets; (b) theft or loss of any item belonging to the Property; (c) excess cleaning beyond the standard turnover; (d) smoking fees; (e) unauthorized pet fees; (f) unauthorized occupant or party fees; (g) excess trash removal; (h) unreturned keys, access cards, garage remotes, or key fobs; (i) HOA fines levied as a result of the Guest's conduct; (j) noise-ordinance fines; (k) any other amount recoverable under this Agreement.",
      "Unused portions of the Security Deposit will be released within fourteen (14) business days following the Rental Period, subject to final inspection, supplier invoicing, and, where applicable, HOA review. If the actual damages exceed the Security Deposit, the Guest remains jointly and severally liable with all Authorized Occupants for the excess, which may be charged to the Guest's payment method on file without further notice.",
      "The Guest authorizes Summit Lakeside to charge the Guest's payment method on file for any and all amounts lawfully owed under this Agreement, including incidental charges discovered after departure. This authorization survives the Rental Period.",
    ],
  },
  {
    id: "cancellation",
    number: "07",
    title: "Cancellation and Refund Policy",
    paragraphs: [
      "Our standard cancellation policy is set forth below. This policy applies to cancellations initiated by the Guest. Stricter, non-refundable, or peak-season terms may apply to specific Properties, holiday weeks, or promotional rates; these stricter terms are disclosed at the time of booking and supersede the general policy in this Section.",
    ],
    items: [
      { label: "60+ days before check-in", body: "Full refund of all amounts paid, less a non-refundable processing fee equal to five percent (5%) of the total Rental Fee." },
      { label: "30–59 days before check-in", body: "Fifty percent (50%) refund of the total Rental Fee. Cleaning fees and taxes attributable to the cancelled portion are fully refunded." },
      { label: "14–29 days before check-in", body: "No refund of the Rental Fee. A future-stay credit equal to fifty percent (50%) of the Rental Fee, valid for twelve (12) months, may be issued in our sole discretion." },
      { label: "Less than 14 days before check-in, or no-show", body: "No refund and no future-stay credit. The full Rental Fee is forfeited." },
      { label: "Early departure", body: "If the Guest departs the Property before the scheduled check-out date for any reason other than one caused by Summit Lakeside's gross negligence, no refund is owed for unused nights." },
      { label: "Travel insurance", body: "We strongly recommend the Guest purchase independent travel insurance to protect against cancellations caused by illness, flight disruptions, family emergencies, adverse weather, and other events outside our control. We do not sell, administer, or act as an agent for any insurance product, and we are not liable for reimbursement of non-refundable amounts in the absence of such coverage." },
    ],
  },
  {
    id: "host-cancellation",
    number: "08",
    title: "Cancellations and Relocations by the Host",
    paragraphs: [
      "In the unlikely event that Summit Lakeside must cancel a reservation due to circumstances such as unanticipated property damage, owner exigency, loss of utility service, mechanical failure, compliance or permitting issues, or any event of force majeure, we will, at our discretion and where feasible, (a) relocate the Guest to a comparable Property at no additional cost to the Guest; or (b) refund all amounts paid to Summit Lakeside in connection with the cancelled reservation.",
      "Except as expressly set forth in the preceding sentence, Summit Lakeside shall not be liable for any direct, indirect, incidental, consequential, or special damages arising out of a cancellation by the Host, including but not limited to airfare, ground transportation, replacement lodging, lost wages, lost vacation time, pet boarding, or non-refundable activity reservations.",
    ],
  },
  {
    id: "checkin",
    number: "09",
    title: "Check-In, Check-Out, and Access",
    paragraphs: [
      "Standard check-in time is four o'clock in the afternoon (4:00 PM) local time on the arrival date. Standard check-out time is eleven o'clock in the morning (11:00 AM) local time on the departure date. These times are strict and are necessary to allow our cleaning team to prepare the Property for the next guest.",
      "Early check-in and late check-out may be available for an additional fee, but only when expressly approved in writing by Summit Lakeside in advance. Unapproved early arrivals will not be granted access. Unapproved late departures are charged at a minimum rate of one hundred dollars ($100) per hour, and, after 2:00 PM on the departure date, at the full nightly rate.",
      "Access is provided primarily by smart lock, lockbox, or keypad code, with credentials transmitted by email and/or text message no earlier than forty-eight (48) hours prior to check-in. The Guest is solely responsible for safeguarding access credentials and for notifying Summit Lakeside immediately if a credential is lost, shared, or compromised. Costs associated with reissuing codes, rekeying locks, or dispatching emergency access personnel as a result of Guest misuse may be deducted from the Security Deposit.",
      "The Guest agrees not to duplicate any physical key, share any access code with any non-Authorized Occupant, or disclose any access code on social media or any other public forum. Unreturned keys or key fobs at check-out are subject to a replacement charge of one hundred dollars ($100) each.",
      "Each Property is provided with a set of HOA-issued community amenity badges (for access to pools, beaches, gates, and other shared facilities). The exact number of badges issued to the Guest is disclosed at check-in and must be returned in full at check-out. Lost, damaged, or unreturned amenity badges are assessed a replacement fee of one hundred dollars ($100) per badge, which is charged by the HOA and passed through to the Guest without markup.",
    ],
  },
  {
    id: "occupancy",
    number: "10",
    title: "Occupancy Limits, Guest Count, and Child Policy",
    paragraphs: [
      "The maximum occupancy of each Property, as posted on the listing page and in the confirmation email, includes all persons present overnight, regardless of age, and includes infants and children. Occupancy limits are set by fire code, septic or water-system capacity, insurance requirements, HOA regulations, and/or municipal short-term-rental ordinances; they are not a marketing figure and cannot be waived.",
      "Exceeding the maximum occupancy at any time, whether overnight or during the day, is a material breach of this Agreement. We reserve the right to (a) assess an immediate additional charge of two hundred fifty dollars ($250) per unauthorized occupant per night; (b) terminate the reservation without refund and remove all occupants from the Property; and (c) forfeit the Security Deposit.",
      "Children twelve (12) and under must be supervised by a responsible adult at all times, particularly around pools, hot tubs, docks, lakes, fire pits, stoves, grills, balconies, stairs, and any operating machinery or tools. The Guest assumes all responsibility for the safety and supervision of minors on or near the Property.",
    ],
  },
  {
    id: "visitors",
    number: "11",
    title: "Visitors, Day Guests, and Unregistered Persons",
    paragraphs: [
      "Important: for purposes of occupancy, HOA amenity access, and township short-term-rental licensing, a day visitor is treated identically to an overnight guest. The township and the HOA do not distinguish between daytime and overnight visitors — every person on the Property counts the same against the posted maximum occupancy and against any community-issued pass allotment. There is no separate \"day visitor\" allowance.",
      "As a result, the total number of persons on the Property at any time — including every day visitor, friend, relative, or dropping-by acquaintance — may not exceed the maximum occupancy posted on the listing and in the confirmation email. Each visitor must also be covered by a valid amenity badge or guest pass if they intend to use any community amenity, and they are subject to the same registration, conduct, and quiet-hour requirements as overnight occupants.",
      "Visitors who remain past ten o'clock in the evening (10:00 PM) without prior written approval, or who arrive in numbers that cause the Property to exceed its maximum occupancy at any point during the day, trigger the unauthorized-occupant charges set forth in Section 10. The Guest is fully responsible for the conduct of all visitors and for any damage, rule violation, HOA fine, township citation, or injury they cause.",
      "Commercial visitors (photographers, caterers, event planners, entertainers, rental-equipment vendors, and similar) are not permitted without express written authorization from Summit Lakeside, which may be conditioned on additional insurance and fees.",
    ],
  },
  {
    id: "house-rules",
    number: "12",
    title: "House Rules and Standard of Conduct",
    paragraphs: [
      "The Guest and all Authorized Occupants and visitors agree to use the Property as a private residence only, to treat it with the same care as their own home, and to conduct themselves in a manner that does not disturb neighbors, damage property, or violate any applicable law.",
      "In addition to the provisions of this Agreement, each Property may have specific House Rules posted in the welcome book, inside the Property, or in the pre-arrival message. Those House Rules are incorporated into this Agreement by reference and are enforceable to the same extent as the provisions printed here.",
    ],
  },
  {
    id: "parties",
    number: "13",
    title: "Parties, Events, and Gatherings",
    paragraphs: [
      "No parties, events, weddings, receptions, reunions, fundraisers, photoshoots, film shoots, commercial recordings, or gatherings of any persons beyond the Authorized Occupants and a small number of pre-approved day visitors are permitted on the Property under any circumstances. This is a strict, non-negotiable term of this Agreement.",
      "Evidence of a prohibited event includes but is not limited to: amplified music; catering, bar, or DJ equipment; rental tents, tables, chairs, or portable restrooms; decorations consistent with an event; photographers; more vehicles than posted parking; guest lists; signage; or reports by neighbors, HOA officers, or law enforcement.",
      "Upon discovery of a prohibited event, Summit Lakeside may, at its sole discretion and without prior warning: (a) terminate the reservation immediately; (b) remove all occupants and their belongings from the Property with the assistance of law enforcement as needed; (c) retain the entire Rental Fee; (d) charge a party fee of not less than two thousand five hundred dollars ($2,500) plus any actual damages, HOA fines, cleaning costs, and municipal fines; and (e) report the Guest to any listing platform through which the booking was made.",
    ],
  },
  {
    id: "noise",
    number: "14",
    title: "Noise, Quiet Hours, and Neighbor Relations",
    paragraphs: [
      "Quiet hours are observed every night from ten o'clock in the evening (10:00 PM) until eight o'clock in the morning (8:00 AM) local time. During quiet hours, all outdoor activity must cease, windows and doors must be closed if music is being played indoors, hot tub and pool use must be silent, and no noise audible from a neighboring property may be generated.",
      "Many of our Properties are equipped with decibel-monitoring devices (e.g., Minut, NoiseAware) that detect elevated sound levels without recording conversations. When a threshold is exceeded, we receive an automatic alert and may contact the Guest. Repeated or severe alerts may result in early termination of the reservation without refund.",
      "Municipal noise ordinances and HOA quiet-hour rules apply at all times, including daytime hours. Where those rules are stricter than this Section, they control. Any fine or citation assessed to the Property as a result of the Guest's conduct is the Guest's responsibility and will be deducted from the Security Deposit or charged to the payment method on file.",
    ],
  },
  {
    id: "smoking",
    number: "15",
    title: "Smoking, Vaping, and Open Flames",
    paragraphs: [
      "All Summit Lakeside Properties are strictly non-smoking and non-vaping indoors. This prohibition applies to cigarettes, cigars, pipes, electronic cigarettes, vape pens, hookahs, cannabis (in any form, regardless of state law), incense, candles not specifically provided by the Host, and any other form of combustion or aerosolization.",
      "Smoking is permitted only in designated outdoor areas where marked, and only when every ash, butt, and spent match is fully extinguished and disposed of in an approved ashtray or metal container. Smoking on docks, in wooded areas, on decks covered by tree canopy, or near any structure during red-flag fire conditions is prohibited.",
      "Evidence of indoor smoking (including but not limited to odor, residue, ash, burn marks, removed or tampered-with smoke detectors, or a positive reading from remote air-quality sensors) will result in a smoking-remediation fee of not less than five hundred dollars ($500) per occurrence, in addition to any actual cost of ozone treatment, deep cleaning, repainting, replacement of soft goods, or lost-revenue compensation for displaced future guests.",
    ],
  },
  {
    id: "drugs",
    number: "16",
    title: "Illegal Drugs and Unlawful Activity",
    paragraphs: [
      "The manufacture, cultivation, distribution, sale, storage, or use of any controlled substance that is unlawful under federal or Pennsylvania law is strictly prohibited on the Property. Notwithstanding any state-level legalization of cannabis, cannabis use is not permitted indoors at any Property, and we reserve the right to treat any cannabis use as a violation of the smoking policy.",
      "Any unlawful activity of any kind — including but not limited to underage drinking, the furnishing of alcohol to minors, prostitution, trafficking, illegal firearms possession, or the hosting of any criminal enterprise — is grounds for immediate termination of the reservation, forfeiture of all amounts paid, and referral to law enforcement. The Guest agrees to indemnify Summit Lakeside against all costs associated with any such activity.",
    ],
  },
  {
    id: "alcohol",
    number: "17",
    title: "Alcohol",
    paragraphs: [
      "The lawful consumption of alcohol by persons of legal drinking age is permitted at the Property in moderation and in a manner that does not violate this Agreement, House Rules, or applicable law. The Guest acknowledges that it is a criminal offense to furnish alcohol to any person under twenty-one (21) years of age, that doing so may expose the Guest to personal liability, and that Summit Lakeside will cooperate fully with any law-enforcement investigation.",
      "Any welcome gifts, complimentary beverages, or starter bar items provided at the Property are offered as a courtesy, not as an inducement to consumption. The Guest assumes full responsibility for the safe use and storage of alcohol on the Property and for the conduct of all persons who consume alcohol there.",
    ],
  },
  {
    id: "firearms",
    number: "18",
    title: "Firearms, Ammunition, and Weapons",
    paragraphs: [
      "Firearms, ammunition, explosives, fireworks, pyrotechnics, archery equipment, crossbows, flammable liquids in quantities exceeding normal household use, and any other weapon are not permitted at the Property without express written permission from Summit Lakeside, which is rarely granted. Where permission is granted, the Guest must comply with all applicable federal, state, and local laws, must store all firearms and ammunition in a locked container or safe provided by the Guest, and must not discharge any firearm on or from the Property.",
      "Fireworks of any kind (including sparklers, bottle rockets, aerial shells, and lanterns) are strictly prohibited on all Summit Lakeside Properties and in the surrounding neighborhoods and lakes, without exception. Violation will result in forfeiture of the Security Deposit and, where applicable, full liability for any resulting fire damage or fire-department response costs.",
    ],
  },
  {
    id: "pets",
    number: "19",
    title: "Pet Policy",
    paragraphs: [
      "Some Properties permit pets; many do not. The specific pet policy for each Property is posted on the listing page and must be confirmed in writing at the time of booking. Bringing any pet to a Property designated pet-free, or bringing an undisclosed pet to a pet-friendly Property, is a material breach of this Agreement and is subject to an unauthorized-pet fee of one hundred dollars ($100) per pet, plus actual cleaning costs and any additional damages.",
    ],
    items: [
      { label: "Approved Pets", body: "Only the specific pets named in the reservation are permitted. Substitutions, additions, and \"just-for-a-night\" exceptions are not allowed and are treated as unauthorized pets." },
      { label: "Pet Fee", body: "A non-refundable pet fee of one hundred dollars ($100) per pet per stay applies to every approved pet." },
      { label: "Species Restrictions \u2014 Dogs Only", body: "Dogs are the only pet species permitted at any Summit Lakeside Property. Cats are not allowed under any circumstances, including short visits, due to allergen persistence in soft furnishings. Exotic animals (reptiles, rodents, birds, primates), livestock, and any non-canine companion animal are likewise prohibited. Dogs that insurers categorize as restricted breeds are not permitted without an express written exception." },
      { label: "Size & Count", body: "A maximum of two (2) dogs per Property, each under seventy-five (75) pounds, unless otherwise approved in writing." },
      { label: "Documentation", body: "The Guest must provide current proof of rabies vaccination and, where required by the Property or HOA, proof of general vaccination and flea/tick prevention. The Host's registration system supports uploading these documents." },
      { label: "Supervision", body: "Pets must never be left unattended indoors for more than four (4) hours and must not be left unattended in outdoor spaces at any time. Pets may not be left crated unattended overnight in any common area." },
      { label: "Furniture", body: "Pets are not permitted on beds, upholstered furniture, or inside hot tubs or pools. Pet hair on upholstered furniture or bedding will be treated as a cleaning violation." },
      { label: "Waste", body: "The Guest must pick up all pet waste immediately and dispose of it in sealed bags in outdoor trash receptacles. Waste left on the lawn, dock, or common areas will be assessed a remediation fee." },
      { label: "Noise & Nuisance", body: "Excessive barking, aggressive behavior, or any incident resulting in an animal-control complaint is grounds for immediate removal of the pet from the Property at the Guest's expense." },
      { label: "Service Animals", body: "Trained service animals as defined under the Americans with Disabilities Act are permitted at every Property without a pet fee. Emotional-support animals are accommodated under applicable housing law but may be subject to the same documentation, supervision, and damage provisions as pets." },
    ],
  },
  {
    id: "vehicles",
    number: "20",
    title: "Vehicles, Parking, and Driveway Use",
    paragraphs: [
      "The maximum number of vehicles allowed at each Property is posted on the listing page and in the pre-arrival message, and is set by HOA regulation, driveway capacity, and local ordinance. Overflow parking on streets, in neighboring driveways, on lawns, or in common areas of the community is strictly prohibited and may result in HOA fines, towing at the vehicle owner's expense, and forfeiture of a portion of the Security Deposit.",
      "Trailers, boats, RVs, campers, commercial vehicles, and oversized vehicles are not permitted without prior written approval. Charging electric vehicles from household outlets is permitted only when a Level 1 or Level 2 charger is expressly provided at the Property; high-amperage charging that disrupts the Property's electrical service is the Guest's responsibility, including any service call or repair cost.",
      "The Guest is required to provide the year, make, model, color, and license plate of each vehicle during the registration step. Unregistered vehicles may be reported to the HOA or towed without notice. Summit Lakeside is not responsible for theft of or damage to any vehicle or its contents while parked at or near the Property.",
    ],
  },
  {
    id: "amenities",
    number: "21",
    title: "Use of Pools, Hot Tubs, Saunas, and Grills",
    paragraphs: [
      "Where provided, pools, hot tubs, saunas, outdoor showers, fire pits, and grills are offered as amenities for the exclusive use of Authorized Occupants and approved day visitors, at the Guest's own risk and subject to the following:",
    ],
    items: [
      { label: "Supervision", body: "No lifeguard is on duty at any Property. Children under fourteen (14) must be under direct adult supervision at all times when using any pool, hot tub, or water feature. Non-swimmers must wear an approved flotation device." },
      { label: "Hot Tub & Pool Hygiene", body: "Do not enter a hot tub or pool while visibly dirty, oily, bleeding, or while wearing street clothing. Do not add bubble bath, soap, oils, dyes, or foreign objects. Unauthorized chemical additions may render the hot tub inoperable and will be assessed a drain-and-refill fee of not less than three hundred dollars ($300)." },
      { label: "No Food or Drink in the Hot Tub", body: "Food and beverages are not permitted inside the hot tub or on the hot tub cover. Crumbs, fruit, bottles, cans, and spilled drinks foul the water chemistry and clog the filtration system. A cleaning fee of one hundred dollars ($100) is assessed for any food found in or around the hot tub water." },
      { label: "Closing the Hot Tub Cover", body: "The hot tub cover must be fully closed, secured, and latched whenever the tub is not in active use. Leaving the cover open or partially off causes heat loss, water contamination from debris, and, over time, damage to the shell and heater. A fine of one hundred dollars ($100) per occurrence is assessed for a hot tub found left open and unused, in addition to any cost for replacement of a damaged cover (up to $800)." },
      { label: "Fire Pits & Outdoor Fires", body: "Use only the wood, pellets, or fuel provided or expressly approved. Fires must be attended at all times, fully extinguished before the Guest leaves the area or goes to sleep, and must comply with any burn ban in effect. The Guest is strictly liable for any fire damage traceable to their use of a fire pit or grill." },
      { label: "Grills", body: "Clean grills after each use. Return propane tanks to the closed position. Never operate grills indoors, in a garage, or under a roof overhang. Damage to grills beyond normal wear is the Guest's responsibility." },
      { label: "Saunas \u2014 No Shoes", body: "Street shoes are not permitted inside any sauna. Dirt, grit, and trail debris tracked onto sauna benches or floors damage the wood, require specialty cleaning, and expose subsequent guests to contaminated surfaces. A cleaning fee of one hundred dollars ($100) is assessed for any evidence of shoes worn inside the sauna. Do not pour liquids on the heater unless the sauna is an expressly wet-rated model. Do not modify controls. Never leave a sauna operating unattended." },
    ],
  },
  {
    id: "watercraft",
    number: "22",
    title: "Watercraft, Docks, and Lake Safety",
    paragraphs: [
      "Canoes, kayaks, paddleboards, rowboats, pedal boats, and similar non-motorized watercraft are provided at certain Properties for the Guest's use at the Guest's own risk. Personal flotation devices (PFDs) must be worn at all times by every user, regardless of age or swimming ability, and the Guest must comply with all Pennsylvania Fish and Boat Commission regulations.",
      "After every use, canoes, kayaks, pedal boats, and any similar hull must be pulled fully out of the water, overturned (flipped upside-down), and placed on the rack or shoreline provided. This is a strict requirement. Watercraft left right-side-up collect rainwater and, once full, become impossible for our cleaning staff to lift or drain without heavy equipment. A fine of two hundred dollars ($200) per hull is assessed when any watercraft is found right-side-up at departure or after a rain event during the stay, in addition to any cost to remediate cracked or warped hulls.",
      "Motorized watercraft are not provided. The use of personal motorized watercraft at the Property is subject to HOA and lake-association rules, available upon request. The Guest is responsible for insuring, licensing, and properly operating any personal watercraft, and for any damage caused to the Property's dock, shoreline, or neighboring property.",
      "Swimming in any lake is at the Guest's own risk. Lake bottoms may be uneven, rocky, or contain submerged hazards. Water quality, wildlife presence, weather, and seasonal advisories are beyond our control. Diving from docks, boats, rocks, or cliffs is strictly prohibited.",
    ],
  },
  {
    id: "cleaning",
    number: "23",
    title: "Cleaning, Housekeeping, and Turnover",
    paragraphs: [
      "A standard cleaning fee is included in the Rental Fee and covers routine turnover cleaning between stays. The Guest is expected to leave the Property in the same general condition in which it was found, which includes (without limitation):",
    ],
    items: [
      { body: "Starting the dishwasher with any used dishes, or washing used dishes by hand and returning them to cabinets." },
      { body: "Disposing of all trash in the appropriate outdoor receptacle, with bags closed." },
      { label: "Returning furniture to its original location", body: "All indoor and outdoor furniture must be returned to the exact placement shown on arrival. Rearranging a room, dragging outdoor furniture across the yard or dock, moving beds or couches between rooms, or leaving furniture askew creates significant additional work for our turnover team and often requires multiple staff to reset. A fine of five hundred dollars ($500) is assessed where furniture has been materially moved and not restored before check-out." },
      { body: "Removing all personal belongings, food, and beverages, including items in refrigerators, freezers, and pantries." },
      { body: "Closing and locking all windows, doors, and garages, and setting the thermostat to the posted departure temperature." },
    ],
  },
  {
    id: "excess-cleaning",
    number: "24",
    title: "Excess Cleaning, Trash, and Biohazard Charges",
    paragraphs: [
      "If the Property is left in a condition that requires cleaning materially beyond standard turnover — including but not limited to excessive food waste, widespread spills, pet accidents, vomit, blood or other bodily-fluid cleanup, soot from improper fireplace use, or household trash left inside the Property — the Guest will be assessed an excess-cleaning fee at our actual cost plus a twenty-five percent (25%) administrative charge.",
      "Biohazard remediation requiring professional services, including the handling of bodily fluids, infestations, or hazardous waste, is assessed at actual cost plus fifty percent (50%). The Guest is also responsible for any loss of revenue if the Property cannot be rented to the next confirmed guest as a result of the condition in which it was left.",
      "Excess trash that exceeds the capacity of the provided receptacles and cannot be disposed of in the normal collection is assessed a disposal fee of not less than one hundred fifty dollars ($150) per load.",
    ],
  },
  {
    id: "maintenance",
    number: "25",
    title: "Maintenance, Repairs, and Service Calls",
    paragraphs: [
      "The Guest agrees to notify Summit Lakeside promptly of any maintenance issue, including but not limited to water leaks, power outages, malfunctioning appliances, HVAC failure, hot tub or pool equipment problems, smoke or carbon-monoxide alarms, pest sightings, or broken fixtures. We will use reasonable efforts to respond quickly, and to dispatch service providers as needed.",
      "Some issues are not always resolvable during a Rental Period (e.g., specialty parts on order, weather-related utility outages, service-provider availability on holidays). No refund, partial refund, rate adjustment, or compensation is owed for temporary amenity interruptions, for outages of third-party services such as internet or cable, or for issues that the Guest fails to report during the Rental Period.",
      "Service calls triggered by Guest error — for example, lockouts or nuisance alarms caused by disabled smoke detectors — are assessed a service-call fee of seventy-five dollars ($75) during business hours and one hundred fifty dollars ($150) outside business hours. Routine assistance with tripped breakers, thermostat settings, and other ordinary troubleshooting is included at no charge; please call us whenever something is not working as expected.",
      "Shower strainer cups (for stays of more than three nights). Many of our Properties use strainer cups in the shower drains to catch hair and prevent plumbing clogs. For any stay longer than three (3) nights, the Guest is required to empty the shower strainer cups at least once during the stay and to keep them clean thereafter. Strainer cups left full can back up, overflow, and flood the bathroom and adjacent rooms. Where failure to empty the strainers results in water backup, overflow, or flooding, the Guest is responsible for the full repair cost, including plumbing service, drywall, flooring, subfloor, and any lost-revenue compensation for displaced subsequent guests.",
    ],
  },
  {
    id: "damage",
    number: "26",
    title: "Damage, Loss, and Guest Liability",
    paragraphs: [
      "The Guest is financially responsible for any damage to the Property, its contents, the land, landscaping, dock, waterfront, shared community amenities, or neighboring property that occurs during the Rental Period and that exceeds ordinary wear and tear. Damage includes, without limitation, burns, stains, tears, breakage, scratches, water damage, pet damage, smoke damage, pest introduction, and theft.",
      "We reserve the right to charge the Guest's payment method on file for the repair or replacement cost of damaged items, at our actual cost plus a reasonable administrative fee, without further notice. Where repair is not practical, replacement will be on a like-for-like basis with comparable quality; we are not obligated to accept depreciated value for irreplaceable items.",
      "Catch-all. The specific dollar fines identified throughout this Agreement (for smoking, unauthorized pets, hot tub misuse, sauna misuse, furniture relocation, watercraft left right-side-up, HOA infractions, and so forth) are the minimums for their respective categories. Any damage, misuse, loss, or violation not covered by a specific fine is billed to the Guest at its incurred cost, plus the administrative fee described above. Incurred cost includes parts, labor, professional services, HOA and municipal pass-throughs, and, where applicable, lost-revenue compensation for displaced subsequent guests.",
      "The Guest is encouraged to report any pre-existing damage within two (2) hours of check-in by text message or email. Damage not reported within that window is presumed to have occurred during the Rental Period.",
    ],
  },
  {
    id: "lost-found",
    number: "27",
    title: "Lost and Found Items",
    paragraphs: [
      "Summit Lakeside will make a reasonable effort to locate and return items inadvertently left behind by the Guest, but assumes no responsibility for doing so. Items requested for return will be shipped by ground service at the Guest's expense, plus a handling fee of twenty-five dollars ($25). Unclaimed items are held for thirty (30) days and then donated or discarded.",
    ],
  },
  {
    id: "internet",
    number: "28",
    title: "Wi-Fi, Internet, and Technology",
    paragraphs: [
      "Wi-Fi is provided as a courtesy. Bandwidth, reliability, and availability depend on third-party carriers and are beyond our control. No refund is owed for a temporary internet outage.",
      "The Guest agrees not to use the Property's internet connection for any unlawful purpose, including but not limited to copyright infringement, distribution of malicious software, or the downloading or distribution of child sexual-abuse material. The Guest agrees to indemnify Summit Lakeside against any claim, fine, demand, or DMCA notice arising from their use of the connection.",
    ],
  },
  {
    id: "utilities",
    number: "29",
    title: "Utilities, Climate Control, and Conservation",
    paragraphs: [
      "Electricity, water, gas, propane, heating oil, and trash service are included in the Rental Fee for stays shorter than thirty (30) nights. For longer-term stays, utility overages above a posted baseline may be charged to the Guest at actual cost.",
      "Thermostat range is commonly restricted between sixty-two (62°F) and seventy-six (76°F) depending on the season. Opening windows while heat or air conditioning is running, turning the thermostat to its lowest or highest setting to \"cool faster\" or \"heat faster,\" or leaving HVAC running with exterior doors open, are prohibited. Damage to HVAC equipment caused by Guest misuse is chargeable to the Guest.",
      "The Guest agrees to conserve water during drought advisories, to follow any posted well-water usage limits, and to refrain from flushing non-flushable items in septic systems. Septic pump-outs or plumbing calls caused by Guest misuse are fully chargeable.",
    ],
  },
  {
    id: "security",
    number: "30",
    title: "Security, Cameras, and Monitoring Devices",
    paragraphs: [
      "For the safety and security of our Guests and Properties, certain devices are installed at each Property. These devices may include: exterior-facing video cameras at driveways, entryways, and around outbuildings; exterior-facing doorbell cameras; exterior-only audio-free cameras at pools, hot tubs, or docks; decibel-monitoring noise sensors that measure sound level only (not conversation); smart-lock event logs; Wi-Fi router traffic counters; and thermostats that record temperature setpoints.",
      "No cameras or audio-recording devices are installed inside any Property, in any bedroom, bathroom, sauna, sleeping area, or interior private space. The tampering with, obstruction of, disconnection of, or damage to any monitoring device is a material breach of this Agreement and a violation of federal and state law, and may result in immediate termination of the reservation, forfeiture of the Security Deposit, and referral to law enforcement.",
      "Video and audio recordings from lawful exterior devices may be used by Summit Lakeside to enforce this Agreement, cooperate with law enforcement, defend against claims, and pursue damages. By occupying a Property, the Guest consents to the lawful operation of such devices.",
    ],
  },
  {
    id: "hoa",
    number: "31",
    title: "HOA Rules, Community Compliance, and PEPOA",
    paragraphs: [
      "Most Summit Lakeside Properties are located within homeowners' associations, including but not limited to the Pocono East Property Owners Association (\"PEPOA\") and neighboring community associations. The Guest agrees to comply with all applicable HOA rules, including those relating to amenity access, guest passes, pool hours, beach hours, gate codes, noise, pets, parking, fires, fishing, and boating.",
      "Prior to arrival, the Guest may be required to complete a registration form (the \"PEPOA Registration\" or equivalent) that lists all occupants, vehicles, pets, and emergency contact information. Submission of this form is a condition of entry into the community and of receiving amenity credentials.",
      "The HOA enforces strict community driving and access rules, patrolled by community security officers with authority to issue citations. The following fine schedule is set by the HOA and passed through to the Guest without markup. Any such fine assessed as a result of the Guest's conduct (or the conduct of any Authorized Occupant or visitor) is the Guest's sole responsibility and will be charged to the payment method on file:",
    ],
    items: [
      { label: "Speeding", body: "Fifty dollars ($50) per violation. Posted speed limits in the community are strictly enforced." },
      { label: "Sharing a gate pass", body: "Two hundred fifty dollars ($250) per violation. Gate passes are non-transferable and may not be handed off to another driver, relative, visitor, or vehicle." },
      { label: "Parking on the street", body: "Thirty-five dollars ($35) per violation. Parking is permitted only in the designated driveway and approved spaces for the Property." },
      { label: "Evading a security officer", body: "One hundred dollars ($100) per violation. Guests must stop and comply with any lawful instruction from community security personnel." },
      { label: "Failure to stop at a stop sign", body: "Fifty dollars ($50) per violation. Every posted stop sign requires a complete stop." },
    ],
  },
  {
    id: "tax",
    number: "32",
    title: "Taxes, Tourism Fees, and Compliance",
    paragraphs: [
      "The Rental Fee includes applicable Pennsylvania state sales tax, county hotel occupancy tax, and any local short-term rental tax or tourism promotion fee. We collect and remit these amounts to the appropriate authorities as required by law. Tax rates and categories are subject to change by governmental action and any such change will apply to Rental Periods that begin after the effective date of the change.",
      "Short-term-rental permits, business privilege licenses, and zoning approvals for each Property are held and maintained by the Property owner or by Summit Lakeside on the owner's behalf. In the event a Property loses its permit during the Rental Period, we will relocate the Guest to a comparable Property where possible or refund amounts paid for the affected nights.",
    ],
  },
  {
    id: "minors",
    number: "33",
    title: "Minors, Families, and Unaccompanied Groups",
    paragraphs: [
      "Reservations by or primarily for groups of persons under twenty-five (25) years of age — including graduation trips, spring-break groups, bachelor and bachelorette parties dominated by persons under twenty-five, and similar — are not permitted and may be cancelled without refund upon discovery. Family groups with older adults accompanying younger children and young adults are welcome.",
      "The Primary Guest is a parent or guardian of all minors on the Property unless the written and signed permission of each minor's legal guardian has been provided to Summit Lakeside in advance. Acceptance of such permission is at our sole discretion.",
    ],
  },
  {
    id: "medical",
    number: "34",
    title: "Medical Emergencies and First Aid",
    paragraphs: [
      "In any medical emergency, the Guest must dial 9-1-1 immediately. A standard first-aid kit is provided at each Property for minor injuries. Summit Lakeside staff and contractors are not trained medical providers and cannot administer medication, diagnose conditions, or transport guests.",
      "The Guest agrees that Summit Lakeside is not liable for any injury, illness, allergic reaction, food-borne illness, exposure to wildlife or insects, or other medical condition that occurs during the Rental Period, except to the extent caused by our gross negligence or willful misconduct.",
    ],
  },
  {
    id: "force-majeure",
    number: "35",
    title: "Weather, Force Majeure, and Acts of God",
    paragraphs: [
      "Neither party is liable for any failure or delay in performance under this Agreement caused by a true event beyond that party's reasonable control, including but not limited to: hurricanes, tornadoes, major flooding, wildfires, extended power or utility outages, water-system failures, pandemic, epidemic, quarantine, government order or closure, evacuation order, road closure, civil unrest, strike, supply-chain failure, terrorism, or war (each, a \"Force Majeure Event\").",
      "No refund, credit, rescheduling, or other accommodation is offered for winter weather, including snowstorms, ice events, cold temperatures, or snow-related travel inconvenience. The Poconos are a year-round mountain destination, and a substantial portion of our guests specifically book to experience winter conditions — skiing, snowboarding, snowmobiling, snowshoeing, fireside weekends, and the like. Snow is an expected, recurring, and foreseeable part of the stay, not a Force Majeure Event. Guests who are concerned about winter travel are strongly encouraged to purchase travel insurance; we do not issue refunds or credits on account of weather, road conditions, flight disruption, school delay, personal transportation choice, or any similar weather-adjacent reason.",
      "In the narrow circumstance that a genuine Force Majeure Event as listed above — not weather generally — renders the Property itself uninhabitable during the Rental Period, Summit Lakeside will, at its sole discretion and where feasible, either relocate the Guest to a comparable Property or refund amounts paid for the affected nights, less non-recoverable third-party costs already incurred on the Guest's behalf.",
    ],
  },
  {
    id: "termination",
    number: "36",
    title: "Early Termination by the Host; Removal of Occupants",
    paragraphs: [
      "Summit Lakeside reserves the right to terminate this Agreement immediately, and to cause all occupants and their belongings to be removed from the Property, upon any material breach, including but not limited to: a prohibited party or gathering; exceeding occupancy; undisclosed pets; indoor smoking; noise or HOA violations that recur after notice; damage that presents a risk to the Property or to others; any unlawful activity; any threatening, harassing, or abusive conduct toward Summit Lakeside personnel or neighbors; or any fraudulent or materially false statement made to Summit Lakeside.",
      "In the event of such termination, no refund is owed, the Security Deposit is forfeited, and the Guest remains liable for all damages, fines, and costs in excess of the Security Deposit. The Guest waives any right to notice or hearing beyond what is required by applicable law and agrees that the remedies provided in this Section are reasonable and necessary to protect Summit Lakeside, its properties, and its other guests.",
    ],
  },
  {
    id: "publicity",
    number: "37",
    title: "Photography, Video, and Publicity",
    paragraphs: [
      "No commercial filming, photography, videography, live streaming, podcasting, or any other form of content production conducted for commercial, paid, sponsored, or monetized purposes is permitted on, in, or from the Property without express prior written permission from Summit Lakeside. This prohibition applies regardless of whether the production would otherwise qualify as a prohibited event under Section 13 and regardless of crew size, including solo creators.",
      "\"Commercial\" production includes, without limitation: advertising shoots; branded or sponsored content; influencer or creator campaigns; film, television, documentary, or music-video production; product photography; catalog or editorial shoots; real-estate or architectural photography; wedding, engagement, or portrait sessions offered for a fee; podcast or broadcast recording involving on-site crew or equipment; and any production intended to be distributed, sold, licensed, or used to generate revenue in any medium.",
      "Where commercial use is requested, Summit Lakeside may, in its sole discretion, grant written permission subject to additional terms, which may include a location fee, a certificate of insurance naming Summit Lakeside and the Property owner as additional insureds, crew-size limits, noise and parking restrictions, HOA approval, and a signed location release. Filming or photography conducted without such written permission is a material breach of this Agreement and will result in immediate termination of the reservation, forfeiture of the Security Deposit, an unauthorized-use fee of not less than two thousand five hundred dollars ($2,500), and any further damages permitted by law.",
      "The Guest further agrees not to use photographs, video, or audio recorded at the Property for any commercial purpose, including advertising, promotion, crowd-funding, brand partnerships, or the creation of paid or monetized content, without the same express written permission. Personal, non-commercial photography and video by guests for their own use and for ordinary, non-monetized social-media posts is, of course, welcomed and encouraged.",
      "The Guest grants Summit Lakeside a limited, royalty-free, revocable license to re-share publicly tagged social-media content posted by the Guest and referencing a Summit Lakeside Property, solely for the Host's marketing purposes, with attribution to the Guest's handle as tagged. This license is revocable by written request.",
    ],
  },
  {
    id: "assumption",
    number: "38",
    title: "Assumption of Risk",
    paragraphs: [
      "The Guest acknowledges that vacation rental properties, particularly in a rural and lakeside environment, present inherent risks that cannot be eliminated, including but not limited to: uneven terrain, steep stairs, slippery surfaces, bodies of water, docks and cliffs, insects and wildlife, seasonal weather hazards, cooking hazards, recreational equipment, and fire features. The Guest voluntarily and knowingly assumes all such risks for themselves, their Authorized Occupants, and their visitors.",
    ],
  },
  {
    id: "indemnification",
    number: "39",
    title: "Indemnification",
    paragraphs: [
      "The Guest agrees to indemnify, defend, and hold harmless Summit Lakeside, the Property owner, their respective affiliates, employees, officers, directors, managers, agents, contractors, and assigns (collectively, the \"Indemnified Parties\") from and against any and all claims, losses, liabilities, damages, fines, judgments, awards, penalties, costs, and expenses (including reasonable attorneys' fees and court costs) arising out of or related to (a) the Guest's use or occupancy of the Property; (b) the acts or omissions of any Authorized Occupant, visitor, invitee, or pet; (c) the Guest's breach of this Agreement; or (d) any violation by the Guest of any applicable law, HOA rule, or posted regulation.",
      "The Guest's obligation to indemnify under this Section survives the expiration or termination of this Agreement.",
    ],
  },
  {
    id: "liability",
    number: "40",
    title: "Limitation of Liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE INDEMNIFIED PARTIES SHALL NOT BE LIABLE TO THE GUEST OR ANY OTHER PERSON FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, LOSS OF BUSINESS, LOSS OF VACATION TIME, EMOTIONAL DISTRESS, OR LOSS OF USE, ARISING OUT OF OR RELATED TO THIS AGREEMENT, THE RESERVATION, OR THE PROPERTY, WHETHER SOUNDING IN CONTRACT, TORT, OR OTHERWISE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
      "The aggregate liability of the Indemnified Parties for any direct damages arising out of or related to this Agreement shall not exceed the total Rental Fee actually paid by the Guest to Summit Lakeside for the reservation giving rise to the claim.",
      "No provision of this Section limits or excludes any liability that cannot be lawfully limited or excluded under applicable law.",
    ],
  },
  {
    id: "insurance",
    number: "41",
    title: "Insurance and Damage Waivers",
    paragraphs: [
      "Summit Lakeside maintains customary property, liability, and short-term-rental insurance coverage on each Property, which protects Summit Lakeside and the Property owner and is not a substitute for the Guest's own travel or personal insurance. The Guest is solely responsible for insuring the Guest's own personal property while at the Property, for travel-related risks, and for any medical costs incurred during the Rental Period.",
      "An optional accidental-damage waiver or protection plan may be offered at the time of booking in lieu of a refundable Security Deposit. Coverage, limits, and exclusions are governed by the terms of the specific plan purchased; accidental damage is covered up to the plan limit, and intentional, grossly negligent, or excluded damages remain the Guest's responsibility.",
    ],
  },
  {
    id: "disputes",
    number: "42",
    title: "Governing Law, Venue, and Dispute Resolution",
    paragraphs: [
      "This Agreement is governed by and construed in accordance with the laws of the Commonwealth of Pennsylvania, without regard to its conflict-of-laws principles. The parties irrevocably consent to the exclusive jurisdiction and venue of the state and federal courts located in Monroe County, Pennsylvania, for any action not subject to arbitration under this Section.",
      "The parties shall first attempt to resolve any dispute arising out of or related to this Agreement through good-faith written communication for a period of not less than thirty (30) days before filing suit or demanding arbitration. Thereafter, any dispute that cannot be resolved may, at either party's election, be submitted to binding arbitration under the rules of the American Arbitration Association, with the arbitration conducted in Monroe County, Pennsylvania, and the award enforceable in any court of competent jurisdiction.",
      "The Guest and Summit Lakeside each waive the right to a jury trial and the right to participate in a class action, collective action, or representative action as to any dispute arising under this Agreement, to the maximum extent permitted by law.",
    ],
  },
  {
    id: "general",
    number: "43",
    title: "Severability, Assignment, Waiver, Entire Agreement",
    paragraphs: [
      "If any provision of this Agreement is held invalid, unenforceable, or illegal by a court or arbitrator of competent jurisdiction, the remaining provisions shall continue in full force and effect, and the invalid provision shall be reformed to the minimum extent necessary to render it enforceable while preserving the parties' original intent.",
      "The Guest may not assign, transfer, or sublet this Agreement, the reservation, or any access to the Property, by operation of law or otherwise, without Summit Lakeside's prior written consent. Summit Lakeside may assign this Agreement to the Property owner, to a successor manager, or to an affiliate, without the Guest's consent.",
      "No failure or delay by Summit Lakeside in exercising any right or remedy under this Agreement operates as a waiver of that right or remedy, and no single or partial exercise of any right precludes any other or further exercise. Any waiver must be in writing and signed by Summit Lakeside to be effective.",
      "This Agreement, together with the confirmation email, the listing page, any written addenda, and the House Rules, constitutes the entire agreement between the parties with respect to the subject matter and supersedes all prior or contemporaneous communications, representations, or agreements, whether oral or written.",
    ],
  },
  {
    id: "amendments",
    number: "44",
    title: "Amendments and Updates to These Terms",
    paragraphs: [
      "Summit Lakeside reserves the right to update or amend this Agreement from time to time. The version of this Agreement in effect at the time a reservation is confirmed controls that reservation, except that any mandatory change required by law or by a third-party platform will apply on its effective date. Material changes will be communicated to the Guest by email where practical.",
    ],
  },
  {
    id: "contact",
    number: "45",
    title: "Contact and Notices",
    paragraphs: [
      "Any notice to Summit Lakeside under this Agreement must be sent in writing to contact@summitlakeside.com or, during an active stay, by text message to the number provided in the pre-arrival communication. Any notice to the Guest may be sent to the email or phone number on the reservation.",
      "If you have any question about these Rental Policies, please contact us before booking. We are happy to walk through any provision, clarify what applies to a specific Property, and work with you on reasonable accommodations.",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

/* Chapters group the 45 sections into a readable arc; each opens with a
   full-bleed parallax image. Ranges are indexes into SECTIONS (in order). */
const CHAPTERS: {
  id: string;
  index: string;
  title: string;
  blurb: string;
  img: string;
  alt: string;
  range: [number, number]; // inclusive slice of SECTIONS
  /* Long chapters get one full-bleed pull-quote after this section id,
     so the column never runs more than ~5 sections without relief. */
  pullquote?: { afterId: string; text: string; cite: string };
}[] = [
  {
    id: "ch-basics",
    index: "I",
    title: "Booking & the basics",
    blurb: "Who can book, how payment works, and what happens when plans change.",
    img: "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/site/policies/ch-basics.jpg",
    alt: "Lakehouse seen from the water, red chairs around a fire pit on the shore",
    range: [0, 7],
  },
  {
    id: "ch-arrival",
    index: "II",
    title: "Arrival & occupancy",
    blurb: "Getting in, who can be there, and the ground rules of the house.",
    img: "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/site/policies/ch-arrival.jpg",
    alt: "Front exterior of a Summit Lakeside home on a clear day",
    range: [8, 11],
  },
  {
    id: "ch-conduct",
    index: "III",
    title: "Conduct & respect",
    blurb: "No parties, quiet hours after ten, and keeping the neighborhood peaceful.",
    img: "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/site/policies/ch-conduct.jpg",
    alt: "The house glowing warmly at night among dark trees",
    range: [12, 17],
  },
  {
    id: "ch-pets",
    index: "IV",
    title: "Pets & parking",
    blurb: "Bringing the dog, and where the cars go.",
    img: "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/29-exterior-image-1.jpg",
    alt: "A forest road covered in autumn leaves",
    range: [18, 19],
  },
  {
    id: "ch-lake",
    index: "V",
    title: "Amenities & the lake",
    blurb: "Hot tubs, saunas, fire pits, and boats — enjoy them, and leave them ready for the next guest.",
    img: "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/22-patio-image-1.jpg",
    alt: "Steaming hot tub on a deck under a pergola in autumn",
    range: [20, 21],
  },
  {
    id: "ch-care",
    index: "VI",
    title: "Caring for the home",
    blurb: "Cleaning, damage, maintenance, and the community that surrounds every house.",
    img: "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-588691/airbnb/10-living-room-3-image-3.jpg",
    alt: "Living room with a stone fireplace and black steel staircase",
    range: [22, 30],
    pullquote: {
      afterId: "damage",
      text: "Report anything broken within two hours of check-in — after that, it\u2019s presumed to have happened on your watch.",
      cite: "\u00a726 \u00b7 Damage, Loss, and Guest Liability",
    },
  },
  {
    id: "ch-fineprint",
    index: "VII",
    title: "The fine print",
    blurb: "Taxes, liability, and governing law — the lawyer's chapter, in full.",
    img: "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-588691/airbnb/61-view-of-the-lake-accross-the-street.jpg",
    alt: "A mirror-still lake reflecting autumn trees",
    range: [31, 44],
    pullquote: {
      afterId: "force-majeure",
      text: "Snow in the Poconos is a feature, not a refund.",
      cite: "\u00a735 \u00b7 Weather, Force Majeure, and Acts of God",
    },
  },
];


function PolicyArticle({ section }: { section: PolicySection }) {
  return (
    <article id={section.id} className="relative scroll-mt-32">
      <div className="flex items-baseline gap-4 mb-5">
        {/* Number hangs in the margin on desktop so heading + body share one axis */}
        <span className="text-sm tabular-nums font-semibold text-primary sm:absolute sm:-left-12 sm:top-1.5">
          {section.number}
        </span>
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
          {section.title}
        </h3>
      </div>
      <div className="space-y-4 text-lg text-foreground/80 leading-relaxed">
        {section.paragraphs?.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {section.items && section.items.length > 0 && (
          <ul className="space-y-3 pt-2">
            {section.items.map((item, i) => (
              <li key={i} className="flex gap-3 border-l-2 border-primary/30 py-0.5">
                <span className="pl-4 block">
                  {item.label && (
                    <span className="font-semibold text-foreground">
                      {item.label}.{" "}
                    </span>
                  )}
                  {item.body}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export default function RentalPoliciesPage() {
  return (
    <div className="min-h-screen flex flex-col font-(family-name:--font-plus-jakarta) bg-background">
      <a
        href="#short-version"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-70 focus:bg-background focus:px-3 focus:py-2 focus:rounded-lg"
      >
        Skip to content
      </a>
      <SiteNav />
      <ReadingProgress />
      <main id="content">

      {/* === HERO — full-viewport lake video === */}
      <HeroMedia video="/videos/boatlake.mp4" poster="/videos/boatlake.jpg">
        <div className="absolute inset-0 flex flex-col justify-end pb-20 sm:pb-28 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto w-full">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
              <span className="h-1 w-1 rounded-full bg-white/70" />
              Rental policies
            </span>
            <h1 className="mt-5 text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[0.92] max-w-4xl text-balance">
              The full terms of staying{" "}
              <span className="whitespace-nowrap">with us.</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mt-6 max-w-2xl leading-relaxed text-pretty">
              Forty-five sections, seven chapters, zero surprises. Eight rules
              cover almost everything — start there.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#short-version"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
              >
                Skip to the 8 rules
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="text-sm text-white/50">Last updated April 19, 2026</p>
            </div>
          </div>
        </div>
      </HeroMedia>

      {/* === CHAPTER NAV — scrollspy bar === */}
      <ChapterNav
        chapters={CHAPTERS.map((c) => ({ id: c.id, index: c.index, title: c.title }))}
      />

      {/* === THE SHORT VERSION === */}
      <section id="short-version" className="relative overflow-hidden bg-[#101820] scroll-mt-16 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                <span className="h-1 w-1 rounded-full bg-primary" />
                The short version
              </span>
              <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-white text-balance">
                Eight rules cover 90% of it.
              </h2>
            </div>
            <p className="text-sm text-white/50 max-w-xs leading-relaxed">
              Tap any card for the full section. The other 10% lives in the
              chapters below.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            {QUICK_RULES.map((r) => (
              <a
                key={r.rule}
                href={r.href}
                className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.07] p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/12 hover:border-white/25 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <r.icon className="h-6 w-6 text-primary" />
                  <ArrowRight className="h-4 w-4 text-white/60 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                </div>
                <p className="mt-4 font-semibold text-white leading-snug">{r.rule}</p>
                <p className="mt-1.5 text-sm text-white/65 leading-relaxed">{r.detail}</p>
                <span className="mt-auto pt-4 text-xs font-medium tabular-nums text-white/70 group-hover:text-primary transition-colors">
                  Read §{r.section}
                </span>
              </a>
            ))}
          </div>
          {/* Binding notice, folded into the band */}
          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 sm:p-5">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-100/90 leading-relaxed">
              <span className="font-semibold text-amber-200">This is a legally binding agreement.</span>{" "}
              By booking or occupying any Summit Lakeside property you agree to
              every provision on this page — the short version included.
            </p>
          </div>
        </div>
      </section>

      {/* === CHAPTERS === */}
      {CHAPTERS.map((chapter) => {
        const sections = SECTIONS.slice(chapter.range[0], chapter.range[1] + 1);
        return (
          <section key={chapter.id} id={chapter.id} className="scroll-mt-28">
            <ParallaxBand img={chapter.img} alt={chapter.alt}>
              <div className="relative flex items-end justify-between gap-6">
                {/* Watermark numeral blends with the plate instead of floating over it */}
                <span
                  aria-hidden
                  className="pointer-events-none select-none absolute -left-2 -top-40 sm:-top-64 text-[11rem] sm:text-[19rem] font-bold leading-none text-white/40 mix-blend-overlay"
                >
                  {chapter.index}
                </span>
                <div className="relative">
                  <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white text-balance [text-shadow:0_1px_24px_rgb(0_0_0/0.45)]">
                    {chapter.title}
                  </h2>
                  <p className="mt-3 text-base sm:text-lg text-white/80 max-w-xl leading-relaxed text-pretty [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]">
                    {chapter.blurb}
                  </p>
                </div>
                <span className="hidden sm:block shrink-0 text-sm text-white/75 tabular-nums pb-2 [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
                  §{sections[0].number}–{sections[sections.length - 1].number}
                </span>
              </div>
            </ParallaxBand>
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-14 sm:space-y-20">
              {sections.map((s) => (
                <div key={s.id} className="space-y-14 sm:space-y-20">
                  <PolicyArticle section={s} />
                  {chapter.pullquote?.afterId === s.id && (
                    <aside className="relative left-1/2 -ml-[50vw] w-screen bg-[#101820] py-16 sm:py-24 print:hidden">
                      <div className="max-w-4xl mx-auto px-6 text-center">
                        <p className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight text-balance">
                          “{chapter.pullquote.text}”
                        </p>
                        <p className="mt-5 text-sm text-white/50 tabular-nums">
                          {chapter.pullquote.cite}
                        </p>
                      </div>
                    </aside>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* === ACKNOWLEDGEMENT === */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 w-full">
        <div className="rounded-3xl border bg-muted/30 p-6 sm:p-10">
          <h3 className="text-2xl font-bold mb-3">Acknowledgement on booking</h3>
          <p className="text-base text-foreground/80 leading-relaxed">
            When you complete the registration step for your reservation, you
            will be asked to sign electronically to confirm that you have read
            and agreed to this Agreement in its entirety. Your electronic
            signature has the same legal force as a handwritten one under the
            federal E-SIGN Act and the Pennsylvania Uniform Electronic
            Transactions Act.
          </p>
        </div>
      </section>

      {/* === CONTACT CTA — dusk bookend to the hero === */}
      <ParallaxBand
        img="https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/site/policies/cta-dusk.jpg"
        alt="The lake at dusk"
        align="center"
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white text-balance [text-shadow:0_1px_24px_rgb(0_0_0/0.45)]">
            Questions about any of this?
          </h2>
          <p className="text-white/80 mt-5 text-lg leading-relaxed [text-shadow:0_1px_16px_rgb(0_0_0/0.5)]">
            Before you book, we&rsquo;re happy to walk through any section,
            clarify what applies to a specific property, or work with you on
            reasonable accommodations. A real person will reply.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              variant="outline"
              className="gap-2 border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              render={<a href="mailto:contact@summitlakeside.com" />}
            >
              <Mail className="h-4 w-4" />
              Email us
            </Button>
            <Button
              size="lg"
              className="gap-2 bg-white text-black hover:bg-white/90"
              render={<Link href="/contact" />}
            >
              <Phone className="h-4 w-4" />
              Contact form
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </ParallaxBand>
      </main>

      <SiteFooter />
    </div>
  );
}
