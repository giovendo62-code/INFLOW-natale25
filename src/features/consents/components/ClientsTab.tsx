
import React, { useState, useEffect } from 'react';
import { Search, FileSignature, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../../services/api';
import type { Client, ClientConsent } from '../../../services/types';
import { useAuth } from '../../../features/auth/AuthContext';

import { generateConsentPDF } from '../../../utils/pdfGenerator';

interface ClientsTabProps {
    onStartSignature: (client: Client) => void;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({ onStartSignature }) => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [clientConsents, setClientConsents] = useState<Record<string, ClientConsent | null>>({});

    useEffect(() => {
        if (user?.studio_id) {
            loadClients();
        }
    }, [searchTerm, user?.studio_id]);

    const loadClients = async () => {
        setLoading(true);
        try {
            const data = await api.clients.list(searchTerm, user?.studio_id);
            setClients(data);
            // In a real app, we would optimize this to not N+1
            // For now, we only load status for the first few or on demand
            data.forEach(client => checkConsentStatus(client.id));
        } finally {
            setLoading(false);
        }
    };

    const checkConsentStatus = async (clientId: string) => {
        try {
            const consents = await api.consents.listClientConsents(clientId);
            // Assuming we care about the latest valid one
            const latest = consents.find(c => c.status === 'SIGNED');
            setClientConsents(prev => ({
                ...prev,
                [clientId]: latest || null
            }));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDownloadPDF = async (client: Client, consent: ClientConsent) => {
        setDownloading(client.id);
        try {
            // Fetch template content again to ensure we have the text
            // In a real scenario, we might want to fetch the specific version linked to consent
            const template = await api.consents.getTemplate(client.studio_id);
            if (!template) throw new Error("Template not found");

            // Fetch studio info for the PDF
            const studio = await api.settings.getStudio(client.studio_id);

            await generateConsentPDF(client, template, consent, studio);
        } catch (err) {
            console.error(err);
            alert(`Errore durante la generazione del PDF: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="relative">
                <input
                    type="text"
                    placeholder="Cerca cliente per nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
                />
                <Search className="absolute left-3 top-3.5 text-text-muted" size={20} />
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block bg-bg-secondary border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-bg-tertiary text-text-muted uppercase text-xs font-semibold">
                        <tr>
                            <th className="p-4">Cliente</th>
                            <th className="p-4">Stato Consenso</th>
                            <th className="p-4 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-muted">Caricamento...</td></tr>
                        ) : clients.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-muted">Nessun cliente trovato.</td></tr>
                        ) : (
                            clients.map(client => {
                                const consent = clientConsents[client.id];
                                return (
                                    <tr key={client.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-text-primary">{client.full_name}</div>
                                        </td>
                                        <td className="p-4">
                                            {consent ? (
                                                <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-3 py-1 rounded-full w-fit">
                                                    <CheckCircle size={14} />
                                                    <span className="text-xs font-medium">Firmato il {new Date(consent.signed_at).toLocaleDateString()}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full w-fit">
                                                    <XCircle size={14} />
                                                    <span className="text-xs font-medium">Non firmato</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            {consent ? (
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        className="text-sm text-accent hover:text-accent-hover font-medium underline px-3 disabled:opacity-50"
                                                        onClick={() => handleDownloadPDF(client, consent)}
                                                        disabled={downloading === client.id}
                                                    >
                                                        {downloading === client.id ? 'Generazione...' : 'Scarica PDF'}
                                                    </button>
                                                    <button
                                                        onClick={() => onStartSignature(client)}
                                                        className="bg-bg-tertiary hover:bg-white/10 text-text-primary px-3 py-1 rounded-lg text-xs font-medium transition-colors border border-border flex items-center gap-1"
                                                        title="Firma nuovamente"
                                                    >
                                                        <FileSignature size={14} />
                                                        Rifirma
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => onStartSignature(client)}
                                                    className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ml-auto"
                                                >
                                                    <FileSignature size={16} />
                                                    Avvia Firma
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
                {loading ? (
                    <div className="p-8 text-center text-text-muted">Caricamento...</div>
                ) : clients.length === 0 ? (
                    <div className="p-8 text-center text-text-muted">Nessun cliente trovato.</div>
                ) : (
                    clients.map(client => {
                        const consent = clientConsents[client.id];
                        return (
                            <div key={client.id} className="bg-bg-secondary border border-border rounded-xl p-4 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-text-primary text-lg">{client.full_name}</div>
                                    </div>
                                    {consent ? (
                                        <CheckCircle size={20} className="text-green-400" />
                                    ) : (
                                        <XCircle size={20} className="text-yellow-500" />
                                    )}
                                </div>



                                <div className="pt-2 border-t border-border flex items-center justify-between">
                                    <div className="text-xs">
                                        {consent ? (
                                            <span className="text-green-400">Firmato il {new Date(consent.signed_at).toLocaleDateString()}</span>
                                        ) : (
                                            <span className="text-yellow-500">In attesa di firma</span>
                                        )}
                                    </div>

                                    {consent ? (
                                        <div className="flex gap-2">
                                            <button
                                                className="text-xs bg-bg-tertiary hover:bg-white/10 text-text-primary px-3 py-2 rounded-lg font-medium transition-colors border border-border"
                                                onClick={() => handleDownloadPDF(client, consent)}
                                                disabled={downloading === client.id}
                                            >
                                                {downloading === client.id ? '...' : 'PDF'}
                                            </button>
                                            <button
                                                onClick={() => onStartSignature(client)}
                                                className="text-xs bg-accent/10 hover:bg-accent/20 text-accent px-3 py-2 rounded-lg font-medium transition-colors border border-accent/20 flex items-center gap-1"
                                            >
                                                <FileSignature size={14} />
                                                Rifirma
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => onStartSignature(client)}
                                            className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                                        >
                                            <FileSignature size={14} />
                                            Firma
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
