-- ===========================================
-- DEPLOYMENT SCRIPT - FEB 01 2026
-- Check-in, Attendance, RPCs, Security Fixes
-- ===========================================

-- 1. Check-in table and RLS (Basic)
-- ---------------------------------
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    studio_id UUID NOT NULL REFERENCES studios(id),
    user_id UUID NOT NULL REFERENCES users(id),
    checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method TEXT DEFAULT 'QR_CODE', 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policy: View own attendance
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
CREATE POLICY "Users can view own attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Insert own attendance
DROP POLICY IF EXISTS "Users can check-in themselves" ON public.attendance;
CREATE POLICY "Users can check-in themselves"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all (NEW)
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
CREATE POLICY "Admins can view all attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (role = 'owner' OR role = 'manager')
    )
);


-- 2. Secure Consumption RPC (Fix RLS Issue)
-- -----------------------------------------
CREATE OR REPLACE FUNCTION consume_artist_presence(p_artist_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contract RECORD;
    v_studio_id UUID;
BEGIN
    -- 1. Find the contract and lock it
    SELECT * INTO v_contract
    FROM artist_contracts
    WHERE artist_id = p_artist_id
    FOR UPDATE;

    IF v_contract IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nessun contratto trovato per questo artista');
    END IF;

    IF v_contract.rent_type != 'PRESENCES' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Il contratto non è a presenze');
    END IF;

    -- 2. Check limits
    IF v_contract.presence_package_limit IS NOT NULL AND v_contract.used_presences >= v_contract.presence_package_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limite presenze raggiunto per questo pacchetto');
    END IF;

    -- 3. Update contract
    UPDATE artist_contracts
    SET used_presences = used_presences + 1,
        updated_at = NOW()
    WHERE id = v_contract.id;

    -- 4. Get Studio ID for logging
    SELECT studio_id INTO v_studio_id
    FROM users
    WHERE id = p_artist_id;

    -- 5. Log presence
    INSERT INTO presence_logs (studio_id, artist_id, action, created_by, note)
    VALUES (v_studio_id, p_artist_id, 'ADD', p_artist_id, 'Check-in QR');

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 3. Admin Delete RPC (Owner/Manager Only)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION delete_attendance_entry(p_attendance_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check permissions (simple check on user role)
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (role = 'owner' OR role = 'manager')
    ) THEN
        RAISE EXCEPTION 'Non autorizzato: Solo Owner e Manager possono eliminare le presenze.';
    END IF;

    DELETE FROM attendance WHERE id = p_attendance_id;
END;
$$;


-- 4. Advanced Reset Cycle RPC (with auto-clear today)
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION reset_artist_cycle(
    p_artist_id UUID,
    p_studio_id UUID,
    p_operator_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check permissions (Owner/Manager)
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role = 'owner' OR role = 'manager')) THEN
        RAISE EXCEPTION 'Non autorizzato: Solo Owner e Manager possono resettare il ciclo.';
    END IF;

    -- 1. Reset Contract
    UPDATE artist_contracts
    SET used_presences = 0,
        presence_cycle_start = NOW(),
        updated_at = NOW()
    WHERE artist_id = p_artist_id;

    -- 2. Log
    INSERT INTO presence_logs (studio_id, artist_id, action, created_by, note)
    VALUES (p_studio_id, p_artist_id, 'RESET', p_operator_id, p_note);

    -- 3. Clear today's attendance
    DELETE FROM attendance 
    WHERE user_id = p_artist_id 
    AND checkin_date = CURRENT_DATE;
END;
$$;
