
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export const UpdatePasswordPage: React.FC = () => {
    const { updatePassword } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await updatePassword(password);
            setSuccess(true);
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);
        } catch (err: any) {
            console.error('Update password failed:', err);
            setError(err.message || 'Errore durante l\'aggiornamento della password. Riprova.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
            <div className="w-full max-w-md p-8 bg-bg-secondary rounded-lg border border-border shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-red-500 bg-clip-text text-transparent mb-2">
                        Nuova Password
                    </h1>
                    <p className="text-text-muted">
                        Inserisci la tua nuova password sicura.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm text-center">
                        {error}
                    </div>
                )}

                {success ? (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded text-green-500 text-sm text-center">
                        <p className="font-bold">Password aggiornata con successo!</p>
                        <p className="text-xs mt-1">Reindirizzamento alla Dashboard...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Nuova Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-white focus:ring-accent focus:border-accent pr-10"
                                    placeholder="Inserisci nuova password"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Aggiornamento...' : 'Aggiorna Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
