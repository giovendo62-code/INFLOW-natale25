
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // 1. Handle Webhook Payload
    const payload = await req.json();
    console.log("Webhook payload:", payload);

    const { type, table, record, old_record, schema } = payload;

    // We expect payload from 'clients' table
    if (table !== 'clients') {
        return new Response("Ignored", { status: 200 });
    }

    // Determine Studio ID
    const studioId = record?.studio_id || old_record?.studio_id;
    if (!studioId) {
        console.error("No studio_id found in record");
        return new Response("No Studio ID", { status: 200 });
    }

    try {
        // 2. Init Supabase Admin
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 3. Fetch Studio Settings
        const { data: studio, error: studioError } = await supabase
            .from('studios')
            .select('google_sheets_config')
            .eq('id', studioId)
            .single();

        if (studioError || !studio) {
            console.error("Error fetching studio:", studioError);
            return new Response("Studio Fetch Error", { status: 200 });
        }

        const config = studio.google_sheets_config;
        if (!config || !config.auto_sync_enabled || !config.spreadsheet_id || !config.connected_user_id) {
            console.log("Sync not enabled or config missing for studio:", studioId);
            return new Response("Sync Skipped", { status: 200 });
        }

        // 4. Fetch User Tokens (for the connected user)
        const { data: integration, error: tokenError } = await supabase
            .from('user_integrations')
            .select('access_token, refresh_token, expires_at')
            .eq('user_id', config.connected_user_id)
            .eq('provider', 'google')
            .single();

        if (tokenError || !integration) {
            console.error("Token access error:", tokenError);
            return new Response("Token Error", { status: 200 });
        }

        // 5. Refresh Token Logic (Always good to check)
        let accessToken = integration.access_token;
        if (new Date(integration.expires_at) < new Date()) {
            console.log("Refreshing token...");
            const client_id = Deno.env.get('GOOGLE_CLIENT_ID');
            const client_secret = Deno.env.get('GOOGLE_CLIENT_SECRET');
            const refresh_token = integration.refresh_token;

            if (refresh_token) {
                const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: client_id!,
                        client_secret: client_secret!,
                        refresh_token: refresh_token,
                        grant_type: 'refresh_token',
                    }),
                });
                const tokens = await tokenResponse.json();
                if (!tokens.error) {
                    accessToken = tokens.access_token;
                    // Update DB (non-blocking ideally, but await for safety)
                    await supabase
                        .from('user_integrations')
                        .update({
                            access_token: accessToken,
                            expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()
                        })
                        .eq('user_id', config.connected_user_id)
                        .eq('provider', 'google');
                }
            }
        }

        // 6. Fetch ALL Clients for this Studio
        // We do a full sync to ensure consistency.
        const { data: clients, error: clientFetchError } = await supabase
            .from('clients')
            .select('*')
            .eq('studio_id', studioId)
            .order('created_at', { ascending: false });

        if (clientFetchError) {
            console.error("Client fetch error:", clientFetchError);
            return new Response("Client Fetch Error", { status: 200 });
        }

        // 7. Format Data for Sheets
        // Headers: Data, Nome, Email, Telefono, Instagram, Città, Note, Totale Speso
        const headers = ["Data Inserimento", "Nome Completo", "Email", "Telefono", "Indirizzo", "Città", "Note", "Consenso", "Totale Speso"];

        const rows = clients.map(c => [
            c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
            c.full_name,
            c.email,
            c.phone,
            c.address || '',
            c.city || '',
            c.notes || '',
            c.consent_status || 'NONE',
            c.total_spent || 0
        ]);

        const values = [headers, ...rows];
        const sheetName = config.sheet_name || 'Clients';
        const spreadsheetId = config.spreadsheet_id;

        // 8. Write to Google Sheets
        // Clear first
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:Z:clear`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // Write
        const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`;
        const writeRes = await fetch(writeUrl, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                range: `${sheetName}!A1`,
                majorDimension: 'ROWS',
                values: values
            })
        });

        if (!writeRes.ok) {
            const err = await writeRes.json();
            console.error("Sheet Write Error:", err);
            return new Response("Sheet Write Failed", { status: 200 }); // Return 200 to prevent Webhook retries on logical errors
        }

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });

    } catch (e) {
        console.error("Unexpected error:", e);
        return new Response("Internal Server Error", { status: 500 });
    }
});
