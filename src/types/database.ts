// This file will be replaced by auto-generated types from Supabase CLI:
// npx supabase gen types typescript --local > src/types/database.ts
//
// For now, we define the types manually to match our schema.

export type GuestListEntry = {
  first_name: string;
  last_name: string;
  age_group: "over_21" | "under_21" | "infant";
};

export type PetEntry = {
  name: string;
  kind: string;
  rabies_doc_path: string | null;
  vaccination_doc_path: string | null;
};

export type CleaningPhoto = {
  room: string;
  path: string;
  uploaded_at: string;
};

export type CleaningChecklistItem = {
  item: string;
  room: string;
  checked: boolean;
};

export type InvoiceLineItem = {
  description: string;
  type: "cleaning" | "pet_fee" | "extra" | "reimbursement";
  property_name?: string;
  registration_id?: string;
  amount: number; // cents
};

export type InvoiceAdjustment = {
  description: string;
  amount: number; // cents (positive = add, negative = deduct)
  reason: string;
};

export type InvoiceAttachment = {
  name: string;
  path: string;
  uploaded_at: string;
};

export type InvoiceStatus = "draft" | "submitted" | "approved" | "paid";

export type UpsellEntry = {
  type: string;
  label: string;
  price_cents: number;
  stripe_session_id?: string;
  status: string;
  meta?: Record<string, unknown>;
};

export type Database = {
  public: {
    Tables: {
      host: {
        Row: {
          id: string;
          auth_user_id: string;
          email: string;
          full_name: string;
          signature_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          email: string;
          full_name: string;
          signature_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          email?: string;
          full_name?: string;
          signature_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      property: {
        Row: {
          id: string;
          host_id: string;
          name: string;
          slug: string;
          address: string | null;
          description: string | null;
          timezone: string;
          cover_image_url: string | null;
          theme_config: Record<string, unknown>;
          stripe_account_id: string | null;
          lodgify_property_id: number | null;
          lodgify_last_synced_at: string | null;
          is_active: boolean;
          lot_section: string | null;
          owner_name: string | null;
          owner_mailing_address: string | null;
          owner_phone: string | null;
          owner_email: string | null;
          hoa_submission_email: string | null;
          hoa_type: string;
          emergency_contact_name: string | null;
          emergency_contact_relationship: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_phone_2: string | null;
          rental_agent_enabled: boolean;
          rental_agency_name: string | null;
          rental_agency_contact: string | null;
          owner_signature_url: string | null;
          max_guests: number;
          nickname: string | null;
          cleaning_fee_cents: number;
          pet_fee_cents: number;
          listing_urls: Record<string, string>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          name: string;
          slug: string;
          address?: string | null;
          description?: string | null;
          timezone?: string;
          cover_image_url?: string | null;
          theme_config?: Record<string, unknown>;
          stripe_account_id?: string | null;
          lodgify_property_id?: number | null;
          lodgify_last_synced_at?: string | null;
          is_active?: boolean;
          lot_section?: string | null;
          owner_name?: string | null;
          owner_mailing_address?: string | null;
          owner_phone?: string | null;
          owner_email?: string | null;
          hoa_submission_email?: string | null;
          hoa_type?: string;
          emergency_contact_name?: string | null;
          emergency_contact_relationship?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_phone_2?: string | null;
          rental_agent_enabled?: boolean;
          rental_agency_name?: string | null;
          rental_agency_contact?: string | null;
          owner_signature_url?: string | null;
          max_guests?: number;
          nickname?: string | null;
          cleaning_fee_cents?: number;
          pet_fee_cents?: number;
          listing_urls?: Record<string, string>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          name?: string;
          slug?: string;
          address?: string | null;
          description?: string | null;
          timezone?: string;
          cover_image_url?: string | null;
          theme_config?: Record<string, unknown>;
          stripe_account_id?: string | null;
          lodgify_property_id?: number | null;
          lodgify_last_synced_at?: string | null;
          is_active?: boolean;
          lot_section?: string | null;
          owner_name?: string | null;
          owner_mailing_address?: string | null;
          owner_phone?: string | null;
          owner_email?: string | null;
          hoa_submission_email?: string | null;
          hoa_type?: string;
          emergency_contact_name?: string | null;
          emergency_contact_relationship?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_phone_2?: string | null;
          rental_agent_enabled?: boolean;
          rental_agency_name?: string | null;
          rental_agency_contact?: string | null;
          owner_signature_url?: string | null;
          max_guests?: number;
          nickname?: string | null;
          cleaning_fee_cents?: number;
          pet_fee_cents?: number;
          listing_urls?: Record<string, string>;
          created_at?: string;
          updated_at?: string;
        };
      };
      guest: {
        Row: {
          id: string;
          auth_user_id: string | null;
          email: string | null;
          phone: string | null;
          full_name: string;
          mailing_address: string | null;
          lodgify_guest_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          email?: string | null;
          phone?: string | null;
          full_name: string;
          mailing_address?: string | null;
          lodgify_guest_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          email?: string | null;
          phone?: string | null;
          full_name?: string;
          mailing_address?: string | null;
          lodgify_guest_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      registration: {
        Row: {
          id: string;
          property_id: string;
          guest_id: string;
          check_in_date: string;
          check_out_date: string;
          num_guests: number;
          notes: string | null;
          status: "active" | "completed" | "cancelled";
          lodgify_booking_id: number | null;
          guest_list: GuestListEntry[] | null;
          pets: PetEntry[] | null;
          upsells: UpsellEntry[] | null;
          signature_url: string | null;
          booking_source: string | null;
          total_amount_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          guest_id: string;
          check_in_date: string;
          check_out_date: string;
          num_guests?: number;
          notes?: string | null;
          status?: "active" | "completed" | "cancelled";
          lodgify_booking_id?: number | null;
          guest_list?: GuestListEntry[] | null;
          pets?: PetEntry[] | null;
          upsells?: UpsellEntry[] | null;
          signature_url?: string | null;
          booking_source?: string | null;
          total_amount_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          guest_id?: string;
          check_in_date?: string;
          check_out_date?: string;
          num_guests?: number;
          notes?: string | null;
          status?: "active" | "completed" | "cancelled";
          lodgify_booking_id?: number | null;
          guest_list?: GuestListEntry[] | null;
          pets?: PetEntry[] | null;
          upsells?: UpsellEntry[] | null;
          signature_url?: string | null;
          booking_source?: string | null;
          total_amount_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      vehicle: {
        Row: {
          id: string;
          registration_id: string;
          make: string | null;
          model: string | null;
          color: string | null;
          license_plate: string;
          state_or_region: string | null;
          year: string | null;
          driver_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          make?: string | null;
          model?: string | null;
          color?: string | null;
          license_plate: string;
          state_or_region?: string | null;
          year?: string | null;
          driver_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          registration_id?: string;
          make?: string | null;
          model?: string | null;
          color?: string | null;
          license_plate?: string;
          state_or_region?: string | null;
          year?: string | null;
          driver_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      service: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          description: string | null;
          price_cents: number;
          currency: string;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          description?: string | null;
          price_cents: number;
          currency?: string;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          name?: string;
          description?: string | null;
          price_cents?: number;
          currency?: string;
          image_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment: {
        Row: {
          id: string;
          registration_id: string | null;
          service_id: string | null;
          guest_id: string;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          amount_cents: number;
          currency: string;
          status: "pending" | "completed" | "failed" | "refunded";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id?: string | null;
          service_id?: string | null;
          guest_id: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          amount_cents: number;
          currency?: string;
          status?: "pending" | "completed" | "failed" | "refunded";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          registration_id?: string | null;
          service_id?: string | null;
          guest_id?: string;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          amount_cents?: number;
          currency?: string;
          status?: "pending" | "completed" | "failed" | "refunded";
          created_at?: string;
          updated_at?: string;
        };
      };
      video: {
        Row: {
          id: string;
          property_id: string;
          title: string;
          description: string | null;
          storage_path: string;
          thumbnail_url: string | null;
          duration_seconds: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          title: string;
          description?: string | null;
          storage_path: string;
          thumbnail_url?: string | null;
          duration_seconds?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          title?: string;
          description?: string | null;
          storage_path?: string;
          thumbnail_url?: string | null;
          duration_seconds?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      qr_code: {
        Row: {
          id: string;
          property_id: string;
          code: string;
          label: string;
          target_type: "video" | "home" | "services" | "faq" | "registration" | "custom_url";
          target_id: string | null;
          custom_url: string | null;
          scan_count: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          code: string;
          label: string;
          target_type: "video" | "home" | "services" | "faq" | "registration" | "custom_url";
          target_id?: string | null;
          custom_url?: string | null;
          scan_count?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          code?: string;
          label?: string;
          target_type?: "video" | "home" | "services" | "faq" | "registration" | "custom_url";
          target_id?: string | null;
          custom_url?: string | null;
          scan_count?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      faq: {
        Row: {
          id: string;
          property_id: string;
          question: string;
          answer: string;
          category: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          question: string;
          answer: string;
          category?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          question?: string;
          answer?: string;
          category?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      promotion: {
        Row: {
          id: string;
          property_id: string;
          title: string;
          description: string | null;
          image_url: string | null;
          promo_code: string | null;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          title: string;
          description?: string | null;
          image_url?: string | null;
          promo_code?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          title?: string;
          description?: string | null;
          image_url?: string | null;
          promo_code?: string | null;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      registration_update_log: {
        Row: {
          id: string;
          registration_id: string;
          changed_by: string;
          change_type: string;
          summary: string | null;
          previous_data: Record<string, unknown> | null;
          new_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          changed_by: string;
          change_type: string;
          summary?: string | null;
          previous_data?: Record<string, unknown> | null;
          new_data?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          registration_id?: string;
          changed_by?: string;
          change_type?: string;
          summary?: string | null;
          previous_data?: Record<string, unknown> | null;
          new_data?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      cleaner: {
        Row: {
          id: string;
          host_id: string;
          name: string;
          phone: string | null;
          password_hash: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          name: string;
          phone?: string | null;
          password_hash: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          name?: string;
          phone?: string | null;
          password_hash?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      cleaner_property: {
        Row: {
          id: string;
          cleaner_id: string;
          property_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cleaner_id: string;
          property_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          cleaner_id?: string;
          property_id?: string;
          created_at?: string;
        };
      };
      cleaner_session: {
        Row: {
          id: string;
          cleaner_id: string;
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cleaner_id: string;
          token: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          cleaner_id?: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
      };
      cleaning_status: {
        Row: {
          id: string;
          registration_id: string;
          cleaner_id: string | null;
          is_cleaned: boolean;
          cleaned_at: string | null;
          fulfilled_upsells: string[];
          photos: CleaningPhoto[];
          checklist: CleaningChecklistItem[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          cleaner_id?: string | null;
          is_cleaned?: boolean;
          cleaned_at?: string | null;
          fulfilled_upsells?: string[];
          photos?: CleaningPhoto[];
          checklist?: CleaningChecklistItem[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          registration_id?: string;
          cleaner_id?: string | null;
          is_cleaned?: boolean;
          cleaned_at?: string | null;
          fulfilled_upsells?: string[];
          photos?: CleaningPhoto[];
          checklist?: CleaningChecklistItem[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      recommendation: {
        Row: {
          id: string;
          property_id: string;
          name: string;
          category: "restaurant" | "attraction" | "activity" | "shopping" | "other";
          description: string | null;
          address: string | null;
          website_url: string | null;
          map_url: string | null;
          image_url: string | null;
          rating: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          property_id: string;
          name: string;
          category: "restaurant" | "attraction" | "activity" | "shopping" | "other";
          description?: string | null;
          address?: string | null;
          website_url?: string | null;
          map_url?: string | null;
          image_url?: string | null;
          rating?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          property_id?: string;
          name?: string;
          category?: "restaurant" | "attraction" | "activity" | "shopping" | "other";
          description?: string | null;
          address?: string | null;
          website_url?: string | null;
          map_url?: string | null;
          image_url?: string | null;
          rating?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// Convenience types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
