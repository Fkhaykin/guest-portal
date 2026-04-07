-- Delivery & rideshare registration table
CREATE TABLE delivery_rideshare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registration(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('rideshare', 'food_grocery', 'other')),
  provider text,
  num_cars integer DEFAULT 1,
  arrival_date date NOT NULL,
  has_return boolean DEFAULT false,
  return_cars integer,
  return_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_rideshare_reg ON delivery_rideshare(registration_id);
CREATE INDEX idx_delivery_rideshare_prop ON delivery_rideshare(property_id);

ALTER TABLE delivery_rideshare ENABLE ROW LEVEL SECURITY;

-- Hosts can view for their properties
CREATE POLICY "Hosts can view delivery_rideshare"
  ON delivery_rideshare FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM property p
      JOIN host h ON h.id = p.host_id
      WHERE p.id = delivery_rideshare.property_id
        AND h.auth_user_id = auth.uid()
    )
  );

-- Service role handles inserts from API routes (no guest RLS needed)
