-- Add booking source to registration (populated from Lodgify channel)
ALTER TABLE registration ADD COLUMN booking_source text;

-- Add listing URLs to property (JSON map of platform → URL)
-- e.g. {"Airbnb": "https://airbnb.com/rooms/123", "VRBO": "https://vrbo.com/456"}
ALTER TABLE property ADD COLUMN listing_urls jsonb NOT NULL DEFAULT '{}'::jsonb;
