import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { WaitlistEntry } from '../../services/types';
import { Search, Filter, QrCode, CheckCircle, Clock, UserPlus, ArrowUpRight, ChevronDown, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';

export const WaitlistManager: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showQr, setShowQr] = useState(false);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('PENDING');

    // Filters State
    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [dateFilter, setDateFilter] = useState('');
    const [styleFilter, setStyleFilter] = useState('');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await api.waitlist.list(user?.studio_id || 'studio-1');
            setEntries(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, status: WaitlistEntry['status']) => {
        try {
            await api.waitlist.updateStatus(id, status);
            loadData();
        } catch (err) {
            alert('Errore aggiornamento stato');
        }
    };

    const publicLink = `${window.location.origin}/public/waitlist/${user?.studio_id || 'studio-1'}`;

    const filteredEntries = entries.filter(entry => {
        // Tab Filter
        const matchesTab = (() => {
            if (activeTab === 'PENDING') return entry.status === 'PENDING';
            if (activeTab === 'IN_PROGRESS') return entry.status === 'IN_PROGRESS' || entry.status === 'CONTACTED';
            if (activeTab === 'COMPLETED') return entry.status === 'BOOKED' || entry.status === 'REJECTED';
            return true;
        })();

        // Search Filter (Name/Email)
        const matchesSearch = searchTerm === '' ||
            entry.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.email.toLowerCase().includes(searchTerm.toLowerCase());

        // Style Filter
        const matchesStyle = styleFilter === '' ||
            entry.styles.some(s => s.toLowerCase().includes(styleFilter.toLowerCase()));

        // Date Filter (Exact match on date string for simplicity, can be range)
        const matchesDate = dateFilter === '' ||
            new Date(entry.created_at).toISOString().split('T')[0] === dateFilter;

        return matchesTab && matchesSearch && matchesStyle && matchesDate;
    }).sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
    });

    return (
        <div className="w-full overflow-x-hidden pt-20 md:pt-8 p-4 md:p-8 relative">

            <div className="max-w-7xl mx-auto space-y-6 w-full min-w-0">

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">Lista d'Attesa</h1>
                        <p className="text-sm text-text-muted">Gestisci le richieste di appuntamento in arrivo.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowQr(!showQr)}
                            className="flex items-center gap-2 bg-bg-tertiary hover:bg-white/10 text-white px-4 py-2 rounded-lg border border-border transition-colors text-sm"
                        >
                            <QrCode size={18} />
                            <span className="hidden sm:inline">{showQr ? 'Nascondi QR' : 'Mostra QR Code'}</span>
                            <span className="sm:hidden">{showQr ? 'Chiudi' : 'QR'}</span>
                        </button>
                    </div>
                </div>

                {/* QR Code Section */}
                {showQr && (
                    <div className="bg-white p-4 sm:p-6 rounded-xl border border-border shadow-xl w-full max-w-sm mx-auto text-center transform transition-all animate-in fade-in slide-in-from-top-4">

                        <h3 className="text-black font-bold text-lg mb-4">Scansiona per Iscriverti</h3>
                        <div className="bg-gray-100 p-4 rounded-lg inline-block mb-4">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicLink)}`}
                                alt="QR Code"
                                className="w-48 h-48 mix-blend-multiply"
                            />
                        </div>
                        <p className="text-gray-500 text-[10px] break-all px-4">{publicLink}</p>
                        <button
                            onClick={() => window.open(publicLink, '_blank')}
                            className="mt-4 text-accent text-sm font-medium hover:underline"
                        >
                            Apri Link
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="mt-2 block w-full text-gray-400 text-[10px] hover:text-black"
                        >
                            Stampa
                        </button>
                    </div>
                )}

                {/* Mobile Dropdown Menu for Status */}
                <div className="md:hidden mb-6">
                    <div className="relative bg-bg-secondary border border-border rounded-lg p-2">
                        <select
                            value={activeTab}
                            onChange={(e) => setActiveTab(e.target.value as any)}
                            className="w-full bg-transparent text-white font-medium outline-none appearance-none p-2"
                        >
                            <option value="PENDING" className="bg-bg-secondary text-white">
                                🕒 In Attesa ({entries.filter(e => e.status === 'PENDING').length})
                            </option>
                            <option value="IN_PROGRESS" className="bg-bg-secondary text-white">
                                👤 In Lavorazione ({entries.filter(e => e.status === 'IN_PROGRESS' || e.status === 'CONTACTED').length})
                            </option>
                            <option value="COMPLETED" className="bg-bg-secondary text-white">
                                ✅ Completati ({entries.filter(e => e.status === 'BOOKED' || e.status === 'REJECTED').length})
                            </option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>

                {/* Desktop Tabs */}
                <div className="hidden md:flex border-b border-border mb-6 w-full min-w-0">
                    <button
                        onClick={() => setActiveTab('PENDING')}
                        className={clsx(
                            'px-6 py-3 border-b-2 font-medium transition-colors flex items-center gap-2 text-sm',
                            activeTab === 'PENDING' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-white'
                        )}
                    >
                        <Clock size={16} />
                        In Attesa
                        <span className="bg-bg-tertiary text-text-secondary px-1.5 py-0.5 rounded-full text-[10px]">
                            {entries.filter(e => e.status === 'PENDING').length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('IN_PROGRESS')}
                        className={clsx(
                            'px-6 py-3 border-b-2 font-medium transition-colors flex items-center gap-2 text-sm',
                            activeTab === 'IN_PROGRESS' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-white'
                        )}
                    >
                        <UserPlus size={16} />
                        In Lavorazione
                        <span className="bg-bg-tertiary text-text-secondary px-1.5 py-0.5 rounded-full text-[10px]">
                            {entries.filter(e => e.status === 'IN_PROGRESS' || e.status === 'CONTACTED').length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('COMPLETED')}
                        className={clsx(
                            'px-6 py-3 border-b-2 font-medium transition-colors flex items-center gap-2 text-sm',
                            activeTab === 'COMPLETED' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-white'
                        )}
                    >
                        <CheckCircle size={16} />
                        Completati
                        <span className="bg-bg-tertiary text-text-secondary px-1.5 py-0.5 rounded-full text-[10px]">
                            {entries.filter(e => e.status === 'BOOKED' || e.status === 'REJECTED').length}
                        </span>
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6 w-full min-w-0 flex-wrap">

                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                        <input
                            type="text"
                            placeholder="Cerca per nome o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-accent focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={clsx(
                            "flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors",
                            isFilterOpen
                                ? "bg-accent text-white border-accent"
                                : "bg-bg-secondary border-border text-text-muted hover:text-white"
                        )}
                    >
                        <Filter size={16} />
                        Filtri
                        {(dateFilter || styleFilter) && (
                            <span className="flex h-2 w-2 rounded-full bg-white ml-1 animate-pulse" />
                        )}
                    </button>

                    {/* Collapsible Filters */}
                    {isFilterOpen && (
                        <div className="w-full flex flex-col md:flex-row gap-4 p-4 bg-bg-secondary border border-border rounded-lg animate-in slide-in-from-top-2">
                            <div className="flex-1">
                                <label className="text-xs text-text-muted mb-1 block">Data Richiesta</label>
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-white text-sm focus:border-accent focus:outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-text-muted mb-1 block">Stile Tatuaggio</label>
                                <select
                                    value={styleFilter}
                                    onChange={(e) => setStyleFilter(e.target.value)}
                                    className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-white text-sm focus:border-accent focus:outline-none"
                                >
                                    <option value="">Tutti gli stili</option>
                                    <option value="Realistico">Realistico</option>
                                    <option value="Minimal">Minimal</option>
                                    <option value="Geometrico">Geometrico</option>
                                    <option value="Old School">Old School</option>
                                    <option value="Colorato">Colorato</option>
                                    <option value="Blackwork">Blackwork</option>
                                    <option value="Lettering">Lettering</option>
                                </select>
                            </div>
                            <div className="flex items-end gap-2 text-right justify-end flex-wrap w-full md:w-auto mt-4 md:mt-0">
                                <div className="flex gap-1 border border-border rounded-lg p-1 bg-bg-tertiary">
                                    <button
                                        onClick={() => setSortOrder('ASC')}
                                        className={clsx(
                                            "px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1",
                                            sortOrder === 'ASC' ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-white"
                                        )}
                                    >
                                        <ArrowUpNarrowWide size={14} />
                                        Data Crescente
                                    </button>
                                    <button
                                        onClick={() => setSortOrder('DESC')}
                                        className={clsx(
                                            "px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1",
                                            sortOrder === 'DESC' ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-white"
                                        )}
                                    >
                                        <ArrowDownWideNarrow size={14} />
                                        Data Decrescente
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        setDateFilter('');
                                        setStyleFilter('');
                                        setSearchTerm('');
                                        setSortOrder('DESC');
                                    }}
                                    className="text-sm text-red-400 hover:text-red-300 underline py-2"
                                >
                                    Resetta Filtri
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block bg-bg-secondary rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-bg-tertiary border-b border-border text-xs uppercase text-text-muted">
                            <tr>
                                <th className="p-4 font-medium">Cliente</th>
                                <th className="p-4 font-medium">Stili & Idea</th>
                                <th className="p-4 font-medium">Data Richiesta</th>
                                <th className="p-4 font-medium text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-text-muted">Caricamento...</td></tr>
                            ) : filteredEntries.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-text-muted">Nessuna richiesta in questa sezione.</td></tr>
                            ) : (
                                filteredEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-bg-tertiary/50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="font-medium text-white hover:text-accent cursor-pointer transition-colors" onClick={() => navigate(`/clients/${entry.client_id}`)}>
                                                        {entry.client_name}
                                                    </div>
                                                    <div className="text-xs text-text-muted truncate max-w-[150px]">{entry.email}</div>
                                                </div>
                                                <button
                                                    onClick={() => navigate(`/clients/${entry.client_id}`)}
                                                    className="text-text-muted hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
                                                    title="Vai alla scheda cliente"
                                                >
                                                    <ArrowUpRight size={16} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {entry.styles.map(s => (
                                                    <span key={s} className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded border border-accent/20">{s}</span>
                                                ))}
                                            </div>
                                            <div className="text-sm text-text-secondary truncate max-w-xs" title={entry.description}>
                                                {entry.description || '-'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-text-secondary">
                                            {new Date(entry.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Actions (Same as desktop) */}
                                                {entry.status === 'PENDING' && (
                                                    <>
                                                        <button onClick={() => handleStatusUpdate(entry.id, 'IN_PROGRESS')} className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-medium border border-blue-500/20">In Lavorazione</button>
                                                        <button onClick={() => handleStatusUpdate(entry.id, 'REJECTED')} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-medium border border-red-500/20">Rifiuta</button>
                                                    </>
                                                )}
                                                {(entry.status === 'IN_PROGRESS' || entry.status === 'CONTACTED') && (
                                                    <>
                                                        <button onClick={() => handleStatusUpdate(entry.id, 'BOOKED')} className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg text-xs font-medium border border-green-500/20">Completa</button>
                                                        <button onClick={() => handleStatusUpdate(entry.id, 'PENDING')} className="px-3 py-1.5 bg-bg-tertiary hover:bg-white/10 text-text-muted hover:text-white rounded-lg text-xs font-medium border border-border">Attesa</button>
                                                    </>
                                                )}
                                                {(entry.status === 'BOOKED' || entry.status === 'REJECTED') && (
                                                    <button onClick={() => handleStatusUpdate(entry.id, 'IN_PROGRESS')} className="px-3 py-1.5 bg-bg-tertiary hover:bg-white/10 text-text-muted hover:text-white rounded-lg text-xs font-medium border border-border">Riapri</button>
                                                )}
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
                    ) : filteredEntries.length === 0 ? (
                        <div className="p-8 text-center text-text-muted">Nessuna richiesta in questa sezione.</div>
                    ) : (
                        filteredEntries.map(entry => (
                            <div key={entry.id} className="bg-bg-secondary rounded-xl border border-border p-4 flex flex-col gap-3 min-w-0 w-full overflow-hidden">
                                <div className="flex justify-between items-start gap-2 min-w-0">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-bold text-white text-lg truncate hover:text-accent cursor-pointer transition-colors" onClick={() => navigate(`/clients/${entry.client_id}`)}>{entry.client_name}</h4>
                                        <p className="text-xs text-text-muted truncate">{entry.email}</p>
                                    </div>

                                    <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">
                                        {new Date(entry.created_at).toLocaleDateString()}
                                    </span>
                                </div>

                                {entry.styles.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {entry.styles.map(s => (
                                            <span key={s} className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded border border-accent/20">{s}</span>
                                        ))}
                                    </div>
                                )}

                                {entry.description && (
                                    <p className="text-sm text-text-secondary italic bg-bg-tertiary/50 p-2 rounded break-words">"{entry.description}"</p>
                                )}


                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border mt-1">
                                    {/* Mobile Actions */}
                                    {entry.status === 'PENDING' && (
                                        <>
                                            <button onClick={() => handleStatusUpdate(entry.id, 'IN_PROGRESS')} className="py-2 bg-blue-500/10 text-blue-500 rounded-lg text-xs font-bold border border-blue-500/20 px-1">Lavorazione</button>
                                            <button onClick={() => handleStatusUpdate(entry.id, 'REJECTED')} className="py-2 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold border border-red-500/20 px-1">Rifiuta</button>
                                        </>
                                    )}
                                    {(entry.status === 'IN_PROGRESS' || entry.status === 'CONTACTED') && (
                                        <>
                                            <button onClick={() => handleStatusUpdate(entry.id, 'BOOKED')} className="py-2 bg-green-500/10 text-green-500 rounded-lg text-xs font-bold border border-green-500/20 px-1">Completa</button>
                                            <button onClick={() => handleStatusUpdate(entry.id, 'PENDING')} className="py-2 bg-bg-tertiary text-text-muted rounded-lg text-xs font-bold border border-border px-1 text-center">In Attesa</button>
                                        </>
                                    )}
                                    {(entry.status === 'BOOKED' || entry.status === 'REJECTED') && (
                                        <button onClick={() => handleStatusUpdate(entry.id, 'IN_PROGRESS')} className="col-span-2 py-2 bg-bg-tertiary text-text-muted rounded-lg text-xs font-bold border border-border">Riapri</button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
