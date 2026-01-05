-- Create recurring_expenses table
create table if not exists recurring_expenses (
  id uuid default gen_random_uuid() primary key,
  studio_id uuid not null, -- Removed foreign key constraint for simplicity if studios table access is tricky, but preferably: references studios(id)
  name text not null,
  amount numeric not null,
  category text not null,
  day_of_month int default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table recurring_expenses enable row level security;

-- Policies
create policy "Owners and managers can view recurring expenses"
  on recurring_expenses for select
  using (
    auth.uid() in (
      select user_id from studio_memberships 
      where studio_id = recurring_expenses.studio_id 
      and role in ('owner', 'manager')
    )
  );

create policy "Owners and managers can insert recurring expenses"
  on recurring_expenses for insert
  with check (
    auth.uid() in (
      select user_id from studio_memberships 
      where studio_id = recurring_expenses.studio_id 
      and role in ('owner', 'manager')
    )
  );

create policy "Owners and managers can update recurring expenses"
  on recurring_expenses for update
  using (
    auth.uid() in (
      select user_id from studio_memberships 
      where studio_id = recurring_expenses.studio_id 
      and role in ('owner', 'manager')
    )
  );

create policy "Owners and managers can delete recurring expenses"
  on recurring_expenses for delete
  using (
    auth.uid() in (
      select user_id from studio_memberships 
      where studio_id = recurring_expenses.studio_id 
      and role in ('owner', 'manager')
    )
  );
