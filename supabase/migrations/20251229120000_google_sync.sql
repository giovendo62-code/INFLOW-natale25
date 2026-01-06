-- Create table for storing User Integrations (Google Tokens)
create table if not exists user_integrations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('google')),
  access_token text not null, -- Should be encrypted in production
  refresh_token text not null, -- Should be encrypted in production
  expires_at timestamptz not null,
  settings jsonb default '{}'::jsonb, -- Stores e.g. { "sync_direction": "two_way", "calendar_ids": ["..."] }
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

-- Enable RLS
alter table user_integrations enable row level security;

-- Policies
drop policy if exists "Users can view their own integrations" on user_integrations;
create policy "Users can view their own integrations"
  on user_integrations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own integrations" on user_integrations;
create policy "Users can update their own integrations"
  on user_integrations for update
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own integrations" on user_integrations;
create policy "Users can insert their own integrations"
  on user_integrations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own integrations" on user_integrations;
create policy "Users can delete their own integrations"
  on user_integrations for delete
  using (auth.uid() = user_id);

-- Optional: Create an index for faster lookups
create index if not exists idx_user_integrations_user_id on user_integrations(user_id);
