import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { UserRole } from '../../services/types';

interface RoleGuardProps {
    allowedRoles?: UserRole[];
    additionalCheck?: (user: any) => boolean; // Using any for user to avoid circular dep or strict type issues for now, or import User
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, additionalCheck }) => {
    const { user, isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    const [showTimeoutError, setShowTimeoutError] = React.useState(false);

    React.useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isLoading) {
            timer = setTimeout(() => {
                setShowTimeoutError(true);
            }, 10000); // 10 seconds timeout
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

    if (isLoading) {
        if (showTimeoutError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-bg-primary gap-4 p-4 text-center">
                    <div className="text-xl font-bold text-red-500">
                        Caricamento troppo lento
                    </div>
                    <p className="text-text-muted">Si è verificato un problema nel recupero dei dati utente.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-accent text-white rounded-lg font-bold hover:bg-accent/80 transition-colors"
                    >
                        Riprova
                    </button>
                    <button
                        onClick={() => {
                            // Force basic logout logic if auth hangs
                            localStorage.clear();
                            window.location.href = '/login';
                        }}
                        className="text-sm text-text-muted hover:text-text-primary underline"
                    >
                        Torna al Login
                    </button>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-center h-screen bg-bg-primary">
                <div className="text-xl font-bold text-accent animate-pulse">
                    Caricamento in corso...
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user) {
        // Case-insensitive role check
        if (allowedRoles) {
            const normalizedUserRole = (user.role || '').toLowerCase();
            const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

            if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
                return <Navigate to="/" replace />;
            }
        }

        // Additional custom check (e.g. permissions)
        if (additionalCheck && !additionalCheck(user)) {
            return <Navigate to="/" replace />;
        }
    }

    return <Outlet />;
};
