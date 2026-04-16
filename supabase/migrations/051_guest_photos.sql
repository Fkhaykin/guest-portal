-- Guest photo album: guests upload photos, admin approves, displayed as carousels
-- Incentive: 3+ approved photos = free late checkout

CREATE TABLE guest_photo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registration(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  caption text,
  guest_name text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_photo_property ON guest_photo(property_id, approved, created_at DESC);
CREATE INDEX idx_guest_photo_registration ON guest_photo(registration_id);

-- Track whether late checkout reward has been claimed for photo uploads
ALTER TABLE registration ADD COLUMN photo_reward_claimed boolean NOT NULL DEFAULT false;

-- Storage bucket for guest photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('guest-photos', 'guest-photos', false)
ON CONFLICT (id) DO NOTHING;
