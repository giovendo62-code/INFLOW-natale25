-- Enable delete for studio members on waitlist_entries
create policy "Enable delete for studio members"
on "public"."waitlist_entries"
as PERMISSIVE
for DELETE
to authenticated
using (
  auth.uid() in (
    select user_id
    from studio_memberships
    where studio_id = waitlist_entries.studio_id
  )
);
