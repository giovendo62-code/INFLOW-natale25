-- ===========================================
-- SYNC DEV ENVIRONMENT SCRIPT
-- Apply all Production Fixes to Dev Database
-- ===========================================

-- 1. Create Attendance Table (if valid)
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

-- 2. Policies (with Case-Insensitive Role Fix + Studio Admin)
DROP POLICY IF EXISTS "Users can view own attendance" ON public.attendance;
CREATE POLICY "Users can view own attendance" ON public.attendance FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can check-in themselves" ON public.attendance;
CREATE POLICY "Users can check-in themselves" ON public.attendance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
CREATE POLICY "Admins can view all attendance" ON public.attendance FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (LOWER(role) = 'owner' OR LOWER(role) = 'manager' OR LOWER(role) = 'studio_admin')
    )
);

-- 3. Secure Consumption RPC
CREATE OR REPLACE FUNCTION consume_artist_presence(p_artist_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_contract RECORD;
    v_studio_id UUID;
BEGIN
    SELECT * INTO v_contract FROM artist_contracts WHERE artist_id = p_artist_id FOR UPDATE;
    IF v_contract IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No contract'); END IF;
    IF v_contract.rent_type != 'PRESENCES' THEN RETURN jsonb_build_object('success', false, 'error', 'Not a presence contract'); END IF;
    IF v_contract.presence_package_limit IS NOT NULL AND v_contract.used_presences >= v_contract.presence_package_limit THEN RETURN jsonb_build_object('success', false, 'error', 'Limit reached'); END IF;

    UPDATE artist_contracts SET used_presences = used_presences + 1, updated_at = NOW() WHERE id = v_contract.id;
    SELECT studio_id INTO v_studio_id FROM users WHERE id = p_artist_id;
    INSERT INTO presence_logs (studio_id, artist_id, action, created_by, note) VALUES (v_studio_id, p_artist_id, 'ADD', p_artist_id, 'Check-in QR');
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Admin Delete RPC (Fixed Roles)
CREATE OR REPLACE FUNCTION delete_attendance_entry(p_attendance_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (LOWER(role) = 'owner' OR LOWER(role) = 'manager' OR LOWER(role) = 'studio_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    DELETE FROM attendance WHERE id = p_attendance_id;
END;
$$;

-- 5. Reset Cycle RPC (Fixed Roles)
CREATE OR REPLACE FUNCTION reset_artist_cycle(
    p_artist_id UUID, 
    p_studio_id UUID, 
    p_operator_id UUID, 
    p_note TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (LOWER(role) = 'owner' OR LOWER(role) = 'manager' OR LOWER(role) = 'studio_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE artist_contracts SET used_presences = 0, presence_cycle_start = NOW(), updated_at = NOW() WHERE artist_id = p_artist_id;
    INSERT INTO presence_logs (studio_id, artist_id, action, created_by, note) VALUES (p_studio_id, p_artist_id, 'RESET', p_operator_id, p_note);
    DELETE FROM attendance WHERE user_id = p_artist_id AND checkin_date = CURRENT_DATE;
END;
$$;
