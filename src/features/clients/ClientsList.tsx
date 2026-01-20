import React, { useState, useMemo } from 'react';
import { Search, Plus, Mail, Phone, MessageCircle, Megaphone, QrCode, X, Copy, Check, Star, Filter, ExternalLink, Trash2, CheckSquare, Square, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import type { Client } from '../../services/types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { useGoogleSheetsSync } from './hooks/useGoogleSheetsSync';
import { ReviewRequestModal } from '../../components/ReviewRequestModal';
import { useRealtime } from '../../hooks/useRealtime';

import { useQuery, useQueryClient } from '@tanstack/react-query';

export const ClientsList: React.FC = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Realtime Subscription
    useRealtime('clients', () => {
        console.log('[ClientsList] Realtime update detected. Invalidating query...');
        queryClient.invalidateQueries({ queryKey: ['clients', user?.studio_id] });
    });

    // React Query for data fetching
    const { data: clients = [], isLoading: loading } = useQuery({
        queryKey: ['clients', user?.studio_id],
        queryFn: () => api.clients.list(undefined, user?.studio_id),
        enabled: !!user?.studio_id,
        staleTime: 1000 * 60 * 5, // 5 minutes fresh
    });

    const [search, setSearch] = useState('');
    // Removed local clients state and loading state as they are handled by React Query
    const [showQR, setShowQR] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [modalTab, setModalTab] = useState<'import' | 'export' | 'config'>('import');
    const [copied, setCopied] = useState(false);

    // Google Sync Hook
    const { isSyncing, syncClients, hasConfig, stats: syncStats } = useGoogleSheetsSync();

    // Effect to refresh query when sync is done
    React.useEffect(() => {
        if (syncStats && syncStats.success > 0) {
            queryClient.invalidateQueries({ queryKey: ['clients', user?.studio_id] });
            alert(`Sincronizzazione completata: ${syncStats.success} nuovi clienti aggiunti.`);
        }
    }, [syncStats, queryClient, user?.studio_id]);

    // Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        broadcast: 'all' as 'all' | 'opt-in' | 'opt-out',
        style: ''
    });

    // Review Modal State
    const [reviewModalData, setReviewModalData] = useState<{ isOpen: boolean; clientName: string; clientPhone?: string; studioId?: string }>({ isOpen: false, clientName: '' });

    // Bulk Selection State
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    const navigate = useNavigate();
    // user already deconstructed above
    const studioId = user?.studio_id;
    // Use configured site URL (production) or fallback to current origin (dev/preview)
    const baseUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const registrationLink = `${baseUrl}/public/register/${studioId}`;

    // Data loading handled by useQuery

    // Derived State: Unique Styles
    const uniqueStyles = useMemo(() => {
        const styles = new Set<string>();
        clients.forEach(c => {
            c.preferred_styles?.forEach(s => styles.add(s));
        });
        return Array.from(styles).sort();
    }, [clients]);

    // Derived State: Filtered Clients
    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            // Search Text
            const matchesSearch = search === '' ||
                (client.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
                (client.email || '').toLowerCase().includes(search.toLowerCase()) ||
                (client.phone || '').includes(search);

            // Broadcast Filter
            const matchesBroadcast =
                filters.broadcast === 'all' ? true :
                    filters.broadcast === 'opt-in' ? client.whatsapp_broadcast_opt_in :
                        !client.whatsapp_broadcast_opt_in; // opt-out

            // Style Filter
            const matchesStyle =
                filters.style === '' ? true :
                    client.preferred_styles?.includes(filters.style);

            return matchesSearch && matchesBroadcast && matchesStyle;
        });
    }, [clients, search, filters]);

    const handleWhatsAppClick = (e: React.MouseEvent, phone: string) => {
        e.stopPropagation(); // Prevent row click navigation
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const handleReviewClick = (e: React.MouseEvent, client: Client) => {
        e.stopPropagation();
        setReviewModalData({
            isOpen: true,
            clientName: client.full_name,
            clientPhone: client.phone,
            studioId: client.studio_id || user?.studio_id
        });
    };

    const handleToggleBroadcast = async (e: React.MouseEvent, client: Client) => {
        e.stopPropagation();

        const newStatus = !client.whatsapp_broadcast_opt_in;

        // Optimistic Update
        queryClient.setQueryData(['clients', user?.studio_id], (old: Client[] | undefined) => {
            return old ? old.map(c => c.id === client.id ? { ...c, whatsapp_broadcast_opt_in: newStatus } : c) : [];
        });

        try {
            await api.clients.update(client.id, {
                whatsapp_broadcast_opt_in: newStatus
            });
            // Optional: Invalidate to refetch fresh data
            // queryClient.invalidateQueries({ queryKey: ['clients', user?.studio_id] });
        } catch (error) {
            console.error('Error toggling broadcast status:', error);
            // Revert
            queryClient.setQueryData(['clients', user?.studio_id], (old: Client[] | undefined) => {
                return old ? old.map(c => c.id === client.id ? { ...c, whatsapp_broadcast_opt_in: !newStatus } : c) : [];
            });
        }
    };


    // Bulk Actions Handlers
    const handleSelectAll = () => {
        if (selectedClients.size === filteredClients.length) {
            setSelectedClients(new Set()); // Deselect all
        } else {
            setSelectedClients(new Set(filteredClients.map(c => c.id))); // Select all filtered
        }
    };

    const handleToggleSelect = (e: React.MouseEvent, clientId: string) => {
        e.stopPropagation();
        const newSelected = new Set(selectedClients);
        if (newSelected.has(clientId)) {
            newSelected.delete(clientId);
        } else {
            newSelected.add(clientId);
        }
        setSelectedClients(newSelected);
    };

    const handleBulkDelete = async () => {
        if (selectedClients.size === 0) return;

        if (!window.confirm(`Sei sicuro di voler eliminare ${selectedClients.size} clienti selezionati? Questa azione è irreversibile.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            // Delete sequentially or parallel - parallel is fine for ~50 items usually
            await Promise.all(Array.from(selectedClients).map(id => api.clients.delete(id)));

            // Invalidate query
            await queryClient.invalidateQueries({ queryKey: ['clients', user?.studio_id] });

            // Clear selection
            setSelectedClients(new Set());
            // alert("Clienti eliminati con successo.");
        } catch (error) {
            console.error("Bulk delete failed:", error);
            alert("Errore durante l'eliminazione dei clienti. Riprova.");
        } finally {
            setIsDeleting(false);
        }
    };



    return (
        <div className="w-full p-4 md:p-8 flex flex-col">


            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary">Clienti <span className="text-lg font-normal text-text-muted">({clients.length})</span></h1>
                        <p className="text-text-muted">Gestisci il database e lo storico clienti.</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                        {/* Action Buttons Group */}
                        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                            {user?.role === 'owner' && (
                                <>
                                    <button
                                        onClick={() => { setModalTab('import'); setShowImport(true); }}
                                        className="flex items-center gap-2 bg-green-600/10 border border-green-600/20 hover:bg-green-600/20 text-green-500 px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                                        title="Importa da Google Sheets"
                                    >
                                        <span className="hidden lg:inline">Importa Google</span>
                                    </button>

                                    <button
                                        onClick={syncClients}
                                        disabled={!hasConfig || isSyncing}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${hasConfig
                                            ? 'bg-green-600/10 border border-green-600/20 hover:bg-green-600/20 text-green-500'
                                            : 'bg-gray-500/10 border border-gray-500/20 text-gray-500 cursor-not-allowed opacity-50'
                                            }`}
                                        title={hasConfig ? "Aggiorna da Google Sheets (Usa configurazione salvata)" : "Configura prima un foglio Google"}
                                    >
                                        {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                        <span className="hidden lg:inline">Aggiorna</span>
                                    </button>


                                </>
                            )}
                            <button
                                onClick={() => setShowQR(true)}
                                className="flex items-center gap-2 bg-accent/10 border border-accent/20 hover:bg-accent/20 text-accent px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                                title="QR Code Registrazione"
                            >
                                <QrCode size={18} />
                                <span className="hidden lg:inline">QR Registrazione</span>
                            </button>
                        </div>

                        <button
                            onClick={() => navigate('/clients/new')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap w-full md:w-auto justify-center"
                        >
                            <Plus size={18} />
                            <span className="hidden md:inline">Nuovo Cliente</span>
                        </button>
                    </div>
                </div>

                {/* Search & Filters Bar */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Cerca cliente..."
                            className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-text-muted" size={18} />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-accent/10 border-accent text-accent' : 'bg-bg-secondary border-border text-text-muted hover:text-text-primary'}`}
                        title="Filtri"
                    >
                        <Filter size={20} />
                    </button>
                </div>

                {/* Bulk Actions Header - shown when items selected */}
                {selectedClients.size > 0 && (
                    <div className="bg-accent/10 border border-accent rounded-lg p-3 mb-4 flex items-center justify-between animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-white px-3 py-1 bg-accent rounded-md">
                                {selectedClients.size} Selezionati
                            </span>
                            <span className="text-sm text-text-muted hidden md:inline">
                                Clienti pronti per l'eliminazione
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedClients(new Set())}
                                className="text-text-muted hover:text-text-primary px-3 py-1 text-sm pt-1.5"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-lg disabled:opacity-50"
                            >
                                {isDeleting ? 'Eliminazione...' : (
                                    <>
                                        <Trash2 size={18} />
                                        <span className="hidden md:inline">Elimina Selezionati</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Filter Panel */}
                {showFilters && (
                    <div className="bg-bg-secondary border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                        {/* Broadcast Filter */}
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Broadcast WhatsApp</label>
                            <div className="flex bg-bg-tertiary rounded-lg p-1">
                                {[
                                    { value: 'all', label: 'Tutti' },
                                    { value: 'opt-in', label: 'Iscritti' },
                                    { value: 'opt-out', label: 'Non Iscritti' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setFilters(prev => ({ ...prev, broadcast: opt.value as any }))}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${filters.broadcast === opt.value ? 'bg-accent text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Style Filter */}
                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-2 uppercase tracking-wider">Stile Tatuaggio</label>
                            <select
                                className="w-full bg-bg-tertiary border border-bg-primary rounded-lg px-3 py-2 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                value={filters.style}
                                onChange={(e) => setFilters(prev => ({ ...prev, style: e.target.value }))}
                            >
                                <option value="">Tutti gli stili</option>
                                {uniqueStyles.map(style => (
                                    <option key={style} value={style}>{style}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop Table (lg+) */}
            <div className="hidden lg:block bg-bg-secondary rounded-lg border border-border overflow-hidden flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-bg-tertiary">
                        <tr className="text-sm text-text-muted font-medium border-b border-border">
                            <th className="px-6 py-3 w-12">
                                <div
                                    className="cursor-pointer"
                                    onClick={handleSelectAll}
                                >
                                    {filteredClients.length > 0 && selectedClients.size === filteredClients.length ? (
                                        <CheckSquare size={20} className="text-accent" />
                                    ) : (
                                        <Square size={20} className="text-text-muted" />
                                    )}
                                </div>
                            </th>
                            <th className="px-6 py-3">Nome</th>
                            <th className="px-6 py-3">Contatti</th>
                            <th className="px-6 py-3">Ultima Visita</th>
                            <th className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-muted">Caricamento...</td></tr>
                        ) : filteredClients.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-muted">Nessun cliente trovato.</td></tr>
                        ) : (
                            filteredClients.map(client => (
                                <tr
                                    key={client.id}
                                    onClick={() => navigate(`/clients/${client.id}`)}
                                    className="hover:bg-white/5 cursor-pointer transition-colors group"
                                >
                                    <td className="px-6 py-4" onClick={(e) => handleToggleSelect(e, client.id)}>
                                        <div className="cursor-pointer">
                                            {selectedClients.has(client.id) ? (
                                                <CheckSquare size={20} className="text-accent" />
                                            ) : (
                                                <Square size={20} className="text-text-muted group-hover:text-text-secondary" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-text-primary flex items-center gap-2">
                                            {client.full_name}
                                            {(!client.email || !client.phone) && (
                                                <div className="group relative">
                                                    <AlertTriangle size={16} className="text-yellow-500" />
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10 pointer-events-none">
                                                        Dati incompleti
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-text-muted">ID: {client.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-sm text-text-secondary break-all">
                                            <div className="flex items-center gap-2">
                                                <Mail size={14} className="shrink-0" /> <span className="break-all">{client.email}</span>
                                            </div>
                                            <div
                                                className="flex items-center gap-2 hover:text-text-primary cursor-pointer transition-colors"
                                                onClick={(e) => handleWhatsAppClick(e, client.phone)}
                                                title="Apri WhatsApp"
                                            >
                                                <Phone size={14} className="shrink-0" /> <span className="whitespace-nowrap">{client.phone}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        -
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <button
                                                onClick={(e) => handleReviewClick(e, client)}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-yellow-500 hover:bg-yellow-500/10 border border-yellow-500/20"
                                                title="Chiedi Recensione Google"
                                            >
                                                <Star size={16} />
                                                <span className="text-sm font-medium">Richiedi recensione</span>
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleBroadcast(e, client)}
                                                className={`p-2 rounded-lg transition-colors ${client.whatsapp_broadcast_opt_in
                                                    ? 'text-green-500 hover:bg-green-500/10'
                                                    : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary'
                                                    }`}
                                                title={client.whatsapp_broadcast_opt_in ? "Rimuovi da Broadcast" : "Aggiungi a Broadcast"}
                                            >
                                                <Megaphone size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => handleWhatsAppClick(e, client.phone)}
                                                className="p-2 hover:bg-[#25D366]/20 text-[#25D366] rounded-lg transition-colors"
                                                title="Apri WhatsApp"
                                            >
                                                <MessageCircle size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile/Tablet Card View (< lg) */}
            <div className="lg:hidden space-y-4">
                {loading ? (
                    <div className="p-8 text-center text-text-muted">Caricamento...</div>
                ) : filteredClients.length === 0 ? (
                    <div className="p-8 text-center text-text-muted">Nessun cliente trovato.</div>
                ) : (
                    filteredClients.map(client => (
                        <div
                            key={client.id}
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className={`bg-bg-secondary border border-border rounded-xl p-4 flex flex-col gap-3 transition-colors ${selectedClients.has(client.id) ? 'border-accent/50 bg-accent/5' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div
                                        className="mt-1 shrink-0"
                                        onClick={(e) => handleToggleSelect(e, client.id)}
                                    >
                                        {selectedClients.has(client.id) ? (
                                            <CheckSquare size={20} className="text-accent" />
                                        ) : (
                                            <Square size={20} className="text-text-muted" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-text-primary text-lg flex items-center gap-2">
                                            {client.full_name}
                                            {(!client.email || !client.phone) && (
                                                <AlertTriangle size={18} className="text-yellow-500" />
                                            )}
                                        </div>
                                        <div className="text-xs text-text-muted">ID: {client.id}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <button
                                        onClick={(e) => handleReviewClick(e, client)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-yellow-500 bg-yellow-500/10 border border-yellow-500/20"
                                        title="Chiedi Recensione"
                                    >
                                        <Star size={16} />
                                        <span className="text-xs font-medium">Richiedi recensione</span>
                                    </button>
                                    <button
                                        onClick={(e) => handleToggleBroadcast(e, client)}
                                        className={`p-2 rounded-lg transition-colors ${client.whatsapp_broadcast_opt_in
                                            ? 'bg-green-500/10 text-green-500'
                                            : 'bg-bg-tertiary text-text-muted'
                                            }`}
                                        title={client.whatsapp_broadcast_opt_in ? "Rimuovi da Broadcast" : "Aggiungi a Broadcast"}
                                    >
                                        <Megaphone size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => handleWhatsAppClick(e, client.phone)}
                                        className="p-2 bg-green-500/10 text-green-500 rounded-lg"
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-text-muted space-y-1">
                                <div className="truncate">{client.email}</div>
                                <div>{client.phone}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>


            {/* QR Code Modal */}
            {
                showQR && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
                        <div className="bg-bg-secondary border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-text-primary">QR Code Clienti</h3>
                                <button onClick={() => setShowQR(false)} className="text-text-muted hover:text-text-primary transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex flex-col items-center gap-6">
                                <div className="bg-white p-4 rounded-xl">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=svg&data=${encodeURIComponent(registrationLink)}`}
                                        alt="QR Code Registrazione"
                                        className="w-48 h-48"
                                    />
                                </div>

                                <div className="text-center">
                                    <p className="text-text-muted text-sm mb-2">
                                        Fai scansionare questo QR Code ai tuoi clienti per registrarsi autonomamente, oppure usa il link nel tuo sito web.
                                    </p>
                                </div>

                                <div className="w-full">
                                    <label className="block text-xs font-medium text-text-muted mb-1 uppercase tracking-wider">Link Pubblico</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={registrationLink}
                                            className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-secondary outline-none font-mono"
                                        />
                                        <button
                                            onClick={() => window.open(registrationLink, '_blank')}
                                            className="bg-bg-tertiary hover:bg-white/10 border border-border text-text-primary p-2 rounded-lg transition-colors"
                                            title="Apri Link"
                                        >
                                            <ExternalLink size={18} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(registrationLink);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                            className="bg-bg-tertiary hover:bg-white/10 border border-border text-text-primary p-2 rounded-lg transition-colors"
                                            title="Copia Link"
                                        >
                                            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <GoogleSheetsSyncModal
                isOpen={showImport}
                onClose={() => setShowImport(false)}
                onSyncSuccess={() => queryClient.invalidateQueries({ queryKey: ['clients', user?.studio_id] })}
                initialTab={modalTab}
            />

            <ReviewRequestModal
                isOpen={reviewModalData.isOpen}
                onClose={() => setReviewModalData({ ...reviewModalData, isOpen: false })}
                clientName={reviewModalData.clientName}
                clientPhone={reviewModalData.clientPhone}
                studioId={reviewModalData.studioId}
            />
        </div >
    );
};
