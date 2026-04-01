-- HuitSchedule v4.0
CREATE TABLE IF NOT EXISTS event_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id uuid NOT NULL, name text NOT NULL, slug text,
  duration_mins int DEFAULT 30, description text, color text DEFAULT '#2DD4BF',
  buffer_mins int DEFAULT 15, max_daily int DEFAULT 10,
  is_active boolean DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id uuid NOT NULL, event_type_id uuid REFERENCES event_types(id),
  attendee_name text NOT NULL, attendee_email text,
  start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
  meeting_type text, notes text, status text DEFAULT 'confirmed',
  confirmation_code text, source_product text,
  reschedule_reason text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS booking_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  send_at timestamptz NOT NULL, type text, sent boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS scheduling_prefs (
  user_id uuid PRIMARY KEY, work_hours_start int DEFAULT 9,
  work_hours_end int DEFAULT 17, timezone text DEFAULT 'America/Anchorage',
  buffer_mins int DEFAULT 15, max_daily int DEFAULT 8,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON event_types USING (auth.role()='service_role');
CREATE POLICY "service_role" ON bookings USING (auth.role()='service_role');
CREATE POLICY "service_role" ON booking_reminders USING (auth.role()='service_role');
CREATE POLICY "service_role" ON scheduling_prefs USING (auth.role()='service_role');
