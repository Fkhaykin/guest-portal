// Per-house check-in instruction automessages, seeded from the actual send
// history (docs/automessages/04-check-in-instructions.md). Editable per house
// in the Auto Messages tab (stored under guest_message_settings.house_checkin_instructions).
import type { HouseKey } from "./quick-replies";

export const HOUSE_KEYS: HouseKey[] = ["lakehouse", "chalet", "manor", "cottage", "mansion"];

export const HOUSE_LABELS: Record<HouseKey, string> = {
  lakehouse: "Lakehouse (484 Lakeside Dr)",
  chalet: "Chalet (475 Lakeside Dr)",
  manor: "Manor (424 Lakeside Dr)",
  cottage: "Cottage (449 Lakeside Dr)",
  mansion: "Mansion / Chateau (279 East Shore Dr)",
};

const PENN_ESTATES_ARRIVAL = `Arriving at the community:

Penn Estates is a gated community — all guests must check in at the Main Gate, where the registered guest presents a valid driver's license to receive a printed gate pass for the duration of the stay.

Detailed driving directions and gate check-in info are in our guest portal: guest.summitlakeside.com

Do not share gate passes or sneak additional vehicles/guests that haven't been registered. I cannot emphasize this enough: they have cameras, security will catch you and give an unreasonably high citation. Let's follow the rules and avoid this please!`;

const DELIVERIES = `GUESTS & DELIVERIES:

All guests must be noted on the registration form. Guests who are not on the form will be denied entry at the gate.

To allow a food, Uber, or any other delivery driver through the gate, register the delivery in our guest portal (guest.summitlakeside.com) or send us a message, and we will call it into the gate. Gatehouse staff will not allow any driver through without a registration form or a delivery registration.

Our general store inside the community is Archie's Corner (www.archiescorner.com) and is available for food and any last minute needs at 443 Penn Estates Dr, next to the pools and community center. We recommend the breakfast sandwich, Italian Hero, and chicken fingers!`;

const QUIET_TRASH = `QUIET HOURS:
- 11pm to 7am. Please be respectful to neighbors at all times.

TRASH:
All trash should be placed in the bins just outside the garage door, they are mixed use trash and recycling so either works. It is picked up between Monday morning and Tuesday night directly from where they are, so no need to bring anything to the street. If they are filled up and you are checking out prior to pick up, just place your bags next to the bins and we will take care of it from there.`;

const CHECKOUT = `Check-out: {{check_out_time}}

Need a later check-out? Availability and booking are in our guest portal (guest.summitlakeside.com). Leaving after check-out without prior notice will incur a $50 fee.

Please be aware that the cleaning fee is for basic whole house cleaning. Anything out of the ordinary (such as excessive trash, unremovable stains, etc) will incur extra cleaning fees as per the rental agreement.

- If you have any questions/issues, feel free to contact us and we will try our best to make your stay as comfortable and pleasant as possible. Enjoy your stay and have a wonderful vacation!

Thank you!
Feliks
Summit Lakeside Rentals
732-213-8571
alt. 732-979-3855`;

const HEADER = `Hey {{guest_name}},

We're so excited to host your stay in the beautiful Poconos! Below you will find check-in instructions as well as some general information about the home.

Check-in: {{check_in_date}} at {{check_in_time}}
Check-out: {{check_out_date}} at {{check_out_time}}`;

export const HOUSE_CHECKIN_SUBJECT = "Check-in instructions — {{property_name}}";

export const HOUSE_CHECKIN_TEMPLATES: Record<HouseKey, string> = {
  lakehouse: `${HEADER}

${PENN_ESTATES_ARRIVAL}

Entry Door Lock: 8550

- To unlock from outside: Tap the Yale button on the door lock. A keypad will appear. Use the pin provided above, and hit the check mark to submit the code.

To lock from outside: Tap the "Yale" logo. Make sure it is locked.

Parking:
- Driveway is h-shaped and is on a hill. Be careful and drive slowly up and down the driveway. You can fit up to 6 cars.

DO NOT PARK IN THE STREET.

Wifi:

Name: Lakeside
Password: relax484

Please see the House Manual in our guest portal for all info on Safety, Temperature Control, use of Sauna, Hot Tub, Fireplace, TVs, and more.

${DELIVERIES}

${QUIET_TRASH}

${CHECKOUT}`,

  chalet: `${HEADER}

${PENN_ESTATES_ARRIVAL}

Entry Door Lock:
- There is a lock box on the ground floor door under the deck. Use code 8550 to unlock the box and access the door key. If you have trouble, you want to lock halfway before closing so the little latch is partially out, firmly slide the door closed, and lock the rest of the way.

Please return the key to the lockbox anytime you leave the house and venture out. This will ensure you don't lock yourself out. Losing the key will result in a $50 replacement fee.

Parking:
- Be careful and drive slowly up and down the driveway. You can fit up to 5 cars.

DO NOT PARK IN THE STREET.

Wifi:

Name: The Chalet
Password: relax475

Please see the House Manual in our guest portal for all info on Safety, Temperature Control, use of Sauna, Hot Tub, Fireplace, TVs, and more.

${DELIVERIES}

${QUIET_TRASH}

${CHECKOUT}`,

  manor: `${HEADER}

${PENN_ESTATES_ARRIVAL}

Entry Door Lock:

The code to the door is 8550. Enter the code and press the bottom-left "unlock" button.

Parking:
- Driveway is wide but has a narrow entrance, please be careful not to drive into the culvert to the left and right of the driveway.

Parking on the gravel to the left of the paved driveway is permitted. You can fit up to 6 cars total.

DO NOT PARK IN THE STREET.

Wifi:

Name: Lakeside Manor - 5G
Password: relax424

Please see the House Manual in our guest portal for all info on Safety, Temperature Control, Hot Tub, Fireplace, TVs, Community Amenities, and Canoes/Kayaks.

${DELIVERIES}

${QUIET_TRASH}

PLEASE CLEAN UP YOUR DOG'S POOP FROM THE BACK YARD!

${CHECKOUT}`,

  cottage: `${HEADER}

${PENN_ESTATES_ARRIVAL}

Entry Door Lock:
Your door code is 4867.

- To unlock the door from the outside, enter the code and press the enter button. Turn the knob counter-clockwise.
- To lock the door from the outside, enter the code and press the enter button. Turn the knob clockwise.

Parking:
- Driveway is gravel and on a hill. Be careful and drive slowly up and down the driveway. You can fit up to 5 cars.

DO NOT PARK IN THE STREET.

Wifi:

Name: Lakehouse Wifi
Password: relax449

Safety:
- Fire Extinguisher is under the sink.
- First Aid Kit is in the labeled cabinet in the kitchen.
- Life Jackets for Kayaks are located in the downstairs closet.
- Call 911 for any other emergencies and please contact us immediately.

Temperature:
- Each room has its own thermostat for heat that can be adjusted manually with the controls.
- Window AC units are controlled individually in each room.
- Hot water heater holds 50 gallons. Please space baths and showers accordingly.

HOT TUB:
- Hot tub is always on and ready to use. NO FOOD OR DRINKS IN HOT TUB! Keep the lid closed when not in use, wash off lotions before entering, and drop one chlorine cup (cabinet above the kitchen microwave) into the tub after each use.

${DELIVERIES}

${QUIET_TRASH}

${CHECKOUT}`,

  mansion: `${HEADER}

Entry Door Lock code: 8550

- To unlock from outside: Enter the code and press the big button. Turn the knob counter-clockwise.

To lock from outside: Enter the code and press the big button. Turn the knob clockwise to lock.

Parking:
- Driveway is S-shaped and is on a steep hill. Please be careful and drive slowly up and down the driveway. You can fit up to 6 cars.

DO NOT PARK IN THE STREET.

Wifi:

Name: Summit Lakefront Manor
Password: relax279

Amenities:

Pools and courts are at:
504 Archers Mark, East Stroudsburg PA 18301

You'll need your amenity passes; if you did not get them at the gate when you entered, you can get them at the office during weekdays until 5pm:
121 Pocahontas Road, East Stroudsburg PA 18301 — Office: 570-421-2129
After 5pm weekdays, or after 9am weekends, call security: 570-242-4504

Temperature:
- The house has central heating and air conditioning. Set the temperature for the whole house (except basement) on the Nest in the Dining Room; the basement thermostat is next to the ping pong table.

HOT TUB:
- Hot tub is always on and ready to use. NO FOOD OR DRINKS IN HOT TUB! Keep the lid closed when not in use, wash off lotions before entering, and drop one chlorine cup (cabinet above the kitchen microwave) into the tub after each use.

SAUNA:
- Press the power button and choose your temperature. No shoes, always wear clothes, max 15 mins consecutively, never pour water on the electric heater. Exit immediately if you feel dizzy or uncomfortable.

${QUIET_TRASH}

${CHECKOUT}`,
};
