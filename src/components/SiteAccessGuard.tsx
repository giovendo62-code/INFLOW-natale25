import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const SiteAccessGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accessGranted, setAccessGranted] = useState<boolean | null>(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD;

    useEffect(() => {
        // 1. If no password is set in env, allow access immediately (Production safety)
        if (!SITE_PASSWORD) {
            setAccessGranted(true);
            return;
        }

        // 2. Check LocalStorage
        const storedAccess = localStorage.getItem('site_access_granted');
        if (storedAccess === 'true') {
            setAccessGranted(true);
            return;
        }

        // 3. Check Supabase Session (If already logged in, bypass)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setAccessGranted(true);
            } else {
                setAccessGranted(false);
            }
        });

    }, [SITE_PASSWORD]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === SITE_PASSWORD) {
            localStorage.setItem('site_access_granted', 'true');
            setAccessGranted(true);
            setError('');
        } else {
            setError('Password errata');
        }
    };

    if (accessGranted === null) {
        return <div className="min-h-screen bg-bg-primary flex items-center justify-center text-text-muted">Verifica accesso...</div>;
    }

    if (accessGranted) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary p-4 animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-bg-secondary p-8 rounded-2xl border border-border shadow-2xl flex flex-col items-center text-center">

                <img
                    src="/logo.jpg"
                    alt="InkFlow"
                    className="w-24 h-24 rounded-full border-4 border-accent/20 mb-6 object-cover shadow-lg"
                />

                <h1 className="text-2xl font-bold text-text-primary mb-2">Accesso Riservato</h1>
                <p className="text-text-muted mb-8 text-sm">
                    Questo sito è protetto. Inserisci la password per accedere.
                </p>

                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password di accesso"
                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent outline-none transition-colors text-center font-mono placeholder:font-sans"
                        autoFocus
                    />

                    {error && (
                        <div className="text-red-500 text-sm font-medium animate-in shake">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!password}
                        className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Entra
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-border w-full">
                    <p className="text-xs text-text-muted/50 uppercase tracking-widest">
                        InkFlow CRM Protected
                    </p>
                </div>
            </div>
        </div>
    );
};
