
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
                <h1 className="text-2xl font-bold text-white mb-2">Create Your Studio</h1>
                <p className="text-text-secondary mb-6">
                    Welcome, {user?.email}! <br />
                    To get started, please name your new workspace.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Studio Name</label>
                        <input
                            type="text"
                            value={studioName}
                            onChange={(e) => setStudioName(e.target.value)}
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-white focus:ring-accent focus:border-accent"
                            placeholder="My Awesome Studio"
                            required
                            minLength={3}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Creating Studio...' : 'Create Studio & Launch'}
                    </button>
                </form>

                <div className="mt-6 pt-4 border-t border-border text-center">
                    <button
                        onClick={() => signOut()}
                        className="text-sm text-text-muted hover:text-white underline"
                    >
                        Sign Out / Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
