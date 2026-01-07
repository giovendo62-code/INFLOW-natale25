
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY_CUSTOM') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { user_id: reqUserId } = await req.json().catch(() => ({}));

        let query = supabase.from('user_integrations').select('*').eq('provider', 'google');
        if (reqUserId) {
            query = query.eq('user_id', reqUserId);
        }

        const { data: integrations, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        let totalSynced = 0;
        let logs: string[] = [];

        for (const integration of integrations) {
            const user_id = integration.user_id;
            const now = new Date();
            const pastMonth = new Date();
            pastMonth.setDate(now.getDate() - 30);
            const nextMonths = new Date();
            nextMonths.setDate(now.getDate() + 90);

            let syncDetails = { inserted: 0, updated: 0, skipped_allday: 0, skipped_error: 0 };

            const mapping = integration.settings?.calendar_mapping || {};
            const syncs = Object.entries(mapping).length > 0
                ? Object.entries(mapping)
                : [[user_id, 'primary']];

            for (const [artistId, calendarId] of syncs) {
                logs.push(`Processing calendar ${calendarId} for artist ${artistId}...`);

                const encodedCalId = encodeURIComponent(calendarId as string);
                const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events?timeMin=${pastMonth.toISOString()}&timeMax=${nextMonths.toISOString()}&singleEvents=true`;

                const eventsResponse = await fetch(eventsUrl, {
                    headers: { Authorization: `Bearer ${integration.access_token}` },
                });

                if (!eventsResponse.ok) {
                    logs.push(`Error fetching Google Calendar: ${eventsResponse.statusText}`);
                    continue;
                }

                const eventsData = await eventsResponse.json();
                const events = eventsData.items || [];
                logs.push(`Found ${events.length} events in Google Calendar.`);

                // Get Studio ID
                const { data: userData } = await supabase.from('users').select('studio_id').eq('id', artistId).single();
                if (!userData?.studio_id) {
                    logs.push(`Artist ${artistId} has no studio_id. Skipping.`);
                    continue;
                }

                // Find or Create Placeholder Client for this Studio
                let clientId = '00000000-0000-0000-0000-000000000000'; // Default fallback

                // Try to find a client named "Google Calendar" for this studio
                const { data: placeholderClient } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('studio_id', userData.studio_id)
                    .eq('full_name', 'Google Calendar Import')
                    .maybeSingle();

                if (placeholderClient) {
                    clientId = placeholderClient.id;
                } else {
                    // Create it
                    const { data: newClient, error: createClientError } = await supabase
                        .from('clients')
                        .insert({
                            studio_id: userData.studio_id,
                            full_name: 'Google Calendar Import',
                            email: `google-import-${userData.studio_id}@inkflow.app`,
                            phone: '0000000000',
                            notes: 'Cliente generato automaticamente per importazione Google Calendar'
                        })
                        .select('id')
                        .single();

                    if (!createClientError && newClient) {
                        clientId = newClient.id;
                        logs.push(`Created placeholder client for Studio ${userData.studio_id}`);
                    } else {
                        logs.push(`Failed to create placeholder client: ${createClientError?.message}. Using fallback.`);
                        // If fallback is also missing, next insert will fail.
                    }
                }

                for (const event of events) {
                    if (!event.start?.dateTime) {
                        syncDetails.skipped_allday++;
                        continue;
                    }

                    const startTime = event.start.dateTime;
                    const endTime = event.end?.dateTime || event.start.dateTime;

                    const { data: existing } = await supabase.from('appointments').select('id').eq('google_event_id', event.id).maybeSingle();

                    if (existing) {
                        await supabase.from('appointments').update({
                            start_time: startTime,
                            end_time: endTime,
                            service_name: event.summary || 'Google Event',
                            artist_id: artistId
                        }).eq('id', existing.id);
                        syncDetails.updated++;
                    } else {
                        await supabase.from('appointments').insert({
                            studio_id: userData.studio_id,
                            artist_id: artistId,
                            client_id: clientId,
                            service_name: event.summary || 'Google Event',
                            start_time: startTime,
                            end_time: endTime,
                            status: 'CONFIRMED',
                            notes: `Synced from Google Calendar: ${event.description || ''}`,
                            google_event_id: event.id
                        });
                        syncDetails.inserted++;
                    }
                }
            }
            totalSynced += syncDetails.inserted + syncDetails.updated;
            logs.push(`Sync Result for ${user_id}: +${syncDetails.inserted} new, ~${syncDetails.updated} updated, -${syncDetails.skipped_allday} all-day skipped.`);
        }

        return new Response(JSON.stringify({
            message: "Sync process completed",
            synced_events_count: totalSynced,
            logs: logs
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
