
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { RoleGuard } from './features/auth/RoleGuard';
import { AppLayout } from './components/AppLayout';
import { StudioGuard } from './features/auth/StudioGuard';
import { useLayoutStore } from './stores/layoutStore';

// Eager imports for auth and critical initial pages to avoid flickering on first load if possible
// However, to reduce bundle size, we can lazy load these too if the landing page is simple.
// Let's keep Login eager as it's the entry point often.
import { LoginPage } from './features/auth/LoginPage';

// Lazy Loaded Components
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const UpdatePasswordPage = lazy(() => import('./features/auth/UpdatePasswordPage').then(m => ({ default: m.UpdatePasswordPage })));
const RegisterStudioPage = lazy(() => import('./pages/RegisterStudioPage').then(m => ({ default: m.RegisterStudioPage })));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })));
const DebugSupabase = lazy(() => import('./pages/DebugSupabase').then(m => ({ default: m.DebugSupabase })));

// Features
const DashboardPage = lazy(() => import('./features/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const CalendarPage = lazy(() => import('./features/calendar/Calendar').then(m => ({ default: m.Calendar })));
const ClientsPage = lazy(() => import('./features/clients/ClientsList').then(m => ({ default: m.ClientsList })));
const ClientProfilePage = lazy(() => import('./features/clients/ClientProfile').then(m => ({ default: m.ClientProfile })));
const FinancialsPage = lazy(() => import('./features/finance/FinancialsPage').then(m => ({ default: m.FinancialsPage })));
const AcademyPage = lazy(() => import('./features/academy/AcademyPage').then(m => ({ default: m.AcademyPage })));
const ConsentsPage = lazy(() => import('./features/consents/ConsentsPage').then(m => ({ default: m.ConsentsPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ArtistsPage = lazy(() => import('./features/artists/ArtistsPage').then(m => ({ default: m.ArtistsPage })));
const ArtistProfilePage = lazy(() => import('./features/artists/ArtistProfilePage').then(m => ({ default: m.ArtistProfilePage })));
const MarketingPage = lazy(() => import('./features/marketing/MarketingPage').then(m => ({ default: m.MarketingPage })));
const WaitlistManager = lazy(() => import('./features/waitlist/WaitlistManager').then(m => ({ default: m.WaitlistManager })));
const CommunicationsPage = lazy(() => import('./features/communications/CommunicationsPage').then(m => ({ default: m.CommunicationsPage })));
const TeamPage = lazy(() => import('./features/team/TeamPage').then(m => ({ default: m.TeamPage })));

// Public Forms
const WaitlistForm = lazy(() => import('./features/waitlist/WaitlistForm').then(m => ({ default: m.WaitlistForm })));
const PublicClientForm = lazy(() => import('./features/clients/PublicClientForm').then(m => ({ default: m.PublicClientForm })));

// Components that were placeholders or simple
const ChatPage = () => (
    <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Chat</h2>
        <div className="p-8 border border-dashed border-border rounded-lg bg-bg-secondary text-text-muted flex items-center justify-center">
            Feature coming soon...
        </div>
    </div>
);

// Loading Spinner for Suspense Fallback
const LoadingSpinner = () => (
    <div className="flex h-screen w-full items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
            <p className="text-text-muted animate-pulse font-medium">Caricamento...</p>
        </div>
    </div>
);

function App() {
    // Global Theme Effect
    const { theme, accentColor } = useLayoutStore();

    React.useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }

        // Apply Accent Color
        if (accentColor) {
            document.documentElement.style.setProperty('--color-accent', accentColor);
            document.documentElement.style.setProperty('--color-accent-hover', accentColor);
        }
    }, [theme, accentColor]);

    return (
        <AuthProvider>
            <BrowserRouter>
                <Suspense fallback={<LoadingSpinner />}>
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
                </Suspense>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
