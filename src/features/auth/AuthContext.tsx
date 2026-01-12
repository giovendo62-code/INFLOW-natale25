import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../../services/types';
import { api } from '../../services/api';
import { supabase } from '../../lib/supabase';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    hasStudio: boolean | null; // null = checking
    signIn: (email: string, password?: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<boolean>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [hasStudio, setHasStudio] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkUser();

        // Listen for Auth Changes (e.g. Password Recovery link clicked)
        // Listen for Auth Changes (e.g. Password Recovery link clicked)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
            console.log('[AuthContext] Auth State Change:', event);

            if (event === 'PASSWORD_RECOVERY') {
                console.log('[AuthContext] Password Recovery event detected. Refreshing session...');
                await checkUser();
            } else if (event === 'SIGNED_IN') {
                // Check if we already have the user to avoid double-loading on mount
                // But since we use a local checkUser, we should let it run if it's a real event.
                // The issue is likely INITIAL_SESSION firing immediately after checkUser starts.
                // We can debounce or checking if we are already loading.
                // Simple fix for now: Trust checkUser to handle it, but ensure we don't get stuck.
                await checkUser();
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setHasStudio(false);
                setIsLoading(false); // Ensure loading is cleared on sign out
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    function normalizeRole(role: string): any {
        const r = role.toLowerCase();
        if (r === 'owner') return 'owner';
        if (r === 'studio_admin') return 'studio_admin';
        if (r === 'manager') return 'manager';
        if (r === 'artist') return 'artist';
        if (r === 'student') return 'student';
        return 'student';
    }

    const checkingRef = React.useRef(false);

    const checkUser = React.useCallback(async () => {
        if (checkingRef.current) {
            console.log('AuthContext: checkUser already in progress, skipping.');
            return;
        }
        checkingRef.current = true;
        console.log('AuthContext: Checking user session...');

        try {
            // Add a timeout race to detect hangs
            const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('getCurrentUser timed out')), 10000)
            );

            const userPromise = api.auth.getCurrentUser();

            const currentUser = await Promise.race([userPromise, timeoutPromise]) as User | null;

            console.log('AuthContext: User found:', currentUser ? currentUser.id : 'null');

            if (currentUser) {
                // Normalize role
                currentUser.role = normalizeRole(currentUser.role);

                // Check for pending invite token (e.g. from email confirmation flow)
                const pendingToken = localStorage.getItem('pendingInviteToken');
                if (pendingToken) {
                    try {
                        console.log('AuthContext: Found pending invite token, processing...');
                        const invite = await api.settings.getInvitation(pendingToken);
                        if (invite) {
                            await api.settings.acceptInvitation(pendingToken, currentUser.id, invite.studio_id, invite.role);
                            console.log('AuthContext: Pending invite accepted successfully.');
                            // Optionally update role if the invite dictates it (though standard is STUDENT mostly)
                            if (invite.role) currentUser.role = normalizeRole(invite.role);
                        }
                    } catch (err) {
                        console.error('AuthContext: Failed to process pending invite', err);
                    } finally {
                        // Handle pending name update (from signup flow)
                        const pendingName = localStorage.getItem('pendingInviteName');
                        if (pendingName) {
                            try {
                                console.log('AuthContext: Found pending name, updating profile...', pendingName);
                                await api.settings.updateProfile(currentUser.id, { full_name: pendingName });
                            } catch (err) {
                                console.error('AuthContext: Failed to update pending name', err);
                            } finally {
                                localStorage.removeItem('pendingInviteName');
                            }
                        }

                        localStorage.removeItem('pendingInviteToken');
                    }
                }

                setUser(currentUser);

                const membership = await api.settings.checkMembership(currentUser.id);
                setHasStudio(membership);
            } else {
                setUser(null);
                setHasStudio(false);
            }
        } catch (error) {
            console.error('Failed to restore session:', error);
            // Even on error, we must eventually allow retry or show error state
            // But for now, just let it fail gracefully
        } finally {
            console.log('AuthContext: Set loading false');
            setIsLoading(false);
            checkingRef.current = false;
        }
    }, []);

    async function signUp(email: string, password: string): Promise<boolean> {
        setIsLoading(true);
        try {
            const session = await api.auth.signUp(email, password, window.location.origin);
            if (session && session.user) {
                session.user.role = normalizeRole(session.user.role);
                setUser(session.user);
                return true; // Auto-login successful
            }
            return false; // Confirmation required
        } finally {
            setIsLoading(false);
        }
    }

    async function signIn(email: string, password?: string) {
        setIsLoading(true);
        try {
            const session = await api.auth.signIn(email, password || 'password-ignored-in-mock');
            if (session.user) {
                session.user.role = normalizeRole(session.user.role);
                setUser(session.user);
                const membership = await api.settings.checkMembership(session.user.id);
                setHasStudio(membership);
            } else {
                setUser(null);
            }
        } finally {
            setIsLoading(false);
        }
    }

    async function signOut() {
        setIsLoading(true);
        try {
            await api.auth.signOut();
            setUser(null);
            setHasStudio(false);
        } finally {
            setIsLoading(false);
        }
    }

    async function resetPassword(email: string) {
        setIsLoading(true);
        try {
            // Redirect to the update password page
            const redirectTo = `${window.location.origin}/update-password`;
            await api.auth.resetPasswordForEmail(email, redirectTo);
        } finally {
            setIsLoading(false);
        }
    }

    async function updatePassword(password: string) {
        setIsLoading(true);
        try {
            await api.auth.updatePassword(password);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            hasStudio,
            signIn,
            signUp,
            signOut,
            resetPassword,
            updatePassword,
            refreshProfile: checkUser // Expose checkUser
        }}>
            {children}
        </AuthContext.Provider>
    );
}


export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
