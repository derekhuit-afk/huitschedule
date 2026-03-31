-- ═══════════════════════════════════════════════════════════
-- HUITSCHEDULE — Native Scheduling Schema v1.0
-- Replaces Cal.com across all Huit.AI products
-- CRMEX · HyperLoanAI · APEX
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── EVENT TYPES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_event_types (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  duration_mins   INTEGER NOT NULL DEFAULT 30,
  price_cents     INTEGER DEFAULT 0,
  color           TEXT DEFAULT '#00d4aa',
  icon            TEXT DEFAULT '📅',
  description     TEXT,
  category        TEXT DEFAULT 'mortgage',
  is_active       BOOLEAN DEFAULT TRUE,
  requires_intake BOOLEAN DEFAULT FALSE,
  intake_fields   TEXT[] DEFAULT '{}',
  location_type   TEXT DEFAULT 'video',
  location_value  TEXT,
  buffer_mins     INTEGER DEFAULT 15,
  min_notice_hrs  INTEGER DEFAULT 2,
  max_advance_days INTEGER DEFAULT 60,
  confirmation_msg TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sched_evt_slug ON schedule_event_types(slug);

-- ── AVAILABILITY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_availability (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active       BOOLEAN DEFAULT TRUE,
  windows         JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);

-- ── DATE OVERRIDES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_date_overrides (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID,
  override_date   DATE NOT NULL,
  is_active       BOOLEAN DEFAULT FALSE,
  windows         JSONB DEFAULT '[]',
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, override_date)
);

-- ── BOOKINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type_id   UUID NOT NULL REFERENCES schedule_event_types(id),
  lead_id         UUID,

  -- Client info
  client_name     TEXT NOT NULL,
  client_email    TEXT NOT NULL,
  client_phone    TEXT,
  client_timezone TEXT,

  -- Schedule
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_mins   INTEGER NOT NULL,

  -- Status: confirmed | rescheduled | canceled | completed | no_show
  status          TEXT NOT NULL DEFAULT 'confirmed',

  -- Location
  location_type   TEXT DEFAULT 'video',
  meeting_url     TEXT,

  -- Intake data
  intake_data     JSONB DEFAULT '{}'::jsonb,

  -- Notifications
  confirm_sent_at   TIMESTAMPTZ,
  reminder_24h_at   TIMESTAMPTZ,
  reminder_1h_at    TIMESTAMPTZ,
  followup_sent_at  TIMESTAMPTZ,

  -- Payment
  payment_status  TEXT DEFAULT 'none',
  payment_amount  INTEGER DEFAULT 0,
  stripe_payment_id TEXT,

  -- Cancel/reschedule
  canceled_at     TIMESTAMPTZ,
  cancel_reason   TEXT,
  rescheduled_from TIMESTAMPTZ,
  reschedule_count INTEGER DEFAULT 0,

  -- Notes
  admin_notes     TEXT,
  client_notes    TEXT,

  -- Source tracking
  source          TEXT DEFAULT 'direct',
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_book_date ON schedule_bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sched_book_lead ON schedule_bookings(lead_id);
CREATE INDEX IF NOT EXISTS idx_sched_book_status ON schedule_bookings(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sched_book_email ON schedule_bookings(client_email);

-- ── INTAKE FIELD DEFINITIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_intake_fields (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_key       TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  field_type      TEXT NOT NULL DEFAULT 'text',
  options         TEXT[],
  is_required     BOOLEAN DEFAULT FALSE,
  display_order   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE schedule_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_intake_fields ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_all_evt" ON schedule_event_types;
  CREATE POLICY "service_all_evt" ON schedule_event_types FOR ALL USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS "service_all_avail" ON schedule_availability;
  CREATE POLICY "service_all_avail" ON schedule_availability FOR ALL USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS "service_all_overrides" ON schedule_date_overrides;
  CREATE POLICY "service_all_overrides" ON schedule_date_overrides FOR ALL USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS "service_all_book" ON schedule_bookings;
  CREATE POLICY "service_all_book" ON schedule_bookings FOR ALL USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS "service_all_intake" ON schedule_intake_fields;
  CREATE POLICY "service_all_intake" ON schedule_intake_fields FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ── AUTO-UPDATE TRIGGERS ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_schedule_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sched_evt_updated ON schedule_event_types;
CREATE TRIGGER trg_sched_evt_updated
  BEFORE UPDATE ON schedule_event_types
  FOR EACH ROW EXECUTE FUNCTION update_schedule_timestamp();

DROP TRIGGER IF EXISTS trg_sched_book_updated ON schedule_bookings;
CREATE TRIGGER trg_sched_book_updated
  BEFORE UPDATE ON schedule_bookings
  FOR EACH ROW EXECUTE FUNCTION update_schedule_timestamp();

-- ── BOOKING → LEADS SYNC TRIGGER ───────────────────────────
-- When a booking is created, auto-create a lead if one doesn't exist
CREATE OR REPLACE FUNCTION sync_booking_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  existing_lead_id UUID;
BEGIN
  -- Check if lead exists by email
  SELECT id INTO existing_lead_id FROM leads WHERE email = NEW.client_email LIMIT 1;
  
  IF existing_lead_id IS NULL THEN
    -- Parse first/last name
    INSERT INTO leads (
      first_name, last_name, email, phone, source, status, 
      loan_purpose, notes, created_at
    ) VALUES (
      split_part(NEW.client_name, ' ', 1),
      CASE WHEN position(' ' in NEW.client_name) > 0 
        THEN substring(NEW.client_name from position(' ' in NEW.client_name) + 1)
        ELSE '' END,
      NEW.client_email,
      NEW.client_phone,
      'huitschedule_' || COALESCE(NEW.source, 'direct'),
      'appointment_booked',
      NEW.intake_data->>'loan_purpose',
      'Booked via HuitSchedule: ' || 
        (SELECT name FROM schedule_event_types WHERE id = NEW.event_type_id),
      NOW()
    ) RETURNING id INTO existing_lead_id;
  ELSE
    -- Update lead status
    UPDATE leads SET 
      status = 'appointment_booked',
      last_contact_at = NOW(),
      updated_at = NOW()
    WHERE id = existing_lead_id;
  END IF;
  
  -- Link booking to lead
  NEW.lead_id = existing_lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_lead_sync ON schedule_bookings;
CREATE TRIGGER trg_booking_lead_sync
  BEFORE INSERT ON schedule_bookings
  FOR EACH ROW EXECUTE FUNCTION sync_booking_to_lead();

-- ── SEED DATA ───────────────────────────────────────────────

-- Seed event types
INSERT INTO schedule_event_types (name, slug, duration_mins, price_cents, color, icon, description, category, requires_intake, intake_fields) VALUES
  ('Mortgage Consultation', 'mortgage-consultation', 30, 0, '#00d4aa', '🏠', 'Free 30-minute consultation to discuss your mortgage options, rates, and pre-qualification.', 'mortgage', true, ARRAY['loan_purpose','property_type','credit_range','timeline']),
  ('Pre-Approval Review', 'pre-approval-review', 45, 0, '#6366f1', '📋', 'Review your pre-approval documents and discuss next steps toward closing.', 'mortgage', true, ARRAY['loan_purpose','income_range','employment_status']),
  ('Recruiting Discovery Call', 'recruiting-discovery', 20, 0, '#f59e0b', '🎯', 'Confidential conversation about your career trajectory and opportunities.', 'recruiting', false, '{}'),
  ('CRMEX Product Demo', 'crmex-demo', 60, 0, '#ec4899', '🚀', 'Full walkthrough of CRMEX Intelligence Platform capabilities.', 'sales', true, ARRAY['company_size','current_crm']),
  ('Strategy Session', 'strategy-session', 90, 25000, '#8b5cf6', '⚡', 'Deep-dive strategy session for enterprise clients.', 'consulting', true, ARRAY['company_size','goals'])
ON CONFLICT (slug) DO NOTHING;

-- Seed availability (Mon-Fri 9-12, 1-5 AKST)
INSERT INTO schedule_availability (user_id, day_of_week, is_active, windows) VALUES
  (NULL, 0, false, '[]'),
  (NULL, 1, true, '[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"17:00"}]'),
  (NULL, 2, true, '[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"17:00"}]'),
  (NULL, 3, true, '[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"17:00"}]'),
  (NULL, 4, true, '[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"17:00"}]'),
  (NULL, 5, true, '[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"16:00"}]'),
  (NULL, 6, false, '[]')
ON CONFLICT (user_id, day_of_week) DO NOTHING;

-- Seed intake fields
INSERT INTO schedule_intake_fields (field_key, label, field_type, options, is_required, display_order) VALUES
  ('loan_purpose', 'Loan Purpose', 'select', ARRAY['Purchase','Refinance','Cash-Out Refi','HELOC','VA IRRRL','FHA Streamline'], true, 1),
  ('property_type', 'Property Type', 'select', ARRAY['Single Family','Condo','Townhome','Multi-Unit (2-4)','Investment Property'], false, 2),
  ('credit_range', 'Estimated Credit Score', 'select', ARRAY['780+','740-779','700-739','660-699','620-659','Below 620','Not Sure'], true, 3),
  ('timeline', 'Timeline', 'select', ARRAY['Immediately','1-3 months','3-6 months','6-12 months','Just exploring'], false, 4),
  ('income_range', 'Household Income Range', 'select', ARRAY['Under $75K','$75K-$100K','$100K-$150K','$150K-$250K','$250K+','Prefer not to say'], false, 5),
  ('employment_status', 'Employment Status', 'select', ARRAY['W-2 Employee','Self-Employed','1099 Contractor','Retired','Active Military/Veteran'], false, 6),
  ('company_size', 'Company Size', 'select', ARRAY['Solo/1 person','2-10','11-50','51-200','200+'], false, 7),
  ('current_crm', 'Current CRM', 'text', NULL, false, 8),
  ('goals', 'Primary Goals', 'textarea', NULL, false, 9)
ON CONFLICT (field_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- DONE — HuitSchedule schema + seed complete
-- ═══════════════════════════════════════════════════════════
