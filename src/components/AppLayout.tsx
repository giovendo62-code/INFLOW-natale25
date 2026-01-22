import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { TermsGuard } from './TermsGuard';

export const AppLayout: React.FC = () => {
    return (
        <div className="flex h-[100dvh] bg-bg-primary text-text-primary font-sans overflow-hidden overscroll-none">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 md:pt-0 h-full overflow-hidden relative">
                <div className="flex-1 flex flex-col min-h-0 relative overflow-y-auto pb-safe-offset-24 md:pb-0 overscroll-contain pt-16 md:pt-0">
                    <TermsGuard>
                        <Outlet />
                    </TermsGuard>
                </div>
            </main>
            <MobileNav />
        </div>
    );
};
