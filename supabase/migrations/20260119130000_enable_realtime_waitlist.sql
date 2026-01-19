-- Enable Realtime for waitlist_entries table
-- This is required for clients to subscribe to changes
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist_entries;
