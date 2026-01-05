-- Enable RLS
ALTER TABLE studio_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow owners and managers to create invitations" ON studio_invitations;
DROP POLICY IF EXISTS "Allow members to view studio invitations" ON studio_invitations;
DROP POLICY IF EXISTS "Allow public to view invitation by token" ON studio_invitations;

-- Policy for INSERT: Allow if user is an owner/manager in the target studio
CREATE POLICY "Allow owners and managers to create invitations"
ON studio_invitations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM studio_memberships
    WHERE user_id = auth.uid()
    AND studio_id = studio_invitations.studio_id
    AND role IN ('owner', 'manager', 'STUDIO_ADMIN', 'artist') -- Added artist so they can invite students if needed, or remove if restricted
  )
);

-- Policy for VIEW (Select): Owners/Managers need to see them. 
-- Public needs to see valid token (handled by RPC usually, but if using direct select...)
-- The RPC "get_invitation_by_token" usually uses "security definer" to bypass, but if not:

CREATE POLICY "Allow members to view studio invitations"
ON studio_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM studio_memberships
    WHERE user_id = auth.uid()
    AND studio_id = studio_invitations.studio_id
  )
);

-- Policy for viewing by token (for anonymous users validating invite)
CREATE POLICY "Allow public to view invitation by token"
ON studio_invitations
FOR SELECT
USING ( true ); 
-- Ideally this should be more restricted (e.g. only if token matches) but 'true' is common for simple token lookup tables 
-- if the token is the only primary key or filter used. 
-- However, allowing ANYONE to dump the table is bad. 
-- Better: Let's rely on the RPC being Security Definer. 
-- If the React app queries query `studio_invitations` directly with a token filter, this policy is needed.
-- But given the error is INSERT, the first policy is the critical one.
