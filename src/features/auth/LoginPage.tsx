
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export const LoginPage: React.FC = () => {
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const from = location.state?.from?.pathname || '/dashboard';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                const autoLogin = await signUp(email, password);
                if (autoLogin) {
                    navigate(from, { replace: true });
                } else {
                    setMessage('Registration successful! Please check your email to confirm your account.');
                    // Don't navigate, let them read the message
                }
            } else {
                await signIn(email, password);
                navigate(from, { replace: true });
            }
        } catch (err: any) {
            console.error('Auth failed:', err);
            setError(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
            <div className="w-full max-w-md p-8 bg-bg-secondary rounded-lg border border-border shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-red-500 bg-clip-text text-transparent mb-2">
                        InkFlow
                    </h1>
                    <p className="text-text-muted">
                        {isSignUp ? 'Create a new account' : 'Sign in to your account'}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm text-center">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded text-green-500 text-sm text-center">
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-white focus:ring-accent focus:border-accent"
                            placeholder="name@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-white focus:ring-accent focus:border-accent"
                            placeholder="Enter your password"
                            required
                            minLength={6}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            setMessage(null);
                        }}
                        className="text-sm text-text-muted hover:text-white transition-colors underline"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Create one'}
                    </button>
                </div>
            </div>
        </div>
    );
};
