-- Remove guest photo album feature entirely.

DROP TABLE IF EXISTS guest_photo;

ALTER TABLE registration DROP COLUMN IF EXISTS photo_reward_claimed;

-- Remove any photo-reward late-checkout entries from existing upsells JSON.
UPDATE registration
SET upsells = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(upsells) elem
  WHERE NOT (elem -> 'meta' ->> 'source' = 'photo_reward')
)
WHERE upsells IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(upsells) elem
    WHERE elem -> 'meta' ->> 'source' = 'photo_reward'
  );

-- Drop storage bucket and any leftover objects.
DELETE FROM storage.objects WHERE bucket_id = 'guest-photos';
DELETE FROM storage.buckets WHERE id = 'guest-photos';
