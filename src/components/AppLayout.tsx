import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export const AppLayout: React.FC = () => {
    return (
        <div className="flex h-screen bg-bg-primary text-text-primary font-sans overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 mb-16 md:mb-0 h-full overflow-hidden">
                <div className="flex-1 flex flex-col min-h-0 relative overflow-y-auto">
                    <Outlet />
                </div>
            </main>
            <MobileNav />
        </div>
    );
};
