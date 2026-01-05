import React, { useState, useEffect } from 'react';
import { Search, Plus, Mail, Phone, MessageCircle, Megaphone, QrCode, X, Copy, Check } from 'lucide-react';
import { api } from '../../services/api';
import type { Client } from '../../services/types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const ClientsList: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showQR, setShowQR] = useState(false);
    const [copied, setCopied] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();
    const studioId = user?.studio_id || 'studio-1'; // Default or derive from user
    const registrationLink = `${window.location.origin}/public/register/${studioId}`;

    useEffect(() => {
        loadClients();
    }, [search]);

    const loadClients = async () => {
        setLoading(true);
        try {
            const data = await api.clients.list(search);
            setClients(data);
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsAppClick = (e: React.MouseEvent, phone: string) => {
        e.stopPropagation(); // Prevent row click navigation
        const cleanPhone = phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}`, '_blank');
    };

    const handleToggleBroadcast = async (e: React.MouseEvent, client: Client) => {
        e.stopPropagation();
        try {
            await api.clients.update(client.id, {
                whatsapp_broadcast_opt_in: !client.whatsapp_broadcast_opt_in
            });
            // Reload to reflect changes
            loadClients();
        } catch (error) {
            console.error('Error toggling broadcast status:', error);
        }
    };



    return (
        <div className="w-full p-4 md:p-8 flex flex-col">


            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Clienti</h1>
                    <p className="text-text-muted">Gestisci il database e lo storico clienti.</p>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Action Buttons Group */}
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button
                            onClick={() => setShowQR(true)}
                            className="flex items-center gap-2 bg-accent/10 border border-accent/20 hover:bg-accent/20 text-accent px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
                            title="QR Code Registrazione"
                        >
                            <QrCode size={18} />
                            <span className="hidden lg:inline">QR Registrazione</span>
                        </button>
                    </div>

                    <div className="relative flex-1 md:w-64 w-full">
                        <input
                            type="text"
                            placeholder="Cerca cliente..."
                            className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-text-muted" size={18} />
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

            {/* Desktop Table */}
            <div className="hidden md:block bg-bg-secondary rounded-lg border border-border overflow-hidden flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-bg-tertiary">
                        <tr className="text-sm text-text-muted font-medium border-b border-border">
                            <th className="px-6 py-3">Nome</th>
                            <th className="px-6 py-3">Contatti</th>
                            <th className="px-6 py-3">Ultima Visita</th>
                            <th className="px-6 py-3 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-muted">Caricamento...</td></tr>
                        ) : clients.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-text-muted">Nessun cliente trovato per "{search}"</td></tr>
                        ) : (
                            clients.map(client => (
                                <tr
                                    key={client.id}
                                    onClick={() => navigate(`/clients/${client.id}`)}
                                    className="hover:bg-white/5 cursor-pointer transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{client.full_name}</div>
                                        <div className="text-xs text-text-muted">ID: {client.id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-sm text-text-secondary">
                                            <div className="flex items-center gap-2">
                                                <Mail size={14} /> {client.email}
                                            </div>
                                            <div
                                                className="flex items-center gap-2 hover:text-white cursor-pointer transition-colors"
                                                onClick={(e) => handleWhatsAppClick(e, client.phone)}
                                                title="Apri WhatsApp"
                                            >
                                                <Phone size={14} /> {client.phone}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        -
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <button
                                                onClick={(e) => handleToggleBroadcast(e, client)}
                                                className={`p-2 rounded-lg transition-colors ${client.whatsapp_broadcast_opt_in
                                                    ? 'text-green-500 hover:bg-green-500/10'
                                                    : 'text-text-muted hover:text-white hover:bg-bg-tertiary'
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

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    <div className="p-8 text-center text-text-muted">Caricamento...</div>
                ) : clients.length === 0 ? (
                    <div className="p-8 text-center text-text-muted">Nessun cliente trovato.</div>
                ) : (
                    clients.map(client => (
                        <div
                            key={client.id}
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className="bg-bg-secondary border border-border rounded-xl p-4 flex flex-col gap-3"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-white text-lg">{client.full_name}</div>
                                    <div className="text-xs text-text-muted">ID: {client.id}</div>
                                </div>
                                <div className="flex gap-2">
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
                                <h3 className="text-xl font-bold text-white">QR Code Clienti</h3>
                                <button onClick={() => setShowQR(false)} className="text-text-muted hover:text-white transition-colors">
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
                                            className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-secondary outline-none"
                                        />
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(registrationLink);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                            className="bg-bg-tertiary hover:bg-white/10 border border-border text-white p-2 rounded-lg transition-colors"
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
        </div >
    );
};
