-- ============================================================
-- Taw3na OCR - Supabase Database Schema
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- 1. CLIENTS TABLE (applicant/passport records)
CREATE TABLE IF NOT EXISTS public.clients (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_name TEXT,
  first_name TEXT,
  passport_number TEXT,
  dob TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  place_of_issue TEXT,
  previous_visa_number TEXT,
  visa_from TEXT,
  visa_to TEXT,
  phone_number TEXT,
  category TEXT NOT NULL DEFAULT '',
  payment JSONB DEFAULT '{}',
  photo_url TEXT,
  photo_url_1 TEXT,
  appointment_date TEXT DEFAULT to_char(now(), 'YYYY-MM-DD'),
  staff_member TEXT DEFAULT '',
  account_email TEXT NOT NULL DEFAULT 'taw3na@mkservice.com',
  user_id UUID DEFAULT '7a7165b8-716d-4d96-aa64-f8a02d1fbc0f'
);

-- Index for fast lookup by passport
CREATE INDEX IF NOT EXISTS idx_clients_passport ON public.clients (passport_number);
-- Index for filtering by account email
CREATE INDEX IF NOT EXISTS idx_clients_account_email ON public.clients (account_email);

-- Disable RLS for now (or set up proper auth later)
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

-- 2. SERVICE PRICING TABLE
CREATE TABLE IF NOT EXISTS public.service_pricing (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  price TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed pricing data (matches DEFAULT_CONFIG_PRICES in src/types.ts)
INSERT INTO public.service_pricing (category, price, description) VALUES
  ('ALG1', '16', 'Standard Algeria Category 1'),
  ('ALG2', '4',  'Standard Algeria Category 2'),
  ('ALG3', '2',  'Standard Algeria Category 3'),
  ('ORN1', '16', 'Oran District Priority Category 1'),
  ('ORN2', '11', 'Oran District Standard Category 2'),
  ('ORN3', '5.5', 'Oran District Economy Category 3')
ON CONFLICT (category) DO NOTHING;

-- 3. AGENCY STAFF TABLE
CREATE TABLE IF NOT EXISTS public.agency_staff (
  id BIGSERIAL PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed staff data (matches DEFAULT_STAFF_MEMBERS in src/types.ts)
INSERT INTO public.agency_staff (staff_id, name, avatar_url) VALUES
  ('BARRY', 'Barry', NULL),
  ('MOSTAPHA', 'Mostapha', NULL),
  ('YOUCEF', 'Youcef', NULL)
ON CONFLICT (staff_id) DO NOTHING;
