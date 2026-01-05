
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
        // 1. Fetch users with active integrations
        const { data: integrations, error: fetchError } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('provider', 'google');

        if (fetchError) throw fetchError;

        let totalSyncedCount = 0;

        for (const integration of integrations) {
            const user_id = integration.user_id;
            // 2. Validation: Check if token is expired
            const now = new Date();
            const expiresAt = new Date(integration.expires_at);
            let accessToken = integration.access_token;

            if (now >= expiresAt) {
                // Refresh Token logic would go here
                console.log(`Refreshing token for user ${user_id}...`);
                // For now, if expired, we skip. In a real app, you'd refresh and update the integration.
                continue;
            }

            // 3. Sync events based on Calendar Mapping
            let syncedCount = 0;
            const mapping = integration.settings?.calendar_mapping || {};
            // If no mapping, we might default to syncing primary calendar to the connected user
            const syncs = Object.entries(mapping).length > 0
                ? Object.entries(mapping)
                : [[user_id, 'primary']];

            for (const [artistId, calendarId] of syncs) {
                // Fetch events for this specific calendar
                console.log(`Syncing calendar ${calendarId} for artist ${artistId}...`);
                const nextMonth = new Date();
                nextMonth.setDate(now.getDate() + 30);

                // Need to URL encode calendarId
                const encodedCalId = encodeURIComponent(calendarId as string);

                const eventsResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodedCalId}/events?timeMin=${now.toISOString()}&timeMax=${nextMonth.toISOString()}&singleEvents=true`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (!eventsResponse.ok) {
                    console.error(`Failed to fetch events for artist ${artistId} (cal: ${calendarId}): ${eventsResponse.statusText}`);
                    continue;
                }

                const eventsData = await eventsResponse.json();
                const events = eventsData.items || [];

                // We get the artist's studio_id 
                const { data: userData, error: userError } = await supabase.from('users').select('studio_id').eq('id', artistId).single();

                if (userError || !userData?.studio_id) {
                    console.warn(`Artist ${artistId} has no studio_id, skipping.`);
                    continue;
                }
                const studioId = userData.studio_id;

                for (const event of events) {
                    if (!event.start?.dateTime) continue; // Skip all-day events

                    const startTime = event.start.dateTime;
                    const endTime = event.end?.dateTime || event.start.dateTime;

                    const { data: existing, error: selectError } = await supabase.from('appointments').select('id').eq('google_event_id', event.id).maybeSingle();

                    if (selectError) continue;

                    if (existing) {
                        await supabase.from('appointments').update({
                            start_time: startTime,
                            end_time: endTime,
                            service_name: event.summary || 'Google Event',
                            artist_id: artistId // Ensure artist is updated if changed
                        }).eq('id', existing.id);
                        syncedCount++;
                    } else {
                        await supabase.from('appointments').insert({
                            studio_id: studioId,
                            artist_id: artistId,
                            client_id: '00000000-0000-0000-0000-000000000000',
                            service_name: event.summary || 'Google Event',
                            start_time: startTime,
                            end_time: endTime,
                            status: 'CONFIRMED',
                            notes: `Synced from Google Calendar: ${event.description || ''}`,
                            google_event_id: event.id
                        });
                        syncedCount++;
                    }
                }
            }
            console.log(`Integration for user ${user_id} synced ${syncedCount} total events.`);
            totalSyncedCount += syncedCount;
        }

        return new Response(JSON.stringify({
            message: "Sync process completed",
            synced_events_count: totalSyncedCount
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
