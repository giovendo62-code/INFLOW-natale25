import { createClient } from '@supabase/supabase-js';

// Credentials from root .env which we believe are correct
const url = 'https://ijrgcphnhlgfyrqwuboc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqcmdjcGhuaGxnZnlycXd1Ym9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5Mjc0MDksImV4cCI6MjA4NDUwMzQwOX0.nCFDLyGm4kNlQYr9GjMgMVl3OtFeyNIqUf5PsDR-FX4';

if (!url || !key) {
    console.error('Missing URL or ANON KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

const run = async () => {
    const artistEmail = 'giotritattoo92@gmail.com';
    const ownerEmail = 'trimarchitattoostudio@gmail.com';
    const passwords = ['TemporaryPassword123!', 'Connetti1', 'test'];

    console.log('--- DEBUGGING VISIBILITY ---');

    // 1. Login one by one until success
    let session = null;
    let loggedInUser = null;
    for (const pwd of passwords) {
        console.log(`Attempting login with password: ${pwd}`);
        const { data, error } = await supabase.auth.signInWithPassword({
            email: ownerEmail,
            password: pwd
        });
        if (data.session) {
            console.log('Login successful!');
            session = data.session;
            loggedInUser = data.user;
            break;
        }
    }

    if (!session) {
        console.error('Could not log in as owner. RLS will likely block queries.');
        // Still try to proceed if possible? No, likely waste.
        return;
    }

    console.log('Logged in User ID:', loggedInUser.id);

    console.log('\n2. Fetching Studio...');
    const { data: studios, error: studioError } = await supabase.from('studios').select('*').ilike('name', '%trimarchi%');
    console.log('Studios found:', studios);
    if (studioError) console.error(studioError);

    if (!studios || studios.length === 0) return;
    const studioId = studios[0].id;

    console.log('\n3. Fetching Memberships for Studio:', studioId);
    const { data: memberships } = await supabase.from('studio_memberships').select('*').eq('studio_id', studioId);
    console.log('Memberships:', memberships);

    if (!memberships) return;

    const userIds = memberships.map(m => m.user_id);
    console.log('\n4. User IDs in membership:', userIds);

    // Simulated Fetch used by App
    console.log('\n5. Attempting to fetch public.users for these IDs...');
    const { data: publicUsers, error: usersError } = await supabase.from('users').select('*').in('id', userIds);

    if (usersError) {
        console.error('Error fetching public.users:', usersError);
    } else {
        console.log('Fetched public.users:', publicUsers);
        console.log('Count:', publicUsers.length);

        if (publicUsers.length < userIds.length) {
            console.warn(`\nMISMATCH! Expected ${userIds.length} users, got ${publicUsers.length}.`);
            console.warn('The missing IDs likely do not have a row in public.users or RLS is hiding them.');

            // Identify missing ID
            const foundIds = publicUsers.map(u => u.id);
            const missingIds = userIds.filter(id => !foundIds.includes(id));
            console.log('Missing User IDs:', missingIds);

            // IMPORTANT: Check if the Artist (known email) is missing
            console.log('\n6. Checking specific Artist Email in public table (by manual query)...');
            // We can't query by email on public.users easily if RLS blocks, but we can try just to see
            const { data: checkEmpty } = await supabase.from('users').select('*').eq('email', artistEmail);
            console.log('Direct query for artist row:', checkEmpty);
        }
    }
};

run();
