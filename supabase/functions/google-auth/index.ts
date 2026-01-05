
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

    const { pathname, searchParams } = new URL(req.url);

    // 1. GET /login: Redirect users to Google's Consent Page
    if (pathname.endsWith('/login')) {
        const client_id = Deno.env.get('GOOGLE_CLIENT_ID');
        const redirect_uri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-auth/callback`;
        const scope = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email';

        // Pass user_id and redirect_url (app url) in state
        // SECURITY NOTE: In production, sign this state or use a session cookie to prevent CSRF.
        const userId = searchParams.get('user_id');
        const appUrl = searchParams.get('redirect_to') || 'http://localhost:3000';
        const state = JSON.stringify({ userId, appUrl });

        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

        return Response.redirect(googleAuthUrl, 302);
    }

    // 2. GET /callback: Authenticate and store tokens
    if (pathname.endsWith('/callback')) {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const stateStr = searchParams.get('state');

        if (error || !code) {
            return new Response(JSON.stringify({ error: error || "No code provided" }), { status: 400, headers: corsHeaders });
        }

        try {
            const { userId, appUrl } = JSON.parse(stateStr || '{}');

            // Exchange code for tokens
            const client_id = Deno.env.get('GOOGLE_CLIENT_ID');
            const client_secret = Deno.env.get('GOOGLE_CLIENT_SECRET');
            const redirect_uri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-auth/callback`;

            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: client_id!,
                    client_secret: client_secret!,
                    redirect_uri: redirect_uri,
                    grant_type: 'authorization_code',
                }),
            });

            const tokens = await tokenResponse.json();

            if (tokens.error) throw new Error(tokens.error_description || tokens.error);

            // Fetch User Email
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokens.access_token}` },
            });
            const userData = await userResponse.json();
            const email = userData.email;

            // Store tokens if we have a userId
            if (userId) {
                const { error: dbError } = await supabase
                    .from('user_integrations')
                    .upsert({
                        user_id: userId,
                        provider: 'google',
                        access_token: tokens.access_token,
                        refresh_token: tokens.refresh_token, // Only present if access_type=offline and prompt=consent
                        expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
                        updated_at: new Date().toISOString(),
                        settings: { email: email }
                    }, { onConflict: 'user_id, provider' });

                if (dbError) throw dbError;
            }

            // Redirect back to the App
            // appUrl is the full page URL we came from
            const separator = appUrl.includes('?') ? '&' : '?';
            const finalRedirectUrl = `${appUrl}${separator}google_sync_success=true`;

            return Response.redirect(finalRedirectUrl, 302);

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { headers: corsHeaders, status: 404 });
});
