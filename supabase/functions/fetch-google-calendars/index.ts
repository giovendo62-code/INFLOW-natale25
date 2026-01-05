import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SERVICE_ROLE_KEY_CUSTOM') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );

        const { user_id } = await req.json();

        if (!user_id) throw new Error("Missing user_id");

        // 1. Fetch User Tokens
        const { data: integration, error: tokenError } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('user_id', user_id)
            .eq('provider', 'google')
            .single();

        if (tokenError || !integration) throw new Error("User not connected to Google");

        let accessToken = integration.access_token;

        // 2. Check Expiry & Refresh
        const expiresAt = new Date(integration.expires_at).getTime();
        if (Date.now() > expiresAt - 60000) { // Refresh if expiring in < 1 min
            console.log("Refreshing token...");
            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
                    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
                    refresh_token: integration.refresh_token,
                    grant_type: 'refresh_token',
                }),
            });
            const refreshData = await refreshResponse.json();
            if (refreshData.error) throw new Error("Failed to refresh token");

            accessToken = refreshData.access_token;
            // Update DB
            await supabase.from('user_integrations').update({
                access_token: accessToken,
                expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString()
            }).eq('user_id', user_id);
        }

        // 3. Fetch Calendar List
        const calendarsResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!calendarsResponse.ok) {
            throw new Error(`Failed to fetch calendars: ${calendarsResponse.statusText}`);
        }

        const calendarsData = await calendarsResponse.json();

        return new Response(JSON.stringify(calendarsData.items || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
