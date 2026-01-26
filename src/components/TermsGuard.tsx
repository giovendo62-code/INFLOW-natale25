import React, { useEffect, useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../services/api';
import { Check, ShieldCheck } from 'lucide-react';

export const TermsGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, refreshProfile } = useAuth();
    const [mustAccept, setMustAccept] = useState(false);
    const [termsContent, setTermsContent] = useState('');
    const [termsVersion, setTermsVersion] = useState(0);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        const checkTerms = async () => {
            // Only check for logged-in students with a studio
            if (!user || (user.role !== 'student') || !user.studio_id) {
                setMustAccept(false);
                setLoading(false);
                return;
            }

            try {
                // Timeout failsafe - if API is sluggish, allow access rather than block
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Terms check timed out')), 5000)
                );

                const termsCheckPromise = (async () => {
                    const studio = await api.settings.getStudio(user.studio_id!);
                    // If no terms set, nothing to accept.
                    if (!studio || !studio.academy_terms) {
                        return false;
                    }

                    // If studio version > user accepted version, show blocking modal
                    const studioVersion = studio.academy_terms_version || 0;
                    const userVersion = user.academy_terms_accepted_version || 0;

                    if (studioVersion > userVersion) {
                        setTermsContent(studio.academy_terms);
                        setTermsVersion(studioVersion);
                        return true;
                    }
                    return false;
                })();

                const shouldShow = await Promise.race([termsCheckPromise, timeoutPromise]);

                if (shouldShow === true) {
                    setMustAccept(true);
                } else {
                    setMustAccept(false);
                }

            } catch (error) {
                console.error("Failed to check terms (network or timeout)", error);
                // Fail safe: allow access if check fails, to prevent locking out on network errors
                setMustAccept(false);
            } finally {
                setLoading(false);
            }
        };

        checkTerms();
    }, [user?.id, user?.role, user?.studio_id, user?.academy_terms_accepted_version]);

    const handleAccept = async () => {
        if (!user) return;
        setAccepting(true);
        try {
            await api.academy.acceptTerms(user.id, termsVersion);
            await refreshProfile(); // Update local user state
            // mustAccept will be re-evaluated to false by effect or set manually
            setMustAccept(false);
        } catch (error) {
            console.error("Failed to accept terms", error);
            alert("Si è verificato un errore durante l'accettazione. Riprova.");
        } finally {
            setAccepting(false);
        }
    };

    if (loading) {
        // Optional: Render a loading spinner if you want to prevent flash of content
        // For now, render children to avoid layout shift, or nothing?
        // Since it's a guard, rendering nothing is safer to prevent flashing protected content.
        return (
            <div className="h-screen w-screen bg-bg-primary flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (mustAccept) {
        return (
            <div className="fixed inset-0 bg-bg-primary z-[100] flex flex-col items-center justify-center p-4">
                <div className="bg-bg-secondary w-full max-w-2xl rounded-xl border border-border shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-border flex flex-col items-center text-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-2">
                            <ShieldCheck className="text-accent" size={24} />
                        </div>
                        <h1 className="text-2xl font-bold text-text-primary">Aggiornamento Termini</h1>
                        <p className="text-text-muted">
                            L'accademia ha aggiornato i Termini e Condizioni. <br />
                            Per continuare ad accedere alla piattaforma, è necessario leggere e accettare i nuovi termini.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-bg-tertiary/30">
                        <div className="prose prose-invert max-w-none text-text-secondary text-sm whitespace-pre-wrap font-mono bg-bg-primary p-4 rounded-lg border border-border">
                            {termsContent}
                        </div>
                    </div>

                    <div className="p-6 border-t border-border bg-bg-secondary rounded-b-xl flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-xs text-text-muted text-center md:text-left">
                            Accettando, confermi di aver letto e compreso i termini sopra riportati.
                        </p>
                        <button
                            onClick={handleAccept}
                            disabled={accepting}
                            className="w-full md:w-auto px-6 py-3 bg-accent hover:bg-accent/80 text-white rounded-lg font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
                        >
                            {accepting ? (
                                <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                            ) : (
                                <Check size={20} />
                            )}
                            Accetto e Continua
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
