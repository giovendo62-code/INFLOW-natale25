-- Fix RLS: use case-insensitive comparison for role to avoid errors if role is stored as 'OWNER'
DROP POLICY IF EXISTS "Allow owners and managers to create invitations" ON studio_invitations;

CREATE POLICY "Allow owners and managers to create invitations"
ON studio_invitations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM studio_memberships
    WHERE user_id = auth.uid()
    AND studio_id = studio_invitations.studio_id
    AND lower(role) IN ('owner', 'manager', 'artist', 'studio_admin')
  )
);
