
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

    const { action, appointment, user_id } = await req.json();

    // action: 'create' | 'update' | 'delete'
    // appointment: Appointment data
    // user_id: ID of the user triggering the sync (owner/manager)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY_CUSTOM') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        console.log(`[push-to-google] Requested ${action} for apt ${appointment?.id} by user ${user_id}`);

        // 1. Get User Integration
        const { data: integration, error: intError } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('user_id', user_id)
            .eq('provider', 'google')
            .single();

        if (intError || !integration) {
            console.log('[push-to-google] No google integration found for user.');
            return new Response(JSON.stringify({ message: 'No integration found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // 2. Refresh Token if needed (Basic check)
        // Note: For robustness, real refresh logic is needed here. For now assuming fresh.
        const accessToken = integration.access_token;

        // 3. Determine Target Calendar
        const mapping = integration.settings?.calendar_mapping || {};
        const artistId = appointment.artist_id;
        const calendarId = mapping[artistId];

        if (!calendarId && action !== 'delete') {
            console.log(`[push-to-google] No calendar mapped for artist ${artistId}`);
            return new Response(JSON.stringify({ message: 'No calendar mapped' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // 4. Perform Google API Action
        let result;

        // Fetch additional details
        let clientName = 'Cliente Occasionale';
        let clientPhone = '';
        let artistName = 'Artista';

        if (appointment.client_id) {
            const { data: client } = await supabase.from('clients').select('full_name, phone').eq('id', appointment.client_id).single();
            if (client) {
                clientName = client.full_name;
                clientPhone = client.phone || '';
            }
        }

        if (appointment.artist_id) {
            const { data: artist } = await supabase.from('users').select('full_name').eq('id', appointment.artist_id).single();
            if (artist) {
                artistName = artist.full_name;
            }
        }

        const price = appointment.price || 0;
        const deposit = appointment.deposit || 0;
        const balance = price - deposit;

        const description = `
CLIENTE: ${clientName}
TELEFONO: ${clientPhone}

SERVIZIO: ${appointment.service_name || 'Generico'}

ECONOMICA:
Prezzo: €${price}
Acconto: €${deposit}
Saldo: €${balance}

NOTE:
${appointment.notes || 'Nessuna nota'}
        `.trim();

        const summary = `[${artistName}] ${clientName} - ${appointment.service_name || 'Appuntamento'}`;

        const eventBody = {
            summary: summary,
            description: description,
            start: { dateTime: appointment.start_time },
            end: { dateTime: appointment.end_time },
            // Add more fields if necessary
        };

        if (action === 'create') {
            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventBody)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(JSON.stringify(data));

            // Save google_event_id back to appointment
            if (data.id) {
                await supabase
                    .from('appointments')
                    .update({ google_event_id: data.id })
                    .eq('id', appointment.id);
            }
            result = data;

        } else if (action === 'update') {
            if (!appointment.google_event_id) {
                // Try create if missing? Or ignore.
                console.log('[push-to-google] Update requested but no google_event_id.');
                return new Response(JSON.stringify({ message: 'No google_event_id' }), { status: 200, headers: corsHeaders });
            }

            // For update, we need the calendarId where it was created. 
            // Assumption: It's the same calendar as currently mapped. 
            // If mapping changed, this might fail (404). 

            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appointment.google_event_id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventBody)
            });
            const data = await res.json();
            result = data;

        } else if (action === 'delete') {
            if (!appointment.google_event_id) return new Response(JSON.stringify({ message: 'No google_event_id' }), { headers: corsHeaders });

            // For delete, we definitely need the calendarId. If mapping changed, we might not find it.
            // Ideally we should have stored calendar_id on the appointment too.
            // Falling back to current mapping or 'primary'?
            // Use current mapping.

            const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appointment.google_event_id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            result = { status: res.status };
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err: any) {
        console.error('[push-to-google] Error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
