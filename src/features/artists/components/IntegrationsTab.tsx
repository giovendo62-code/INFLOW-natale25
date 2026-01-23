import React, { useState } from 'react';
import { Calendar, CheckCircle, RefreshCw, LogOut, ExternalLink, AlertTriangle } from 'lucide-react';
import { api } from '../../../services/api';
import type { User } from '../../../services/types';
import clsx from 'clsx';
import { useAuth } from '../../../features/auth/AuthContext';

interface IntegrationsTabProps {
    artist: User;
    onUpdate: () => void;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({ artist, onUpdate }) => {
    const { user: currentUser } = useAuth();
    const [connecting, setConnecting] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Only the artist themselves, Owner, or Admin can manage integrations
    const canManage = currentUser?.id === artist.id || currentUser?.role === 'owner' || currentUser?.role === 'STUDIO_ADMIN';

    // ... handleConnect, handleDisconnect, handleSyncNow ...

    const handleConnect = () => {
        setConnecting(true);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        // Construct the redirect URL for the Edge Function
        // We pass artist.id as user_id so the token is saved for this specific artist
        const loginUrl = `${supabaseUrl}/functions/v1/google-auth/login?user_id=${artist.id}&redirect_to=${encodeURIComponent(window.location.href)}`;

        window.location.href = loginUrl;
    };

    const handleDisconnect = async () => {
        if (!confirm('Vuoi davvero disconnettere Google Calendar? I futuri appuntamenti non saranno sincronizzati.')) return;
        try {
            await api.googleCalendar.disconnect(artist.id);
            onUpdate();
        } catch (error) {
            console.error(error);
        }
    };

    const handleSyncNow = async () => {
        setSyncing(true);
        try {
            const res = await api.googleCalendar.syncEvents(artist.id);
            alert(`Sincronizzazione completata! ${res.synced_events_count} eventi aggiornati.`);
            onUpdate(); // Update last_sync timestamp
        } catch (error) {
            console.error(error);
            alert('Errore sincronizzazione');
        } finally {
            setSyncing(false);
        }
    };



    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                <AlertTriangle size={48} className="mb-4 opacity-20" />
                <p>Solo l'artista o l'amministratore possono gestire le integrazioni.</p>
            </div>
        );
    }

    const gcal = artist.integrations?.google_calendar;

    // ... (keep existing check for success param) ...

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-text-primary mb-6">Integrazioni Esterne</h3>

            {/* Google Calendar Card - Keep existing code ... */}
            <div className="bg-bg-tertiary p-6 rounded-xl border border-border flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                {/* ... (keep existing content of card) ... */}
                <div className="flex items-start gap-4">
                    <div className={clsx(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        gcal?.is_connected ? "bg-green-500/10 text-green-500" : "bg-white/5 text-text-muted"
                    )}>
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-text-primary flex items-center gap-2">
                            Google Calendar
                            {gcal?.is_connected && <CheckCircle size={16} className="text-green-500" />}
                        </h4>
                        <p className="text-sm text-text-muted mb-2 max-w-md">
                            Sincronizza automaticamente gli appuntamenti del CRM con il tuo calendario Google personale.
                        </p>
                        {gcal?.is_connected && (
                            <div className="flex items-center gap-4 text-xs">
                                <span className="text-green-400 font-medium">Connesso come: {gcal.email}</span>
                                <span className="text-text-secondary">Ultimo sync: {gcal.last_sync ? new Date(gcal.last_sync).toLocaleString() : 'Mai'}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    {!gcal?.is_connected ? (
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            type="button"
                            className="w-full md:w-auto flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-lg font-bold transition-colors"
                        >
                            {connecting ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <ExternalLink size={18} />
                            )}
                            {connecting ? 'Connessione...' : 'Connetti Account Google'}
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleSyncNow}
                                disabled={syncing}
                                type="button"
                                className="flex items-center justify-center gap-2 bg-bg-secondary hover:bg-bg-primary text-text-primary border border-border px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                <RefreshCw size={18} className={clsx(syncing && "animate-spin")} />
                                {syncing ? 'Sync...' : 'Importa Ora'}
                            </button>
                            <button
                                onClick={handleDisconnect}
                                type="button"
                                className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                <LogOut size={18} />
                                Disconnetti
                            </button>
                        </>
                    )}
                </div>
            </div>

        </div>
    );
};
