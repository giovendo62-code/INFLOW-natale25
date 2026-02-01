import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { User, Building, FileText, Palette, Moon, Sun, Link, Save, QrCode, Printer, Info } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';
import { useLayoutStore } from '../../stores/layoutStore';
import { ProfileSettings } from './components/ProfileSettings';
import { TeamSettings } from './components/TeamSettings';
import { StudioSettings } from './components/StudioSettings';
import { ArtistContractSettings } from './components/ArtistContractSettings';
import { IntegrationsTab } from '../artists/components/IntegrationsTab';
import { useLocation } from 'react-router-dom';

// ... (inside the component)



// ...



export const SettingsPage: React.FC = () => {
    const { user, refreshProfile } = useAuth();
    const { theme, setTheme, accentColor, setAccentColor } = useLayoutStore();
    const location = useLocation();

    // Parse query param ?tab=...
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') || 'profile';

    const [activeTab, setActiveTab] = useState(initialTab);

    // Update activeTab if URL changes
    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        const googleSuccess = params.get('google_sync_success');

        if (googleSuccess === 'true') {
            setActiveTab('integrations');
        } else if (tab) {
            setActiveTab(tab);
        }
    }, [location.search]);

    const isStudent = (user?.role || '').toLowerCase() === 'student';

    const normalizedRole = (user?.role || '').toLowerCase();

    const tabs = [
        { id: 'profile', label: isStudent ? 'Scheda Studente' : 'Profilo', icon: User },
        // Show Team Management removed as requested (present in sidebar)
        // ...(['owner', 'studio_admin', 'manager'].includes(normalizedRole) ? [{ id: 'team', label: 'Gestione Team', icon: Users }] : []),
        // Show Studio Info for OWNER, STUDIO_ADMIN
        ...(['owner', 'studio_admin'].includes(normalizedRole) ? [{ id: 'studio', label: 'Info Studio', icon: Building }] : []),
        ...(['owner', 'studio_admin', 'manager'].includes(normalizedRole) ? [{ id: 'checkin-qr', label: 'Check-in QR', icon: QrCode }] : []),
        // Show Contract for ARTIST
        ...(['artist'].includes(normalizedRole) ? [{ id: 'contract', label: 'Il Mio Contratto', icon: FileText }] : []),
        ...(['owner'].includes(normalizedRole) ? [{ id: 'integrations', label: 'Integrazioni', icon: Link }] : []),
        { id: 'appearance', label: 'Aspetto', icon: Palette },
    ];

    // Split tabs into contexts
    const studioGroup = ['studio', 'team'];
    const isStudioContext = studioGroup.includes(activeTab);

    const handleUpdate = React.useCallback(async () => {
        // Avoid full reload, just refresh profile to get new integration status
        await refreshProfile();
        // Also ensure URL is clean if not already
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', newUrl);
    }, [refreshProfile]);

    const visibleTabs = tabs.filter(t => {
        if (isStudioContext) return studioGroup.includes(t.id);
        return !studioGroup.includes(t.id); // Show settings/appearance tabs
    });

    return (
        <div className="w-full p-4 md:p-8 flex flex-col xl:flex-row gap-8">
            {/* Sidebar Tabs */}
            <div className="w-full xl:w-64 flex-shrink-0">
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
                {activeTab === 'integrations' && user && <IntegrationsTab artist={user} onUpdate={handleUpdate} />}
                {activeTab === 'checkin-qr' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-text-primary">QR Code Presenze</h2>
                            <button
                                onClick={() => window.print()}
                                className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg font-medium transition-colors flex items-center gap-2 border border-border"
                            >
                                <Printer size={18} />
                                Stampa
                            </button>
                        </div>

                        <div className="bg-white p-8 rounded-xl border border-border flex flex-col items-center text-center shadow-sm max-w-md mx-auto">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Check-in Giornaliero</h3>
                            <p className="text-sm text-gray-500 mb-8">Scansiona questo codice per registrare la tua presenza.</p>

                            <div className="p-4 bg-white border-2 border-gray-100 rounded-xl">
                                <QRCode
                                    value={`${window.location.origin}/checkin`}
                                    size={256}
                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                    viewBox={`0 0 256 256`}
                                />
                            </div>

                            <p className="mt-8 text-xs text-gray-400 font-mono">
                                {window.location.origin}/checkin
                            </p>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex gap-3 text-blue-700 text-sm">
                            <Info size={20} className="flex-shrink-0" />
                            <p>
                                Stampa questa pagina e appendi il QR Code all'ingresso dello studio.
                                Gli Artisti e gli Studenti potranno scansionarlo per accedere rapidamente alla pagina di check-in.
                            </p>
                        </div>
                    </div>
                )}

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

                        {/* Accent Color Selection */}
                        <div className="bg-bg-secondary p-6 rounded-xl border border-border">
                            <h3 className="text-lg font-semibold text-text-primary mb-4">Colore Principale</h3>
                            <div className="space-y-6">
                                {/* Presets */}
                                <div>
                                    <label className="text-sm text-text-secondary mb-3 block">Colori Predefiniti</label>
                                    <div className="flex flex-wrap gap-3">
                                        {[
                                            { color: '#FF6B35', name: 'Inkflow Orange' },
                                            { color: '#3B82F6', name: 'Blue' },
                                            { color: '#8B5CF6', name: 'Purple' },
                                            { color: '#10B981', name: 'Green' },
                                            { color: '#EC4899', name: 'Pink' },
                                            { color: '#EF4444', name: 'Red' },
                                        ].map((preset) => (
                                            <button
                                                key={preset.color}
                                                onClick={() => setAccentColor(preset.color)}
                                                className={clsx(
                                                    "w-10 h-10 rounded-full border-2 transition-all hover:scale-110",
                                                    accentColor === preset.color
                                                        ? "border-text-primary shadow-lg scale-110"
                                                        : "border-transparent"
                                                )}
                                                style={{ backgroundColor: preset.color }}
                                                title={preset.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Color */}
                                <div>
                                    <label className="text-sm text-text-secondary mb-3 block">Colore Personalizzato</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border cursor-pointer">
                                            <input
                                                type="color"
                                                value={accentColor}
                                                onChange={(e) => setAccentColor(e.target.value)}
                                                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={accentColor}
                                                onChange={(e) => setAccentColor(e.target.value)}
                                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary font-mono uppercase"
                                                maxLength={7}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-text-muted mt-2">
                                        Il colore selezionato verrà applicato a pulsanti, link e indicatori.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={() => alert('Preferenze salvate con successo!')} // Persistence is automatic, just visual feedback
                                className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors shadow-lg shadow-accent/20 flex items-center gap-2"
                            >
                                <Save size={18} />
                                Salva Preferenze
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
