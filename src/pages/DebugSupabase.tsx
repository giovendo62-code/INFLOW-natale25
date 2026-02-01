import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../features/auth/AuthContext';

export const DebugSupabase: React.FC = () => {
    const { user: _user } = useAuth();
    const [logs, setLogs] = useState<string[]>([]);
    const [diagnostics, setDiagnostics] = useState<any>({});
    const [_loading, setLoading] = useState(true);

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    useEffect(() => {
        const runDiagnostics = async () => {
            setLoading(true);
            addLog('Starting Diagnostics...');

            try {
                // 1. Check Session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                addLog(`Session Check: ${session ? 'Active' : 'No Session'} (${session?.user?.email})`);
                if (sessionError) addLog(`Session Error: ${sessionError.message}`);

                const authId = session?.user?.id;
                setDiagnostics(prev => ({ ...prev, session: session }));

                if (authId) {
                    // 2. Try to read OWN user record
                    addLog(`Attempting to fetch user record for ${authId}...`);
                    const { data: userRecord, error: userError } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', authId)
                        .single();

                    if (userError) {
                        addLog(`RLS BLOCKED READ (users): ${userError.message} (${userError.code})`);
                        setDiagnostics(prev => ({ ...prev, userError }));
                    } else {
                        addLog('SUCCESS: Could read own user record.');
                        setDiagnostics(prev => ({ ...prev, userRecord }));
                    }

                    // 3. Try to update OWN user record
                    addLog('Attempting dry-run update of own record...');
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({ full_name: userRecord?.full_name || session.user.email }) // No-change update
                        .eq('id', authId);

                    if (updateError) {
                        addLog(`RLS BLOCKED UPDATE (users): ${updateError.message} (${updateError.code})`);
                    } else {
                        addLog('SUCCESS: Could update own user record (Permissions OK).');
                    }

                    // 4. Check Memberships
                    addLog('Fetching memberships...');
                    const { data: memberships, error: memError } = await supabase
                        .from('studio_memberships')
                        .select('*')
                        .eq('user_id', authId);

                    if (memError) {
                        addLog(`Error fetching memberships: ${memError.message}`);
                    } else {
                        addLog(`Found ${memberships?.length || 0} memberships.`);
                        setDiagnostics(prev => ({ ...prev, memberships }));
                    }

                    // 5. Check Studio Invitations (if owner)
                    const { data: invites, error: invError } = await supabase.from('studio_invitations').select('*');
                    if (invError) {
                        addLog(`Cannot read invitations: ${invError.message} (Expected if not owner/admin)`);
                    } else {
                        addLog(`Visible invitations: ${invites?.length || 0}`);
                    }

                } else {
                    addLog('SKIPPING Database checks: No Authenticated User.');
                }

            } catch (err: any) {
                addLog(`CRITICAL EXCEPTION: ${err.message}`);
            } finally {
                setLoading(false);
                addLog('Diagnostics Complete.');
            }
        };

        runDiagnostics();
    }, []);

    return (
        <div className="p-8 max-w-4xl mx-auto bg-white text-black font-mono text-sm">
            <h1 className="text-2xl font-bold mb-4">Supabase RLS Diagnostics</h1>

            <div className="mb-6 p-4 bg-gray-100 rounded border">
                <h2 className="font-bold mb-2">Instructions</h2>
                <p>1. If you see "RLS BLOCKED" errors, the database policies are definitely broken.</p>
                <p>2. Please screenshot this page or copy the logs below.</p>
            </div>

            <div className="mb-6">
                <h2 className="font-bold mb-2">Logs</h2>
                <div className="bg-black text-green-400 p-4 rounded h-64 overflow-y-auto whitespace-pre-wrap">
                    {logs.join('\n')}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded">
                    <h3 className="font-bold border-b mb-2">Session Data</h3>
                    <pre className="overflow-auto max-h-40">{JSON.stringify(diagnostics.session?.user, null, 2)}</pre>
                </div>
                <div className="p-4 border rounded">
                    <h3 className="font-bold border-b mb-2">Database Record</h3>
                    <pre className="overflow-auto max-h-40">{JSON.stringify(diagnostics.userRecord, null, 2)}</pre>
                </div>
                <div className="p-4 border rounded">
                    <h3 className="font-bold border-b mb-2">Memberships</h3>
                    <pre className="overflow-auto max-h-40">{JSON.stringify(diagnostics.memberships, null, 2)}</pre>
                </div>
            </div>
        </div>
    );
};
