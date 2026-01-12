
import React, { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../services/api';
// Use window.location for hard reload or navigate for soft? 
// Prompt said "redirect to /dashboard". Soft is nicer, but we need to re-check membership.
// Since AuthContext doesn't expose a re-check, I'll use window.location.href to force a clean slate reload.
// import { useNavigate } from 'react-router-dom';

export const RegisterStudioPage = () => {
    const { user, signOut } = useAuth();
    // navigate unused

    const [studioName, setStudioName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingInvites, setPendingInvites] = useState<{ token: string; studio_name: string; role: string; created_at: string }[]>([]);

    React.useEffect(() => {
        if (user) {
            checkInvites();
            checkRecovery();
        }
    }, [user]);

    const checkRecovery = async () => {
        try {
            const recoveredStudio = await api.settings.recoverOrphanedOwner();
            if (recoveredStudio) {
                alert(`Bentornato! Abbiamo ripristinato il tuo accesso allo studio: ${recoveredStudio}`);
                window.location.href = '/dashboard';
            }
        } catch (err) {
            console.error('Recovery check failed:', err);
        }
    };

    const checkInvites = async () => {
        try {
            const invites = await api.settings.getMyPendingInvitations();
            if (invites && invites.length > 0) {
                setPendingInvites(invites);
            }
        } catch (err) {
            console.error('Failed to check invites:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            await api.settings.registerStudio(studioName, user.id);
            // Force reload to refresh AuthContext membership check
            window.location.href = '/dashboard';
        } catch (err: any) {
            console.error('Registration failed:', err);
            setError(err.message || 'Failed to create studio. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4 text-center">
            <div className="max-w-md w-full bg-bg-secondary p-8 rounded-lg shadow-xl border border-border text-left">
                <h1 className="text-2xl font-bold text-white mb-2">Benvenuto in InkFlow</h1>
                <p className="text-text-secondary mb-6">
                    Ciao, <span className="text-white font-bold">{user?.full_name || user?.email}</span>! <br />
                    Al momento non sei collegato a nessuno studio.
                </p>

                {pendingInvites.length > 0 ? (
                    <div className="bg-accent/10 border border-accent p-4 rounded-lg mb-6 text-center animate-pulse">
                        <h3 className="text-accent font-bold mb-2">🎉 Hai un invito in sospeso!</h3>
                        <p className="text-white text-sm mb-4">
                            Sei stato invitato a unirti a <span className="font-bold">{pendingInvites[0].studio_name}</span>.
                        </p>
                        <button
                            onClick={() => window.location.href = `/accept-invite?token=${pendingInvites[0].token}`}
                            className="bg-accent hover:bg-accent-hover text-white px-6 py-2 rounded-lg font-bold transition-colors w-full"
                        >
                            Accetta Invito
                        </button>
                    </div>
                ) : (
                    <div className="bg-bg-tertiary p-4 rounded-lg border border-yellow-500/20 mb-6">
                        <p className="text-sm text-yellow-500 mb-2">
                            Se fai parte di un team, chiedi al tuo admin di inviarti un nuovo link di invito.
                        </p>
                        <p className="text-xs text-text-muted">
                            Oppure, se sei un Titolare, crea il tuo nuovo spazio di lavoro qui sotto.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Nome del tuo Studio</label>
                        <input
                            type="text"
                            value={studioName}
                            onChange={(e) => setStudioName(e.target.value)}
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-white focus:ring-accent focus:border-accent"
                            placeholder="Es. InkFlow Tattoo Milano"
                            required
                            minLength={3}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Creazione in corso...' : 'Crea Studio e Inizia'}
                    </button>
                </form>

                <div className="mt-6 pt-4 border-t border-border text-center">
                    <button
                        onClick={() => signOut()}
                        className="text-sm text-red-500 hover:text-red-400 underline transition-colors"
                    >
                        Esci / Logout
                    </button>
                </div>
            </div>
        </div>
    );
};
