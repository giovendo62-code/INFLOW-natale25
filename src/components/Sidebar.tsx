import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import type { UserRole } from '../services/types';
import {
    LayoutDashboard,
    Calendar,
    Users,
    ClipboardList,
    DollarSign,
    GraduationCap,
    Settings,
    LogOut,
    Palette,
    Eye,
    EyeOff,
    Megaphone,
    QrCode,
    X,
    MessageCircle,
    FileSignature,
    Building,
    UserCog
} from 'lucide-react';
import clsx from 'clsx';
import { useLayoutStore } from '../stores/layoutStore';
import { api } from '../services/api';
import type { Studio } from '../services/types';

export interface NavItem {
    label: string;
    path: string;
    icon: React.ElementType;
    allowedRoles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
    // All roles have access to Dashboard
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST'] },
    // Specific Dashboard entry for Student to allow custom label logic in rendering
    { label: 'Dashboard Academy', path: '/', icon: LayoutDashboard, allowedRoles: ['STUDENT', 'student'] },

    // Owner-only items
    { label: 'Studio', path: '/settings?tab=studio', icon: Building, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER'] },
    { label: 'Team', path: '/team', icon: UserCog, allowedRoles: ['owner'] },

    // Operational items - Owner + Management + Artists (Demo aligned)
    { label: 'Calendario', path: '/calendar', icon: Calendar, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST'] },
    { label: 'Clienti', path: '/clients', icon: Users, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST'] },
    { label: 'Bacheca', path: '/communications', icon: MessageCircle, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST', 'artist'] },
    { label: 'Consensi', path: '/consents', icon: FileSignature, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST'] },

    // Management items - Owner + STUDIO_ADMIN + MANAGER (Artists excluded)
    { label: 'Artisti', path: '/artists', icon: Palette, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER'] },
    { label: 'Lista Attesa', path: '/waitlist', icon: ClipboardList, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER'] },
    { label: 'Marketing', path: '/marketing', icon: Megaphone, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER'] },

    // Finance - All except Student
    { label: 'Finanze', path: '/financials', icon: DollarSign, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST', 'artist'] },

    // Academy - Owner + STUDIO_ADMIN (Students removed as they see it in Dashboard)
    { label: 'Academy', path: '/academy', icon: GraduationCap, allowedRoles: ['owner', 'STUDIO_ADMIN'] },

    // Settings - All roles
    { label: 'Impostazioni', path: '/settings?tab=appearance', icon: Settings, allowedRoles: ['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST', 'STUDENT'] },
];



export const Sidebar = () => {
    const { user, signOut } = useAuth();
    const location = useLocation();
    const { isSidebarVisible, isPrivacyMode, togglePrivacyMode } = useLayoutStore();
    const [studio, setStudio] = React.useState<Studio | null>(null);

    const [isShareOpen, setIsShareOpen] = React.useState(false);
    const [unreadCount, setUnreadCount] = React.useState(0);

    React.useEffect(() => {
        const loadStudio = async () => {
            if (user?.studio_id) {
                try {
                    const s = await api.settings.getStudio(user.studio_id);
                    setStudio(s);

                    // Fetch communications for badge
                    const msgs = await api.communications.list(user.studio_id);
                    const lastVisit = localStorage.getItem('last_visit_communications');
                    const count = msgs.filter(m => !lastVisit || new Date(m.created_at) > new Date(lastVisit)).length;
                    setUnreadCount(count);
                } catch (e) { console.error(e); }
            }
        };
        loadStudio();
    }, [user?.studio_id, location.pathname]); // Reload on nav change to update badge

    // Update read status when visiting communications
    React.useEffect(() => {
        if (location.pathname === '/communications') {
            localStorage.setItem('last_visit_communications', new Date().toISOString());
            setUnreadCount(0);
        }
    }, [location.pathname]);

    if (!user) return null;
    // If hidden by global store (e.g. fullscreen calendar), return null
    if (!isSidebarVisible) return null;

    const filteredItems = NAV_ITEMS.filter(item => {
        // Handle case-insensitive role check
        const normalizedUserRole = user.role.toLowerCase();
        return item.allowedRoles.some(r => r.toLowerCase() === normalizedUserRole);
    });

    // Current App URL for sharing
    const appUrl = window.location.origin;

    return (
        <>
            <aside className="hidden md:flex flex-col w-64 h-screen bg-bg-secondary border-r border-border sticky top-0">
                <div className="p-6 flex flex-col items-center gap-3 border-b border-border/50 mb-2">
                    {studio?.logo_url ? (
                        <img
                            src={studio.logo_url}
                            alt={studio.name}
                            className="w-20 h-20 rounded-full object-cover border-2 border-accent shadow-lg"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
                            <span className="text-2xl font-bold text-accent">IF</span>
                        </div>
                    )}
                    <div className="text-center">
                        <h1 className="text-lg font-bold bg-gradient-to-r from-accent to-red-500 bg-clip-text text-transparent">
                            {studio?.name || 'InkFlow'}
                        </h1>
                        <p className="text-xs text-text-muted capitalize">
                            {user?.role === 'owner' ? 'Owner' : user?.role?.toLowerCase() || 'Member'}
                        </p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
                    {filteredItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/'} // Exact match for Dashboard
                            className={({ isActive }) => {
                                // Custom check for items with query params (like Owner Menu items)
                                const isQueryMatch = item.path.includes('?')
                                    ? location.search === '?' + item.path.split('?')[1]
                                    : true;

                                // For standard Settings link, exclude if we are in a specific tab
                                const isSettingsRoot = item.path === '/settings' && location.search !== '';

                                return clsx(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative',
                                    (isActive && isQueryMatch && !isSettingsRoot)
                                        ? 'bg-accent/10 text-accent font-medium'
                                        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                                );
                            }}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                            {item.label === 'Bacheca' && unreadCount > 0 && (
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 rounded-full border-2 border-bg-secondary flex items-center justify-center text-xs font-bold text-white leading-none">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-border">
                    {/* Hide Privacy Mode for Students as requested */}
                    {!(user.role?.toLowerCase() === 'student') && (
                        <button
                            onClick={togglePrivacyMode}
                            className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                        >
                            {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
                            <span>{isPrivacyMode ? 'Mostra Valori' : 'Privacy Mode'}</span>
                        </button>
                    )}

                    <button
                        onClick={() => setIsShareOpen(true)}
                        className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                    >
                        <QrCode size={18} />
                        <span>Condividi App</span>
                    </button>

                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <img
                            src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name}`}
                            alt={user.full_name}
                            className="w-8 h-8 rounded-full bg-bg-tertiary"
                        />
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-text-primary truncate">{user.full_name}</p>
                            <p className="text-xs text-text-muted truncate capitalize">
                                {user.role === 'owner' ? 'Owner' : user.role.replace('_', ' ').toLowerCase()}
                            </p>
                        </div>
                    </div >
                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div >
            </aside >

            {/* Full Screen Share Overlay */}
            {
                isShareOpen && (
                    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center relative shadow-2xl transform transition-all scale-100">
                            <button
                                onClick={() => setIsShareOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2"
                            >
                                <X size={24} />
                            </button>

                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Condividi InkFlow</h2>
                            <p className="text-gray-500 mb-6">Fai scansionare questo codice per accedere all'applicazione</p>

                            <div className="bg-gray-100 p-4 rounded-xl inline-block mb-6">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}`}
                                    alt="App QR Code"
                                    className="w-64 h-64 mix-blend-multiply"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <p className="text-xs text-gray-400 break-all bg-gray-50 p-2 rounded">{appUrl}</p>
                                <button
                                    onClick={() => setIsShareOpen(false)}
                                    className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-colors"
                                >
                                    Chiudi
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
};
