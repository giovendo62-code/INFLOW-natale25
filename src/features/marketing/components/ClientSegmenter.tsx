import React, { useState, useEffect } from 'react';
import { Search, Megaphone, CheckSquare, Square } from 'lucide-react';
import { api } from '../../../services/api';
import type { Client, MarketingCampaign } from '../../../services/types';
import { useAuth } from '../../auth/AuthContext';
import clsx from 'clsx';

interface ClientSegmenterProps {
    data: Partial<MarketingCampaign>;
    onChange: (data: Partial<MarketingCampaign>) => void;
    onNext: () => void;
    onSelectionChange: (clients: Client[]) => void;
}

export const ClientSegmenter: React.FC<ClientSegmenterProps> = ({ data, onChange, onNext, onSelectionChange }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());

    // Filters State (Local)
    const [searchTerm, setSearchTerm] = useState(data.filters?.search || '');
    const [broadcastFilter, setBroadcastFilter] = useState<'ALL' | 'IN_BROADCAST' | 'NOT_IN_BROADCAST'>(data.filters?.broadcast_status || 'ALL');
    const [styleFilter, setStyleFilter] = useState(data.filters?.styles?.[0] || '');

    const STYLES = ['Realistico', 'Minimal', 'Old School', 'Blackwork', 'Lettering', 'Colorato', 'Geometrico'];

    useEffect(() => {
        loadClients();
    }, []);

    useEffect(() => {
        // Sync filters back to parent state
        onChange({
            ...data,
            filters: {
                ...data.filters,
                search: searchTerm,
                broadcast_status: broadcastFilter,
                styles: styleFilter ? [styleFilter] : []
            },
            recipients_count: selectedClients.size // Just approximate for now
        });

        // Pass full client objects for the manual list
        const selectedList = clients.filter(c => selectedClients.has(c.id));
        onSelectionChange(selectedList);

    }, [searchTerm, broadcastFilter, styleFilter, selectedClients, clients]);

    const { user } = useAuth();

    // ...

    const loadClients = async () => {
        if (!user?.studio_id) return;
        setLoading(true);
        try {
            const allClients = await api.clients.list(undefined, user.studio_id);
            setClients(allClients);
        } catch (error) {
            console.error('Failed to load clients', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredClients = clients.filter(client => {
        const matchesSearch = !searchTerm ||
            client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.phone.includes(searchTerm);

        const matchesBroadcast =
            broadcastFilter === 'ALL' ||
            (broadcastFilter === 'IN_BROADCAST' && client.whatsapp_broadcast_opt_in) ||
            (broadcastFilter === 'NOT_IN_BROADCAST' && !client.whatsapp_broadcast_opt_in);

        const matchesStyle = !styleFilter || (client.preferred_styles && client.preferred_styles.includes(styleFilter));

        return matchesSearch && matchesBroadcast && matchesStyle;
    });

    const toggleClient = (id: string) => {
        const newSet = new Set(selectedClients);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedClients(newSet);
    };

    const toggleAll = () => {
        if (selectedClients.size === filteredClients.length) {
            setSelectedClients(new Set());
        } else {
            setSelectedClients(new Set(filteredClients.map(c => c.id)));
        }
    };

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Filters Bar */}
            <div className="bg-bg-secondary p-4 rounded-lg border border-border flex flex-col md:flex-row gap-4 items-end md:items-center">
                <div className="flex-1 relative w-full">
                    <label className="block text-xs text-text-secondary mb-1">Cerca</label>
                    <input
                        type="text"
                        placeholder="Nome, Telefono..."
                        className="w-full bg-bg-primary border border-border rounded pl-9 pr-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-accent"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-8 text-text-muted" size={16} />
                </div>

                <div className="w-full md:w-64">
                    <label className="block text-xs text-text-secondary mb-1">Stato Broadcast</label>
                    <select
                        className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-accent"
                        value={broadcastFilter}
                        onChange={(e) => setBroadcastFilter(e.target.value as any)}
                    >
                        <option value="ALL">Tutti</option>
                        <option value="IN_BROADCAST">Solo in Broadcast List</option>
                        <option value="NOT_IN_BROADCAST">Non in Broadcast</option>
                    </select>
                </div>

                <div className="w-full md:w-64">
                    <label className="block text-xs text-text-secondary mb-1">Stile Tatuaggio</label>
                    <select
                        className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-accent"
                        value={styleFilter}
                        onChange={(e) => setStyleFilter(e.target.value)}
                    >
                        <option value="">Tutti gli stili</option>
                        {STYLES.map(style => (
                            <option key={style} value={style}>{style}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results Table */}
            <div className="flex-1 bg-bg-secondary rounded-lg border border-border overflow-hidden flex flex-col">
                <div className="p-4 border-b border-border flex justify-between items-center bg-bg-tertiary">
                    <div className="flex items-center gap-2">
                        <button onClick={toggleAll} className="text-text-secondary hover:text-white">
                            {selectedClients.size > 0 && selectedClients.size === filteredClients.length ? <CheckSquare size={20} /> : <Square size={20} />}
                        </button>
                        <span className="text-sm font-medium text-white ml-2">
                            {selectedClients.size} clienti selezionati su {filteredClients.length}
                        </span>
                    </div>
                    <button
                        onClick={onNext}
                        disabled={selectedClients.size === 0}
                        className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                        Conferma Selezione
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-bg-tertiary sticky top-0 z-10">
                            <tr>
                                <th className="w-12 px-4 py-3"></th>
                                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase">Cliente</th>
                                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase">Telefono</th>
                                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase">Stato Broadcast</th>
                                <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase">Stili</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-muted">Caricamento...</td></tr>
                            ) : filteredClients.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-muted">Nessun cliente trovato.</td></tr>
                            ) : (
                                filteredClients.map(client => {
                                    const isSelected = selectedClients.has(client.id);
                                    return (
                                        <tr
                                            key={client.id}
                                            className={clsx(
                                                'hover:bg-white/5 transition-colors cursor-pointer',
                                                isSelected && 'bg-accent/5'
                                            )}
                                            onClick={() => toggleClient(client.id)}
                                        >
                                            <td className="px-4 py-3">
                                                {isSelected ? <CheckSquare size={18} className="text-accent" /> : <Square size={18} className="text-text-muted" />}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-white font-medium">{client.full_name}</div>
                                                <div className="text-xs text-text-muted">{client.email}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-text-secondary">
                                                {client.phone}
                                            </td>
                                            <td className="px-4 py-3">
                                                {client.whatsapp_broadcast_opt_in ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500">
                                                        <Megaphone size={12} /> In Broadcast
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">
                                                        Non in lista
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-text-secondary">
                                                {client.preferred_styles?.join(', ') || '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
