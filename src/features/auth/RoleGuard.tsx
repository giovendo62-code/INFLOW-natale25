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

    if (isLoading) {
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
