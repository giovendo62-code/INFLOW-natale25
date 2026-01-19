import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load env explicitly to be sure
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
    // Fallback if supabase/.env missing
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

console.log(`Checking existence in ${url}...`);

const supabase = createClient(url, key);

const checkUser = async () => {
    const email = 'trimarchitattoostudio@gmail.com';
    const password = 'TemporaryPassword123!'; // We won't actually use this if they exist

    console.log(`Checking if ${email} exists via SignUp attempt...`);

    // Attempt to sign up. 
    // If user exists: returns error "User already registered" (or Identical output with identities if config differs)
    // If user does not exist: creates a new unconfirmed user.

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.log('Result: User LIKELY EXISTS (Error received)');
        console.log('Error:', error.message);
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        console.log('Result: User EXISTS (Identities empty - generic response)');
    } else if (data.user) {
        console.log('Result: User DID NOT EXIST (New user created just now)');
        console.log('User ID:', data.user.id);
        console.log('WARNING: This confirms the user was NOT in this database before this moment.');
    } else {
        console.log('Result: Indeterminate');
        console.log(data);
    }
};

checkUser();
