-- Support multiple HOA PDF templates per property
-- hoa_type determines which PDF template is generated
ALTER TABLE property ADD COLUMN hoa_type text NOT NULL DEFAULT 'pepoa';

-- BMLC-specific owner fields (emergency contact, rental agent)
ALTER TABLE property ADD COLUMN emergency_contact_name text;
ALTER TABLE property ADD COLUMN emergency_contact_relationship text;
ALTER TABLE property ADD COLUMN emergency_contact_phone text;
ALTER TABLE property ADD COLUMN emergency_contact_phone_2 text;
ALTER TABLE property ADD COLUMN rental_agent_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE property ADD COLUMN rental_agency_name text;
ALTER TABLE property ADD COLUMN rental_agency_contact text;
