// Airbnb listing photos per property — keyed by property name (as stored in DB)
// Photos are in display order (hero first) with ?im_w=1200 for high-res gallery use

type AirbnbPhotoSet = {
  airbnbId: string;
  photos: string[];
};

const AIRBNB_PHOTOS: Record<string, AirbnbPhotoSet> = {
  // Airbnb 52923530 — "Lakefront Mansion: Hot tub/Sauna/Games/Gym & Boats"
  "Lakefront Mansion w/ 3 Decks, Hot Tub, Boats, & Game Room!": {
    airbnbId: "52923530",
    photos: [
      "https://a0.muscache.com/im/pictures/f5f31bab-faec-4b26-b3c9-cb356293126a.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/1f3f8cb2-8db6-450c-93de-1404b66853df.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/0f3c2d87-7cd0-45bc-bf57-efdcbda6ac7e.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/ec9df551-d43c-4294-ad20-7d1ba43b4840.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/11d2c493-87e1-4534-acdc-e1ff0f1f5832.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/79e4897e-1613-425a-bc5b-1bb4855c83da.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/86f5afc5-cfd5-4a5e-8dad-b9585d9d38a6.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/5a38ed1b-c546-4f5b-963c-10f1e60dd5ab.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/19bc7783-e053-41be-baf7-5588ee941de9.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/274c65ab-6fa5-4834-8985-31f9a87bdaf6.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/3b7adad4-1ede-468d-9b72-e09b20428a06.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/14ab5084-0a96-4d1d-9c02-4110a02e33e1.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/ab3cdabd-f967-4b55-bdda-a52802b377b6.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/4e2cbe1c-3b67-4177-9b5c-0ebe802dd548.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/38da1540-5998-4132-8b2e-131bfe1c9bb7.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/5ce084b8-38ea-4bd9-9bbd-d16629eb6a21.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/989a1855-dff4-4757-8167-eff8330352be.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/90e1b041-4527-4e40-83a1-d7c84e154c47.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/0e486a34-6ae4-45cb-bce1-22ce19b09e06.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/c02dd3e1-abeb-4e10-a5b7-a7123499f2e7.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/ec19fe5c-45e1-4985-b915-5b3b84321453.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/11fcc914-01ca-4f6c-923b-6dbc5c075ac4.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/1e516f2c-54b0-44e6-9018-e519fbb5f624.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/868ff7df-8bc6-4ccc-b92b-fae32bdff018.jpg?im_w=1200",
    ],
  },

  // Airbnb 44618068 — "Lakefront Resort w/ HotTub, Fire Pit, Games, Boats"
  "Lakefront Home w/ Hot Tub, Game Room, Deck, Boats, Fire Pit": {
    airbnbId: "44618068",
    photos: [
      "https://a0.muscache.com/im/pictures/6e8e7f2f-dd7b-4e29-8719-6e0d6ab78688.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/bb8633bf-fe15-4b03-84a4-d5174bea0515.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/6699f47b-39f8-46f2-a086-f4ec381987ac.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/ff8a2e99-4e3f-4cea-9111-761eb53dbc83.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/888f3203-3fc2-4810-a9c3-fd7c648a62af.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/f428ee04-7795-41c3-bb66-f08bc3d04066.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/2f26f0d0-a403-4d2f-8af3-0cbbaa04f1cc.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/b975f242-e8ff-4c9c-85f0-3a3c3cbb06e2.jpg?im_w=1200",
    ],
  },

  // Airbnb 51672067 — "Cozy Lakehouse" — 47 current listing photos (scraped Jun 2026,
  // self-hosted; replaces the prior 11 stale URLs). Exterior + full room set.
  "Cozy Lakefront Home w/ Game Room, Hot Tub, Fire Pit, & Boats": {
    airbnbId: "51672067",
    photos: [
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/01-photo.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/02-living-room-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/03-living-room-image-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/04-living-room-image-4.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/05-full-kitchen-image-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/06-full-kitchen-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/07-full-kitchen-image-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/08-dining-area-image-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/09-dining-area-image-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/10-bedroom-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/11-bedroom-1-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/12-bedroom-1-image-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/13-bedroom-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/14-bedroom-2-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/15-bedroom-2-image-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/16-bedroom-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/17-full-bathroom-1-image-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/18-full-bathroom-2-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/19-full-bathroom-2-image-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/20-backyard-image-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/21-backyard-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/22-patio-image-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/23-patio-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/24-patio-image-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/25-patio-image-4.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/26-inflatable-screen-with-projector.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/27-inflatable-screen-with-projector.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/28-laundry-area-image-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/29-exterior-image-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/30-game-room-image-1.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/31-game-room-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/32-game-room-image-3.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/33-game-room-image-4.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/34-game-room-image-5.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/35-game-room-image-6.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/36-additional-photos-image-2.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/37-additional-photos-image-5.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/38-additional-photos-image-6.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/39-additional-photos-image-7.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/40-additional-photos-image-8.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/41-additional-photos-image-9.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/42-additional-photos-image-10.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/43-additional-photos-image-11.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/44-additional-photos-image-12.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/45-additional-photos-image-13.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/46-additional-photos-image-14.jpg",
      "https://arvbaoeszakyuxqhkogz.supabase.co/storage/v1/object/public/property-images/lodgify-368827/airbnb/47-additional-photos-image-15.jpg",
    ],
  },

  // Airbnb 49400408 — "Huge Pet Friendly Lakeview w/ Game Room & Hot Tub"
  "Lake Adjacent Home w/ Hot Tub, Game Room, Boats, Fenced Yard": {
    airbnbId: "49400408",
    photos: [
      "https://a0.muscache.com/im/pictures/2a8bbc05-e02f-48e0-93b9-fe37adeaee3a.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/5e71465d-8c6e-426b-9717-3bc0b117bdbf.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/370a991e-fefb-4218-8083-a52775bc931a.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/8ca637ec-60cf-453a-9a83-325d0f5faa01.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/5e2cb36e-ae98-4912-9357-5ee514453b49.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/2a59fea8-26f5-40ec-b471-bf5183ec963f.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/92f8fc96-754f-469f-88c3-4311f0d05a92.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/379e07af-9cbc-4a09-b40e-c1704ff2be9b.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/cbb17f33-4bb8-4bde-9e32-96430eba30f7.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/d413c38e-016e-492a-834f-7b58c7cda776.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/2e716442-9428-452a-865d-d2153b6909c5.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/ce30c655-fcfa-4373-a1df-8bbc01fffb2e.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/ec7c8f0c-c1f3-4cb9-ad19-2881dcc174c2.jpg?im_w=1200",
    ],
  },

  // Airbnb 49461808 — "Luxury Lakeview Cabin w/ Hot Tub, Sauna & 3 Decks"
  "Lakeview Chalet w/ Hot Tub, Sauna, Decks, Boats, & Fire Pit!": {
    airbnbId: "49461808",
    photos: [
      "https://a0.muscache.com/im/pictures/bb8633bf-fe15-4b03-84a4-d5174bea0515.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/ff8a2e99-4e3f-4cea-9111-761eb53dbc83.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/2f26f0d0-a403-4d2f-8af3-0cbbaa04f1cc.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/6699f47b-39f8-46f2-a086-f4ec381987ac.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/888f3203-3fc2-4810-a9c3-fd7c648a62af.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/f428ee04-7795-41c3-bb66-f08bc3d04066.jpg?im_w=1200",
      "https://a0.muscache.com/im/pictures/b975f242-e8ff-4c9c-85f0-3a3c3cbb06e2.jpg?im_w=1200",
    ],
  },
};

/** Look up Airbnb photos for a property by name. Returns photo URLs or null. */
export function getAirbnbPhotos(propertyName: string): string[] | null {
  const entry = AIRBNB_PHOTOS[propertyName];
  return entry?.photos ?? null;
}
