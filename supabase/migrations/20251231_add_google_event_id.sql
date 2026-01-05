-- Add google_event_id to appointments to track synced events
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id ON appointments(google_event_id);
