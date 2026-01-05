
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const StudioGuard: React.FC = () => {
    const { isAuthenticated, isLoading, hasStudio } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-bg-primary">
                <div className="text-xl font-bold text-accent animate-pulse">
                    Verifying membership...
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // If hasStudio is false (checked and confirmed no), redirect to register-studio
    if (hasStudio === false) {
        return <Navigate to="/register-studio" replace />;
    }

    // If hasStudio is true or still null (shouldn't be null if not loading), allow access
    return <Outlet />;
};
