import { createClient } from '@supabase/supabase-js';

const url = 'https://ijrgcphnhlgfyrqwuboc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqcmdjcGhuaGxnZnlycXd1Ym9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5Mjc0MDksImV4cCI6MjA4NDUwMzQwOX0.nCFDLyGm4kNlQYr9GjMgMVl3OtFeyNIqUf5PsDR-FX4';

if (!url || !key) {
    console.error('Missing URL or ANON KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

const run = async () => {
    const email = 'giotritattoo92@gmail.com';
    const password = 'Connetti1';

    console.log(`Attempting login as ${email}...`);
    let { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.log(`Login failed (${error.message}). Attempting SignUp...`);
        const signUpResult = await supabase.auth.signUp({
            email,
            password
        });

        if (signUpResult.error) {
            console.error('SignUp failed:', signUpResult.error.message);
            return;
        }

        console.log('SignUp Success! User created.');
        data = signUpResult.data;
    } else {
        console.log('Login Success!');
    }

    const session = data.session;
    const user = data.user;

    if (!user) {
        console.log('No user object returned.');
        return;
    }

    // Try to get session if we just signed up
    if (!session) {
        console.log('No session immediately available. Establishing session via login if possible...');
        const { data: loginData } = await supabase.auth.signInWithPassword({ email, password });
        if (loginData.session) {
            console.log('Session established after signup.');
            data.session = loginData.session;
        } else {
            console.log('Could not establish session (maybe email confirmation required).');
            return;
        }
    }

    console.log(`User ID: ${user.id}`);

    // Search for the studio
    console.log('Searching for "Trimarchi" studio...');
    const { data: studios, error: studioError } = await supabase.from('studios').select('*').ilike('name', '%trimarchi%');

    if (studioError) {
        console.log('Error listing studios:', studioError);
        return;
    }

    if (studios && studios.length > 0) {
        const studio = studios[0];
        console.log(`Found Target Studio: ${studio.name} (ID: ${studio.id})`);

        console.log('Linking myself to studio...');

        // Try updating self
        const { error: updateError } = await supabase.from('users').update({
            studio_id: studio.id,
            role: 'artist'
        }).eq('id', user.id);

        if (updateError) {
            console.log('Update "users" failed:', updateError.message);
        } else {
            console.log('Successfully updated "users" studio_id link!');
        }

        // Also try creating membership
        console.log('Creating studio membership...');
        const { error: memError } = await supabase.from('studio_memberships').insert({
            studio_id: studio.id,
            user_id: user.id,
            role: 'artist'
        });

        if (memError) {
            if (memError.code === '23505') console.log('Membership already exists.');
            else console.log('Membership creation failed:', memError.message);
        } else {
            console.log('Membership created!');
        }
    } else {
        console.log('No studio found matching "Trimarchi".');
    }
};

run();
