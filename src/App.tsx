// import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { RoleGuard } from './features/auth/RoleGuard';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { UpdatePasswordPage } from './features/auth/UpdatePasswordPage';
import {
    DashboardPage,
    CalendarPage,
    ClientsPage,
    ClientProfilePage,
    FinancialsPage,
    AcademyPage,
    ChatPage,
    SettingsPage,
    ConsentsPage
} from './components/Placeholders';
import { ArtistsPage } from './features/artists/ArtistsPage';
import { ArtistProfilePage } from './features/artists/ArtistProfilePage';
import { MarketingPage } from './features/marketing/MarketingPage';
import { WaitlistManager } from './features/waitlist/WaitlistManager';
import { CommunicationsPage } from './features/communications/CommunicationsPage';
import { WaitlistForm } from './features/waitlist/WaitlistForm';
import { PublicClientForm } from './features/clients/PublicClientForm';
import { DebugSupabase } from './pages/DebugSupabase';
import { RegisterStudioPage } from './pages/RegisterStudioPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { StudioGuard } from './features/auth/StudioGuard';
import { TeamPage } from './features/team/TeamPage';

import React from 'react';
import { useLayoutStore } from './stores/layoutStore';

function App() {
    // Global Theme Effect
    const { theme } = useLayoutStore();

    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
    }, [theme]);

    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/debug-supabase" element={<DebugSupabase />} />


                    {/* Public Routes */}
                    <Route path="/public/waitlist/:studioId" element={<WaitlistForm />} />
                    <Route path="/public/register/:studioId" element={<PublicClientForm />} />

                    {/* Invitation Acceptance */}
                    <Route path="/accept-invite" element={<AcceptInvitePage />} />

                    {/* Password Recovery */}
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/update-password" element={<UpdatePasswordPage />} />

                    <Route element={<RoleGuard />}>
                        {/* Routes that require Login but NOT Studio yet */}
                        <Route path="/register-studio" element={<RegisterStudioPage />} />

                        {/* Routes that require Login AND Studio Membership */}
                        <Route element={<StudioGuard />}>
                            <Route element={<AppLayout />}>
                                <Route path="/" element={<DashboardPage />} />
                                <Route path="/dashboard" element={<DashboardPage />} />

                                {/* Financials (Owner, Admin, Manager, Artist) */}
                                <Route element={<RoleGuard allowedRoles={['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST', 'artist']} />}>
                                    <Route path="/financials" element={<FinancialsPage />} />
                                </Route>

                                {/* Calendar, Consents, Chat, Comms (Owner + Management + Artists) */}
                                <Route element={<RoleGuard allowedRoles={['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST', 'artist']} />}>
                                    <Route path="/calendar" element={<CalendarPage />} />
                                    <Route path="/consents" element={<ConsentsPage />} />
                                    <Route path="/chat" element={<ChatPage />} />
                                    <Route path="/communications" element={<CommunicationsPage />} />
                                </Route>

                                {/* Clients - Protected by Role AND Permission */}
                                <Route element={<RoleGuard
                                    allowedRoles={['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST', 'artist']}
                                    additionalCheck={(user) => {
                                        if ((user.role || '').toLowerCase() === 'artist') {
                                            return user.permissions?.can_view_clients ?? true;
                                        }
                                        return true;
                                    }}
                                />}>
                                    <Route path="/clients" element={<ClientsPage />} />
                                    <Route path="/clients/:id" element={<ClientProfilePage />} />
                                </Route>

                                {/* Artists (Owner, Admin, Manager) */}
                                <Route element={<RoleGuard allowedRoles={['owner', 'STUDIO_ADMIN', 'MANAGER']} />}>
                                    <Route path="/artists" element={<ArtistsPage />} />
                                    <Route path="/artists/:id" element={<ArtistProfilePage />} />
                                </Route>

                                {/* Settings (All Roles) */}
                                <Route element={<RoleGuard allowedRoles={['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST', 'STUDENT']} />}>
                                    <Route path="/settings" element={<SettingsPage />} />
                                </Route>

                                <Route element={<RoleGuard allowedRoles={['owner']} />}>
                                    <Route path="/team" element={<TeamPage />} />
                                </Route>

                                {/* Waitlist, Marketing (Owner + Management) */}
                                <Route element={<RoleGuard allowedRoles={['owner', 'STUDIO_ADMIN', 'MANAGER']} />}>
                                    <Route path="/waitlist" element={<WaitlistManager />} />
                                    <Route path="/marketing" element={<MarketingPage />} />
                                </Route>

                                {/* Academy (Owner, Admin, Student) */}
                                <Route element={<RoleGuard allowedRoles={['owner', 'STUDIO_ADMIN', 'STUDENT']} />}>
                                    <Route path="/academy" element={<AcademyPage />} />
                                </Route>

                            </Route>
                        </Route>
                    </Route>

                    {/* Catch all - Redirect to Dashboard if logged in, else Login */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
