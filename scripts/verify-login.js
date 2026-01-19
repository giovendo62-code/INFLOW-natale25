import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load env
const envPath = path.join(rootDir, '.env');
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
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

console.log(`Connecting to ${url}...`);
const supabase = createClient(url, key);

const testLogin = async () => {
    const email = 'trimarchitattoostudio@gmail.com';
    const password = 'Connetti1';

    console.log(`Attempting login for ${email}...`);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error('❌ Login failed:', error.message);
        console.error('Points to check:');
        console.error('1. Does this user exist in THIS project? (We switched projects)');
        console.error('2. Is the password correct?');
    } else {
        console.log('✅ Login SUCCESSFUL!');
        console.log('User ID:', data.user.id);
        console.log('Session active.');
    }
};

testLogin();
