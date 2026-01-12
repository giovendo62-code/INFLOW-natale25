import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import { Mail, Shield, AlertTriangle, Key } from 'lucide-react';

export const AcceptInvitePage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { user, isLoading: authIsLoading } = useAuth(); // Access user state

    const [loading, setLoading] = useState(true);
    const [invitationError, setInvitationError] = useState<string | null>(null); // For token validation errors
    const [authError, setAuthError] = useState<string | null>(null); // For login/signup errors
    const [invitation, setInvitation] = useState<any | null>(null);
    const [isAccepting, setIsAccepting] = useState(false);

    // Auth Form State
    const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    useEffect(() => {
        validateToken();
    }, [token]);

    const normalizeEmail = (e: string) => e?.trim().toLowerCase();

    // Auto-accept if user is already logged in (e.g. after email confirmation redirect)
    // BUT only if the email matches the invitation!
    useEffect(() => {
        if (!authIsLoading && user && invitation && token && !isAccepting) {
            if (normalizeEmail(user.email) === normalizeEmail(invitation.email)) {
                console.log('User authenticated and emails match -> Auto-accepting...');
                acceptDrive(user.id);
            } else {
                console.warn('User logged in but email mismatch:', user.email, invitation.email);
            }
        }
    }, [authIsLoading, user, invitation, token]);

    const validateToken = async () => {
        if (!token) {
            setInvitationError('Token di invito mancante.');
            setLoading(false);
            return;
        }

        try {
            const invite = await api.settings.getInvitation(token);
            if (!invite) {
                setInvitationError('Invito non valido o scaduto.');
            } else {
                setInvitation(invite);
                setEmail(invite.email); // Pre-fill email
            }
        } catch (err) {
            console.error('Validation error:', err);
            setInvitationError('Invito non valido o scaduto.');
        } finally {
            setLoading(false);
        }
    };

    const acceptDrive = async (userId: string) => {
        setIsAccepting(true);
        try {
            await api.settings.acceptInvitation(token!, userId, invitation.studio_id, invitation.role);
            // Force reload/redirect to refresh context
            window.location.href = '/dashboard';
        } catch (acceptErr: any) {
            console.error('Acceptance error:', acceptErr);
            setAuthError(`Errore durante l'accettazione: ${acceptErr.message || 'Sconosciuto'}`);
            setIsAccepting(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError(null);

        try {
            let user = null;
            if (authMode === 'signin') {
                const session = await api.auth.signIn(email, password);
                user = session.user;
            } else {
                // Pass current URL as redirect to ensuring they come back here
                const redirectUrl = `${window.location.origin}/accept-invite?token=${token}`;
                const result = await api.auth.signUp(email, password, redirectUrl);

                // If result is not null, immediate login succeeded (Confirm Email disabled)
                if (result) {
                    user = result.user;
                    // Update full name if signed up
                    if (fullName) {
                        await api.settings.updateProfile(user!.id, { full_name: fullName });
                    }
                } else {
                    // Confirmation email sent
                    if (token) {
                        localStorage.setItem('pendingInviteToken', token);
                        if (fullName) {
                            localStorage.setItem('pendingInviteName', fullName);
                        }
                    }
                    setAuthError('Controlla la tua email per confermare l\'account. Dopo la conferma verrai reindirizzato qui.');
                    setAuthLoading(false);
                    return;
                }
            }

            if (user) {
                await acceptDrive(user.id);
            }

        } catch (err: any) {
            console.error('Auth error:', err);
            setAuthError('Credenziali non valide o errore durante la registrazione.');
            setAuthLoading(false);
        } /* finally handled inside branches or effect */
    };

    if (loading) {
        return <div className="min-h-screen bg-bg-primary flex items-center justify-center text-white">Validazione invito...</div>;
    }

    if (invitationError) {
        return (
            <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
                <div className="bg-bg-secondary p-8 rounded-xl border border-red-500/30 max-w-md w-full text-center">
                    <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Invito Non Valido</h2>
                    <p className="text-text-muted mb-6">{invitationError}</p>
                    <div className="text-xs text-left bg-black/30 p-2 rounded mb-4 font-mono text-gray-500 break-all">
                        Debug: {token}
                    </div>
                    <button onClick={() => navigate('/')} className="text-accent hover:underline">Torna alla Dashboard</button>
                    <button onClick={() => window.location.reload()} className="block mx-auto mt-4 text-sm text-text-muted hover:text-white">Riprova</button>
                </div>
            </div>
        );
    }

    // Check if logged in with different user
    if (user && invitation && normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
        return (
            <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
                <div className="bg-bg-secondary p-8 rounded-xl border border-yellow-500/30 max-w-md w-full text-center">
                    <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Utente già loggato</h2>
                    <p className="text-text-muted mb-4">
                        Sei loggato come <span className="text-white font-bold">{user.email}</span>,
                        ma questo invito è per <span className="text-accent font-bold">{invitation.email}</span>.
                    </p>
                    <p className="text-text-muted text-sm mb-6">
                        Per accettare l'invito, devi prima uscire dall'account attuale.
                    </p>
                    <button
                        onClick={async () => {
                            await api.auth.signOut();
                            window.location.reload();
                        }}
                        className="w-full py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg font-bold"
                    >
                        Esci e Continua
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4">
            <div className="bg-bg-secondary p-8 rounded-xl border border-border max-w-md w-full shadow-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex p-4 rounded-full bg-accent/10 text-accent mb-4">
                        <Shield size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Accetta Invito</h1>
                    <p className="text-text-muted text-sm">
                        Sei stato invitato a unirti al team come <span className="text-white font-medium capitalize">{invitation.role}</span>.
                    </p>
                </div>

                <div className="flex bg-bg-tertiary p-1 rounded-lg mb-6">
                    <button
                        onClick={() => setAuthMode('signin')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${authMode === 'signin' ? 'bg-bg-primary text-white shadow' : 'text-text-muted hover:text-white'}`}
                    >
                        Ho già un account
                    </button>
                    <button
                        onClick={() => setAuthMode('signup')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${authMode === 'signup' ? 'bg-bg-primary text-white shadow' : 'text-text-muted hover:text-white'}`}
                    >
                        Crea account
                    </button>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {authMode === 'signup' && (
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1 uppercase">Nome Completo</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:ring-accent focus:border-accent"
                                placeholder="Mario Rossi"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1 uppercase">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-3 text-white focus:ring-accent focus:border-accent"
                                placeholder="tu@esempio.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-text-muted mb-1 uppercase">Password</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-3 text-white focus:ring-accent focus:border-accent"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    {authError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
                            {authError}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-bold transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
                    >
                        {authLoading ? 'Elaborazione...' : (authMode === 'signin' ? 'Accedi e Unisciti' : 'Registrati e Unisciti')}
                    </button>
                </form>
            </div>
        </div >
    );
};
