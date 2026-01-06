import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../../services/types';
import { api } from '../../services/api';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [hasStudio, setHasStudio] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkUser();
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

    async function checkUser() {
        console.log('AuthContext: Checking user session...');
        try {
            const currentUser = await api.auth.getCurrentUser();
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
        } finally {
            console.log('AuthContext: Set loading false');
            setIsLoading(false);
        }
    }

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
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, hasStudio, signIn, signUp, signOut, resetPassword, updatePassword }}>
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
