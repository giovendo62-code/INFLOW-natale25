import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load env explicitly
const envPath = path.join(rootDir, 'supabase', '.env');
let env = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [key, ...rest] = trimmed.split('=');
        if (key) {
            env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
} else {
    const rootEnv = path.join(rootDir, '.env');
    if (fs.existsSync(rootEnv)) {
        const content = fs.readFileSync(rootEnv, 'utf-8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            const [key, ...rest] = trimmed.split('=');
            if (key) env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
        });
    }
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing URL or ANON KEY');
    process.exit(1);
}

const supabase = createClient(url, key);

const run = async () => {
    const ownerEmail = 'trimarchitattoostudio@gmail.com'; // Trying the "correct" one first
    const password = 'TemporaryPassword123!';

    console.log(`Attempting login as ${ownerEmail}...`);
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
        email: ownerEmail,
        password: password
    });

    if (loginError) {
        console.error('Login failed:', loginError.message);
        // Try the typo version user provided just in case
        console.log('Trying typo version: trimrchitattoostudio@gmail.com');
        const { data: { session: s2 }, error: e2 } = await supabase.auth.signInWithPassword({
            email: 'trimrchitattoostudio@gmail.com',
            password: password
        });
        if (e2) {
            console.error('Login failed for typo version too:', e2.message);
            return;
        }
        console.log('Login success with typo version!');
    } else {
        console.log('Login success!');
    }

    const user = (await supabase.auth.getUser()).data.user;
    console.log(`Logged in as User ID: ${user.id}`);

    // Fetch Profile
    const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (!profile) {
        console.error('Profile not found.');
        return;
    }
    console.log('Owner Profile:', profile);
    const studioId = profile.studio_id;

    if (!studioId) {
        console.error('Studio ID missing in profile.');
        return;
    }

    console.log(`Fetching team for Studio ID: ${studioId}...`);

    // 1. Memberships
    const { data: memberships } = await supabase.from('studio_memberships').select('*').eq('studio_id', studioId);
    console.log(`Found ${memberships?.length || 0} memberships:`, memberships);

    // 2. Users IN memberships
    if (memberships && memberships.length > 0) {
        const ids = memberships.map(m => m.user_id);
        const { data: memberUsers } = await supabase.from('users').select('*').in('id', ids);
        console.log('Users from memberships:', memberUsers);
    }

    // 3. Orphaned/Direct Users
    const { data: studioUsers } = await supabase.from('users').select('*').eq('studio_id', studioId);
    console.log(`Found ${studioUsers?.length || 0} users with studio_id=${studioId}:`, studioUsers);

    // 4. Check specific Artist existence public
    const { data: artistCheck } = await supabase.from('users').select('*').eq('email', 'giotritattoo92@gmail.com');
    console.log('Specific Check for giotritattoo92@gmail.com in public.users:', artistCheck);

};

run();
