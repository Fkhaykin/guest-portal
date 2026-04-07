-- Add per-property cleaning photo areas (customizable list of areas requiring photos)
ALTER TABLE property
ADD COLUMN cleaning_photo_areas text[] NOT NULL DEFAULT ARRAY[
  'Front Yard',
  'Entryway',
  'Living Room',
  'Dining Room',
  'Kitchen',
  'Bedroom 1',
  'Bedroom 2',
  'Bedroom 3',
  'Bedroom 4',
  'Bedroom 5',
  'Bathroom 1',
  'Bathroom 2',
  'Bathroom 3',
  'Bathroom 4',
  'Family Room',
  'Game Room',
  'Deck 1',
  'Deck 2',
  'BBQ Grill',
  'Patio',
  'Hot Tub',
  'Sauna',
  'Lake area',
  'Driveway'
];
