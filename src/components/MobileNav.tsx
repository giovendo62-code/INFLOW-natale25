import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Menu, X, LogOut, Users, MessageCircle, ClipboardList } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../features/auth/AuthContext';
import { NAV_ITEMS } from './Sidebar';
import { api } from '../services/api';
import type { Studio } from '../services/types';

export const MobileNav: React.FC = () => {
    const { user, signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [studio, setStudio] = useState<Studio | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const location = useLocation();

    if (!user) return null;

    useEffect(() => {
        const loadData = async () => {
            if (user.studio_id) {
                try {
                    const studioData = await api.settings.getStudio(user.studio_id);
                    setStudio(studioData);

                    // Fetch communications for badge
                    const msgs = await api.communications.list(user.studio_id);
                    const lastVisit = localStorage.getItem('last_visit_communications');
                    // Simple logic: count messages created after last visit
                    // If no last visit, show all as unread (or max 9+ logic for UI, but here we count real number)
                    const count = msgs.filter(m => !lastVisit || new Date(m.created_at) > new Date(lastVisit)).length;
                    setUnreadCount(count);
                } catch (e) {
                    console.error('Error loading mobile nav data', e);
                }
            }
        };
        loadData();
    }, [user.studio_id, location.pathname]); // Reload on nav change to update badge

    // Update read status when visiting communications
    useEffect(() => {
        if (location.pathname === '/communications') {
            localStorage.setItem('last_visit_communications', new Date().toISOString());
            setUnreadCount(0);
        }
    }, [location.pathname]);

    // Body Scroll Lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Also crucial for iOS to prevent body scroll
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        } else {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, [isOpen]);

    // Role Logic & Sorting
    const filteredItems = NAV_ITEMS.filter(item => item.allowedRoles.includes(user.role));

    const sortedItems = [...filteredItems]
        .filter(item => !['Calendario', 'Lista Attesa', 'Clienti', 'Bacheca'].includes(item.label))
        .sort((a, b) => {
            // "Clienti" and "Bacheca" at the bottom for Owner/Manager/Artist
            // Since they are removed, this sort might be redundant but harmless // keeping for safety if logic changes
            const bottomItems = ['Clienti', 'Bacheca'];
            const aIsBottom = bottomItems.includes(a.label);
            const bIsBottom = bottomItems.includes(b.label);

            if (aIsBottom && !bIsBottom) return 1;
            if (!aIsBottom && bIsBottom) return -1;
            return 0; // Keep original order otherwise
        });

    const toggleMenu = () => setIsOpen(!isOpen);
    const closeMenu = () => setIsOpen(false);

    return (
        <>
            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-bg-secondary border-b border-border z-30 flex items-center justify-center px-4 shadow-sm">
                <div className="flex items-center justify-center gap-3 w-full">
                    {studio?.logo_url ? (
                        <img
                            src={studio.logo_url}
                            alt={studio.name}
                            onClick={() => window.location.href = '/'}
                            className="h-10 w-10 rounded-full object-cover border-2 border-accent shadow-sm cursor-pointer"
                        />
                    ) : (
                        <div
                            onClick={() => window.location.href = '/'}
                            className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs shadow-lg cursor-pointer border-2 border-bg-primary"
                        >
                            {studio?.name?.substring(0, 2).toUpperCase() || 'IF'}
                        </div>
                    )}
                    <span className="font-bold text-lg text-text-primary truncate max-w-[200px]">
                        {studio?.name || 'InkFlow'}
                    </span>
                </div>
            </div>

            {/* Bottom Navigation Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border z-40 pb-safe safe-area-bottom shadow-t-lg">
                <div className="flex justify-between items-center h-16 w-full px-1">
                    <NavLink
                        to="/"
                        onClick={closeMenu}
                        className={({ isActive }) => clsx(
                            "flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors flex-1 min-w-0",
                            isActive ? "text-accent" : "text-text-muted hover:text-text-primary"
                        )}
                    >
                        <LayoutDashboard size={22} />
                        <span className="text-[10px] font-medium truncate w-full text-center">Home</span>
                    </NavLink>

                    {/* Calendar - Owner + Management + Artists */}
                    {['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST'].includes(user.role) && (
                        <NavLink
                            to="/calendar"
                            onClick={closeMenu}
                            className={({ isActive }) => clsx(
                                "flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors flex-1 min-w-0",
                                isActive ? "text-accent" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <Calendar size={22} />
                            <span className="text-[10px] font-medium truncate w-full text-center">Calendario</span>
                        </NavLink>
                    )}

                    {/* Waitlist for Owner + Management */}
                    {['owner', 'STUDIO_ADMIN', 'MANAGER'].includes(user.role) && (
                        <NavLink
                            to="/waitlist"
                            onClick={closeMenu}
                            className={({ isActive }) => clsx(
                                "flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors flex-1 min-w-0",
                                isActive ? "text-accent" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <ClipboardList size={22} />
                            <span className="text-[10px] font-medium truncate w-full text-center">Attesa</span>
                        </NavLink>
                    )}

                    {/* Clienti & Bacheca for Owner + Management + Artists */}
                    {['owner', 'STUDIO_ADMIN', 'MANAGER', 'ARTIST'].includes(user.role) && (
                        <>
                            <NavLink
                                to="/clients"
                                onClick={closeMenu}
                                className={({ isActive }) => clsx(
                                    "flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors flex-1 min-w-0",
                                    isActive ? "text-accent" : "text-text-muted hover:text-text-primary"
                                )}
                            >
                                <Users size={22} />
                                <span className="text-[10px] font-medium truncate w-full text-center">Clienti</span>
                            </NavLink>

                            <NavLink
                                to="/communications"
                                onClick={closeMenu}
                                className={({ isActive }) => clsx(
                                    "flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors flex-1 min-w-0",
                                    isActive ? "text-accent" : "text-text-muted hover:text-text-primary"
                                )}
                            >
                                <div className="relative">
                                    <MessageCircle size={22} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-bg-secondary flex items-center justify-center text-[9px] font-bold text-white leading-none">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-medium truncate w-full text-center">Bacheca</span>
                            </NavLink>
                        </>
                    )}

                    <button
                        onClick={toggleMenu}
                        className={clsx(
                            "flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-lg transition-colors flex-1 min-w-0",
                            isOpen ? "text-accent" : "text-text-muted hover:text-text-primary"
                        )}
                    >
                        {isOpen ? <X size={22} /> : (
                            <div className="relative">
                                <Menu size={22} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg-secondary" />
                                )}
                            </div>
                        )}
                        <span className="text-[10px] font-medium truncate w-full text-center">{isOpen ? 'Chiudi' : 'Menu'}</span>
                    </button>
                </div>
            </nav>

            {/* Mobile Navigation Drawer Overlay */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={closeMenu}
                    />

                    {/* Side Drawer */}
                    <div
                        className="fixed inset-y-0 right-0 z-[60] w-3/4 max-w-xs bg-bg-secondary shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-border/50"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="flex-none p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] border-b border-border flex justify-between items-center bg-bg-tertiary/20">
                            <div>
                                <h2 className="text-xl font-bold text-text-primary">Menu</h2>
                                <p className="text-xs text-text-muted">
                                    {user.role === 'STUDENT' ? 'Area Studente' : 'Gestione Studio'}
                                </p>
                            </div>
                            <button
                                onClick={closeMenu}
                                className="p-2 bg-white/5 rounded-full text-text-muted hover:text-text-primary transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Navigation Links - Scrollable Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide overscroll-contain">
                            {sortedItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={closeMenu}
                                    className={({ isActive }) => clsx(
                                        'flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 relative',
                                        isActive
                                            ? 'bg-accent/10 text-accent font-medium border border-accent/20'
                                            : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                                    )}
                                >
                                    <item.icon size={22} />
                                    <span className="text-base">{item.label}</span>
                                    {item.label === 'Bacheca' && unreadCount > 0 && (
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                            {unreadCount}
                                        </span>
                                    )}
                                </NavLink>
                            ))}
                        </div>

                        {/* Footer Actions - Sticky Bottom */}
                        <div className="flex-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-border bg-bg-tertiary/10 space-y-2">
                            <div className="flex items-center gap-3 px-4 py-3 mb-2">
                                <img
                                    src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.full_name}`}
                                    alt={user.full_name}
                                    className="w-10 h-10 rounded-full bg-bg-tertiary"
                                />
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium text-text-primary truncate">{user.full_name}</p>
                                    <p className="text-xs text-text-muted capitalize truncate">{user.role.replace('_', ' ').toLowerCase()}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    signOut();
                                    closeMenu();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors"
                            >
                                <LogOut size={20} />
                                <span>Disconnetti</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};
