-- Add privacy_pin to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_pin text DEFAULT null;

-- Ensure users can update their own pin
create policy "Users can update their own privacy_pin"
on public.users for update
to authenticated
using ( auth.uid() = id )
with check ( auth.uid() = id );
