
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { isValidRegistrationToken } from '../../config/access_tokens';

export const LoginPage: React.FC = () => {
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Registration Token State
    const [registrationToken, setRegistrationToken] = useState('');
    const [isTokenValid, setIsTokenValid] = useState(false);

    const from = location.state?.from?.pathname || '/dashboard';

    const handleVerifyToken = () => {
        if (isValidRegistrationToken(registrationToken)) {
            setIsTokenValid(true);
            setError(null);
        } else {
            setError('Codice di accesso non valido. Contatta l\'amministratore.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (activeTab === 'signup') {
                if (!isTokenValid) {
                    setError('Devi inserire un codice di accesso valido per registrarti.');
                    setLoading(false);
                    return;
                }
                const autoLogin = await signUp(email, password);
                if (autoLogin) {
                    navigate(from, { replace: true });
                } else {
                    setMessage('Registrazione avvenuta con successo! Controlla la tua email per confermare l\'account.');
                }
            } else {
                await signIn(email, password);
                navigate(from, { replace: true });
            }
        } catch (err: any) {
            console.error('Auth failed:', err);
            // Handle specific cases
            if (activeTab === 'login' && (err.message.includes('Invalid login credentials') || err.status === 400)) {
                setError('Credenziali non valide. Se non hai ancora un account, registrati nella scheda "Crea nuovo account".');
            } else {
                // Show more details for debugging
                const detail = err.message || JSON.stringify(err);
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'NOT SET (using mock?)';
                setError(`Errore: ${detail} (Status: ${err.status || 'N/A'})\nTarget: ${supabaseUrl.substring(0, 15)}...`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
            <div className="w-full max-w-md p-8 bg-bg-secondary rounded-lg border border-border shadow-2xl">
                <div className="text-center mb-6">
                    <div className="flex justify-center mb-4">
                        <img
                            src="/logo.jpg"
                            alt="InkFlow CRM"
                            className="w-24 h-24 rounded-full object-cover border-4 border-accent/20 shadow-xl"
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">InkFlow CRM</h1>
                    <p className="text-text-muted text-sm px-4">
                        Gestisci il tuo studio di tatuaggi con efficienza. Agenda, Clienti e Contabilità tutto in un'unica app.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex mb-6 bg-bg-tertiary p-1 rounded-lg">
                    <button
                        onClick={() => { setActiveTab('login'); setError(null); setMessage(null); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'login' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                    >
                        Ho già un account
                    </button>
                    <button
                        onClick={() => { setActiveTab('signup'); setError(null); setMessage(null); }}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'signup' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                    >
                        Crea nuovo account
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm text-center animate-in fade-in zoom-in-95">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded text-green-500 text-sm text-center">
                        {message}
                    </div>
                )}

                {/* Token Check for Registration */}
                {activeTab === 'signup' && !isTokenValid ? (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="text-center p-4 bg-bg-tertiary rounded-lg border border-accent/20">
                            <Lock className="mx-auto text-accent mb-2" size={24} />
                            <h3 className="text-lg font-bold text-text-primary mb-1">Codice Accesso Richiesto</h3>
                            <p className="text-xs text-text-muted">
                                La registrazione è riservata. Inserisci uno dei 10 codici di accesso validi per procedere.
                            </p>
                        </div>
                        <input
                            type="text"
                            value={registrationToken}
                            onChange={(e) => {
                                setRegistrationToken(e.target.value);
                                setError(null);
                            }}
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary text-center font-mono uppercase focus:ring-accent focus:border-accent transition-all"
                            placeholder="INK-XXXX-X"
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyToken()}
                        />
                        <button
                            onClick={handleVerifyToken}
                            className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
                        >
                            Verifica Codice
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in">
                        {activeTab === 'signup' && (
                            <div className="bg-green-500/10 text-green-500 text-xs px-2 py-1 rounded text-center mb-2">
                                ✓ Codice Accesso Valido
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                            <input
                                type="email"
                                name="email"
                                autoComplete="username"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-accent focus:border-accent transition-all"
                                placeholder="nome@esempio.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    autoComplete={activeTab === 'login' ? "current-password" : "new-password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:ring-accent focus:border-accent pr-10 transition-all"
                                    placeholder="Inserisci la password"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {/* Actions Row: Remember Me & Forgot Password */}
                            {activeTab === 'login' && (
                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="remember"
                                            className="rounded border-gray-300 text-accent focus:ring-accent"
                                            defaultChecked
                                        />
                                        <label htmlFor="remember" className="text-xs text-text-secondary cursor-pointer">
                                            Resta collegato
                                        </label>
                                    </div>
                                    <Link to="/forgot-password" className="text-xs text-accent hover:text-accent-hover transition-colors">
                                        Password dimenticata?
                                    </Link>
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? 'Elaborazione...' : (activeTab === 'login' ? 'Accedi' : 'Registrati')}
                        </button>
                    </form>
                )}

                {/* Deprecated toggle link removed in favor of Tabs */}
            </div>
        </div>
    );
};

