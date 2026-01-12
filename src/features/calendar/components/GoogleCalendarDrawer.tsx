import React, { useState } from 'react';
import { X, Check, Globe, RefreshCw, Calendar as CalendarIcon, Sliders } from 'lucide-react';
import clsx from 'clsx';
import type { User } from '../../../services/types';
import { useAuth } from '../../auth/AuthContext';
import { useEffect } from 'react';

import { api } from '../../../services/api';

interface GoogleCalendarDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    artists: User[];
}

export const GoogleCalendarDrawer: React.FC<GoogleCalendarDrawerProps> = ({ isOpen, onClose, artists }) => {
    const { user, refreshProfile } = useAuth(); // Import refreshProfile
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(false);

    // Initial check for success param
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('google_sync_success') === 'true') {
            setIsConnected(true);
            // Clean URL
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    // Sync local state with user profile state
    useEffect(() => {
        if (user?.integrations?.google_calendar) {
            setIsConnected(!!user.integrations.google_calendar.is_connected);
        }
    }, [user]);

    const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);
    const [calendarMapping, setCalendarMapping] = useState<Record<string, string>>({});
    const [twoWaySync, setTwoWaySync] = useState(false);

    // Fetch calendars when connected
    useEffect(() => {
        // Only fetch if genuinely connected and we have a user
        if (isConnected && user?.id) {
            let mounted = true;
            async function fetchCalendars() {
                try {
                    const calendars = await api.googleCalendar.listCalendars(user!.id);
                    if (mounted) {
                        setAvailableCalendars(calendars);
                        // Initialize settings from user profile
                        if (user?.integrations?.google_calendar) {
                            const savedMapping = user.integrations.google_calendar.calendar_mapping || {};
                            const savedTwoWay = user.integrations.google_calendar.two_way_sync || false;
                            setCalendarMapping(savedMapping);
                            setTwoWaySync(savedTwoWay);
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch calendars", err);
                }
            }
            fetchCalendars();
            return () => { mounted = false; };
        } else {
            // Reset if disconnected
            setAvailableCalendars([]);
        }
    }, [isConnected, user]);

    const handleConnect = () => {
        setLoading(true);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const loginUrl = `${supabaseUrl}/functions/v1/google-auth/login?user_id=${user?.id}&redirect_to=${encodeURIComponent(window.location.href)}`;
        window.location.href = loginUrl;
    };

    const handleDisconnect = async () => {
        if (!user?.id) return;
        if (confirm('Disconnettere Google Calendar? La sincronizzazione verrà interrotta.')) {
            setLoading(true);
            try {
                await api.googleCalendar.disconnect(user.id);
                // Force local update first to update UI immediately
                setIsConnected(false);
                setAvailableCalendars([]);
                setCalendarMapping({});

                // Refresh profile to ensure context is in sync
                await refreshProfile();

                alert("Disconnessione avvenuta con successo.");
            } catch (error) {
                console.error("Disconnect failed:", error);
                alert("Errore durante la disconnessione. Riprova.");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            await api.googleCalendar.updateSettings(user!.id, {
                calendar_mapping: calendarMapping,
                two_way_sync: twoWaySync
            });

            // Trigger initial sync
            await api.googleCalendar.syncEvents(user!.id);

            alert("Configurazione salvata e sincronizzazione avviata!");
            onClose();
        } catch (err) {
            console.error("Failed to save settings", err);
            alert("Errore nel salvataggio delle impostazioni o durante la sincronizzazione");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-bg-secondary h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-border">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Globe className="text-blue-500" /> Google Calendar
                        </h2>
                        <button type="button" onClick={onClose} className="text-text-muted hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {!isConnected ? (
                        <div className="space-y-6 text-center py-12">
                            <div className="bg-bg-tertiary p-8 rounded-full w-32 h-32 mx-auto flex items-center justify-center mb-4">
                                <CalendarIcon size={48} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">Connetti il tuo Calendario</h3>
                                <p className="text-text-muted mb-6">Sincronizza gli appuntamenti dello studio con Google Calendar in tempo reale.</p>

                                <button
                                    onClick={handleConnect}
                                    disabled={loading}
                                    type="button"
                                    className="bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 w-full transition-colors"
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={20} /> Connessione in corso...
                                        </>
                                    ) : (
                                        <>
                                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                                            Accedi con Google
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-text-muted">Verrai reindirizzato alla pagina di login sicuro di Google.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Connected Status */}
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                                        <Check size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white">Connesso</p>
                                        <p className="text-xs text-text-muted">{user?.integrations?.google_calendar?.email || 'Email non disponibile'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <button
                                        onClick={handleDisconnect}
                                        type="button"
                                        className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                    >
                                        Disconnetti
                                    </button>
                                </div>
                            </div>

                            {/* Manual Sync */}
                            <div className="bg-bg-tertiary rounded-lg p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-white font-medium flex items-center gap-2">
                                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                        Sincronizzazione Manuale
                                    </p>
                                    <p className="text-xs text-text-muted">Importa eventi da Google Calendar ora</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (loading) return;
                                        setLoading(true);
                                        try {
                                            const res = await api.googleCalendar.syncEvents(user!.id);
                                            console.log("Sync Logs:", res.logs);
                                            if (res.logs && res.logs.length > 0) {
                                                alert("Sincronizzazione completata!\n\nDettagli:\n" + res.logs.join('\n'));
                                            } else {
                                                alert("Sincronizzazione completata! " + res.synced_events_count + " eventi elaborati.");
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            alert("Errore durante la sincronizzazione");
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    disabled={loading}
                                    type="button"
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    Sincronizza Ora
                                </button>
                            </div>

                            {/* Sync Settings */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                                    <Sliders size={16} /> Impostazioni Sincronizzazione
                                </h3>

                                <div className="bg-bg-tertiary rounded-lg p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-white font-medium">Sincronizzazione Bidirezionale</p>
                                        <p className="text-xs text-text-muted">Sincronizza modifiche da Google Calendar verso InkFlow</p>
                                    </div>
                                    <button
                                        onClick={() => setTwoWaySync(!twoWaySync)}
                                        type="button"
                                        className={clsx(
                                            "w-12 h-6 rounded-full transition-colors relative",
                                            twoWaySync ? "bg-accent" : "bg-gray-600"
                                        )}
                                    >
                                        <div className={clsx(
                                            "w-4 h-4 rounded-full bg-white absolute top-1 transition-transform",
                                            twoWaySync ? "left-7" : "left-1"
                                        )} />
                                    </button>
                                </div>
                            </div>

                            {/* Artist Selection */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                                    <CalendarIcon size={16} /> Mappatura Calendari
                                </h3>
                                <p className="text-xs text-text-muted">Associa un calendario Google a ciascun artista.</p>

                                <div className="space-y-3">
                                    {artists.map(artist => (
                                        <div key={artist.id} className="bg-bg-tertiary p-3 rounded-lg border border-border">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-xs font-bold text-white">
                                                    {(artist.full_name || '?').charAt(0)}
                                                </div>
                                                <span className="text-sm font-medium text-white">{artist.full_name || 'Artista senza nome'}</span>
                                            </div>

                                            <select
                                                className="w-full bg-bg-primary text-white text-sm rounded border border-border p-2"
                                                value={calendarMapping[artist.id] || ''}
                                                onChange={(e) => setCalendarMapping({ ...calendarMapping, [artist.id]: e.target.value })}
                                            >
                                                <option value="">Nessun Calendario</option>
                                                {availableCalendars.map((cal: any) => (
                                                    <option key={cal.id} value={cal.id}>
                                                        {cal.summary} {cal.primary ? '(Principale)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {isConnected && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-bg-secondary">
                        <button
                            onClick={handleSave}
                            type="button"
                            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            Salva Configurazione
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
