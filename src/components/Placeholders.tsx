// import React from 'react';

const PagePlaceholder = ({ title }: { title: string }) => (
    <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">{title}</h2>
        <div className="p-8 border border-dashed border-border rounded-lg bg-bg-secondary text-text-muted flex items-center justify-center">
            Feature coming soon...
        </div>
    </div>
);

export { Dashboard as DashboardPage } from '../features/dashboard/Dashboard';
export { Calendar as CalendarPage } from '../features/calendar/Calendar';
export { ClientsList as ClientsPage } from '../features/clients/ClientsList';
export { ClientProfile as ClientProfilePage } from '../features/clients/ClientProfile';
// export const WaitlistPage = () => <PagePlaceholder title="Waitlist" />;
export { FinancialsPage } from '../features/finance/FinancialsPage';
export { AcademyPage } from '../features/academy/AcademyPage';
export { ConsentsPage } from '../features/consents/ConsentsPage';
export const ChatPage = () => <PagePlaceholder title="Chat" />;
export { SettingsPage } from '../features/settings/SettingsPage';
