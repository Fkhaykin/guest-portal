-- Add 'open' to the invoice_status enum
alter type public.invoice_status add value 'open' before 'draft';
