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
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
    console.error('ERROR: SERVICE_ROLE_KEY not found in env. Cannot proceed with admin checks.');
    process.exit(1);
}

const supabase = createClient(url, key);

const debug = async () => {
    const ownerEmail = 'trimarchitattoostudio@gmail.com'; // Typo in prompt likely 'trimarchitattoostudio' vs 'trimrchi'
    // Actually the user typed: trimrchitattoostudio@gmail.com in the prompt, but let's check both or fuzzy.
    // I'll assume the user might have made a typo in the prompt, or maybe not. I'll search for the email provided.
    const userProvidedOwnerEmail = 'trimrchitattoostudio@gmail.com';
    const artistEmail = 'giotritattoo92@gmail.com';

    console.log('--- DEBUG START ---');

    // 1. Check Owner(s)
    const { data: owners, error: ownersError } = await supabase.auth.admin.listUsers();

    if (ownersError) {
        console.error('Error fetching users:', ownersError);
        return;
    }

    const allUsers = owners.users;
    console.log(`Total users in Auth: ${allUsers.length}`);

    const ownerUser = allUsers.find(u => u.email === userProvidedOwnerEmail) || allUsers.find(u => u.email === 'trimarchitattoostudio@gmail.com');
    const artistUser = allUsers.find(u => u.email === artistEmail);

    if (ownerUser) {
        console.log(`\nFOUND OWNER: ${ownerUser.email} (ID: ${ownerUser.id})`);

        // Check Metadata
        console.log('Owner Metadata:', ownerUser.user_metadata);

        // Check public.users profile
        const { data: ownerProfile } = await supabase.from('users').select('*').eq('id', ownerUser.id).single();
        console.log('Owner Public Profile:', ownerProfile);

        const studioId = ownerProfile?.studio_id;

        if (studioId) {
            console.log(`\nStudio ID found: ${studioId}`);

            // Check Memberships
            const { data: memberships } = await supabase.from('studio_memberships').select('*').eq('studio_id', studioId);
            console.log(`\nMemberships for Studio ${studioId}:`, memberships);

            // Check Invitations
            const { data: invites } = await supabase.from('studio_invitations').select('*').eq('studio_id', studioId);
            console.log(`\nInvitations for Studio ${studioId}:`, invites);
        } else {
            console.log('\nWARNING: Owner has no studio_id in public profile.');
        }

    } else {
        console.log(`\nERROR: Owner email not found among ${allUsers.length} users.`);
        // List similar emails
        console.log('Similar emails found:', allUsers.filter(u => u.email?.includes('tattoo')).map(u => u.email));
    }

    if (artistUser) {
        console.log(`\nFOUND ARTIST: ${artistUser.email} (ID: ${artistUser.id})`);
        console.log('Artist Metadata:', artistUser.user_metadata);

        // Check public.users profile
        const { data: artistProfile } = await supabase.from('users').select('*').eq('id', artistUser.id).single();
        console.log('Artist Public Profile:', artistProfile);

    } else {
        console.log(`\nWARNING: Artist email ${artistEmail} NOT FOUND in Auth users.`);
    }

    console.log('--- DEBUG END ---');
};

debug();
