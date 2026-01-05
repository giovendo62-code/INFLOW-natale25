
import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

export const DebugSupabase = () => {
    const [status, setStatus] = useState<string>('Connecting...');
    const [details, setDetails] = useState<string>('');

    useEffect(() => {
        const checkConnection = async () => {
            try {
                // Testing connection by getting the session (no restart needed, just a ping)
                const { data: _data, error } = await supabaseClient.auth.getSession();

                if (error) {
                    setStatus('Error connecting');
                    setDetails(error.message);
                } else {
                    setStatus('Connected');
                    setDetails('Supabase is reachable. Session retrieval successful (even if null).');
                }
            } catch (err: any) {
                setStatus('Exception');
                setDetails(err.message || 'Unknown error');
            }
        };

        checkConnection();
    }, []);

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h1>Supabase Connection Debug</h1>
            <div style={{
                padding: '10px',
                border: '1px solid #ccc',
                background: status === 'Connected' ? '#e6fffa' : '#fff5f5',
                color: status === 'Connected' ? '#006644' : '#c53030'
            }}>
                <strong>Status:</strong> {status}
            </div>
            {details && (
                <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>
                    <strong>Details:</strong>
                    <pre>{details}</pre>
                </div>
            )}
            <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
                <p>Ensure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> are set in your .env file.</p>
            </div>
        </div>
    );
};
