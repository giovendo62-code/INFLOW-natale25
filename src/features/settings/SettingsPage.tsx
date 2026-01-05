import React, { useState } from 'react';
import { User, Building, FileText, Palette, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';
import { useLayoutStore } from '../../stores/layoutStore';
import { ProfileSettings } from './components/ProfileSettings';
import { TeamSettings } from './components/TeamSettings';
import { StudioSettings } from './components/StudioSettings';
import { ArtistContractSettings } from './components/ArtistContractSettings';

import { useLocation } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { theme, setTheme } = useLayoutStore();
    const location = useLocation();

    // Parse query param ?tab=...
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') || 'profile';

    const [activeTab, setActiveTab] = useState(initialTab);

    // Update activeTab if URL changes
    React.useEffect(() => {
        const tab = new URLSearchParams(location.search).get('tab');
        if (tab) setActiveTab(tab);
    }, [location.search]);

    const isStudent = user?.role?.toLowerCase() === 'student';

    const normalizedRole = user?.role?.toLowerCase() || '';

    const tabs = [
        { id: 'profile', label: isStudent ? 'Scheda Studente' : 'Profilo', icon: User },
        // Show Team Management removed as requested (present in sidebar)
        // ...(['owner', 'studio_admin', 'manager'].includes(normalizedRole) ? [{ id: 'team', label: 'Gestione Team', icon: Users }] : []),
        // Show Studio Info for OWNER, STUDIO_ADMIN
        ...(['owner', 'studio_admin'].includes(normalizedRole) ? [{ id: 'studio', label: 'Info Studio', icon: Building }] : []),
        // Show Contract for ARTIST
        ...(['artist'].includes(normalizedRole) ? [{ id: 'contract', label: 'Il Mio Contratto', icon: FileText }] : []),
        { id: 'appearance', label: 'Aspetto', icon: Palette },
    ];

    // Split tabs into contexts
    const studioGroup = ['studio', 'contract', 'team'];
    const isStudioContext = studioGroup.includes(activeTab);

    const visibleTabs = tabs.filter(t => {
        if (isStudioContext) return studioGroup.includes(t.id);
        return !studioGroup.includes(t.id); // Show settings/appearance tabs
    });

    return (
        <div className="w-full p-4 md:p-8 flex flex-col md:flex-row gap-8">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 flex-shrink-0">
                <h1 className="text-2xl font-bold text-text-primary mb-6">
                    {isStudioContext ? 'Studio' : 'Impostazioni'}
                </h1>
                <nav className="space-y-2">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left",
                                activeTab === tab.id
                                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                                    : "text-text-muted hover:text-text-primary hover:bg-bg-secondary"
                            )}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-[500px]">
                {activeTab === 'profile' && <ProfileSettings />}
                {activeTab === 'team' && <TeamSettings />}
                {activeTab === 'studio' && <StudioSettings />}
                {activeTab === 'contract' && <ArtistContractSettings />}

                {activeTab === 'appearance' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-text-primary mb-6">Aspetto e Tema</h2>
                        <div className="bg-bg-secondary p-6 rounded-xl border border-border">
                            <h3 className="text-lg font-semibold text-text-primary mb-4">Modalità Visualizzazione</h3>
                            <div className="grid grid-cols-2 gap-4 max-w-md">
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={clsx(
                                        "p-4 rounded-xl border flex flex-col items-center gap-3 transition-all",
                                        theme === 'dark'
                                            ? "bg-accent/10 border-accent text-accent"
                                            : "bg-bg-tertiary border-transparent text-text-muted hover:bg-bg-primary"
                                    )}
                                >
                                    <Moon size={24} />
                                    <span className="font-medium">Dark Mode</span>
                                </button>
                                <button
                                    onClick={() => setTheme('light')}
                                    className={clsx(
                                        "p-4 rounded-xl border flex flex-col items-center gap-3 transition-all",
                                        theme === 'light'
                                            ? "bg-accent/10 border-accent text-accent"
                                            : "bg-bg-tertiary border-transparent text-text-muted hover:bg-bg-primary"
                                    )}
                                >
                                    <Sun size={24} />
                                    <span className="font-medium">Light Mode</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
