import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { WaitlistEntry } from '../../services/types';
import { Search, Filter, QrCode, CheckCircle, Clock, UserPlus, ArrowUpRight, ChevronDown, ArrowDownWideNarrow, ArrowUpNarrowWide, PenTool, Check, Link, ChevronDownCircle, Edit3, Save, X, StickyNote } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtime } from '../../hooks/useRealtime';

export const WaitlistManager: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Filters State
    const [activeTab, setActiveTab] = useState<'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [dateFilter, setDateFilter] = useState('');
    const [styleFilter, setStyleFilter] = useState('');
    const [interestFilter, setInterestFilter] = useState<'ALL' | 'TATTOO' | 'ACADEMY'>('ALL');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
    const [showQr, setShowQr] = useState(false);
    const [copied, setCopied] = useState(false);

    // Pagination State
    const [visibleCount, setVisibleCount] = useState(50);
    const ITEMS_PER_PAGE = 50;

    // Undo State
    const [undoAction, setUndoAction] = useState<{ id: string, status: WaitlistEntry['status'] } | null>(null);
    const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Notes State
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');

    // React Query
    const { data: entries = [], isLoading: loading } = useQuery({
        queryKey: ['waitlist', user?.studio_id],
        queryFn: () => api.waitlist.list(user?.studio_id || 'studio-1'),
        enabled: !!user?.studio_id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Enable Realtime Updates
    useRealtime('waitlist_entries', () => {
        console.log('[WaitlistManager] Realtime update detected. Invalidating query...');
        queryClient.invalidateQueries({ queryKey: ['waitlist', user?.studio_id] });
    });

    const handleStatusUpdate = async (id: string, status: WaitlistEntry['status'], isUndo = false) => {
        // Find current status for Undo (only if not already an undo action)
        if (!isUndo) {
            const currentEntry = entries.find(e => e.id === id);
            if (currentEntry) {
                setUndoAction({ id, status: currentEntry.status });
                // Reset timer
                if (undoTimer) clearTimeout(undoTimer);
                const timer = setTimeout(() => setUndoAction(null), 5000);
                setUndoTimer(timer);
            }
        }

        // Optimistic Update
        queryClient.setQueryData(['waitlist', user?.studio_id], (old: WaitlistEntry[] | undefined) => {
            return old ? old.map(e => e.id === id ? { ...e, status } : e) : [];
        });

        try {
            await api.waitlist.updateStatus(id, status);
        } catch (err) {
            alert('Errore aggiornamento stato');
            // Revert
            queryClient.setQueryData(['waitlist', user?.studio_id], (old: WaitlistEntry[] | undefined) => {
                queryClient.invalidateQueries({ queryKey: ['waitlist', user?.studio_id] });
                return old;
            });
        }
    };

    const handleUndo = () => {
        if (undoAction) {
            handleStatusUpdate(undoAction.id, undoAction.status, true);
            setUndoAction(null);
            if (undoTimer) clearTimeout(undoTimer);
        }
    };

    const handleSaveNote = async (id: string) => {
        try {
            await api.waitlist.update(id, { notes: noteText });
            queryClient.invalidateQueries({ queryKey: ['waitlist', user?.studio_id] });
            setEditingNoteId(null);
            setNoteText('');
        } catch (err) {
            console.error("Error saving note:", err);
            alert("Errore nel salvataggio della nota");
        }
    };

    const startEditingNote = (entry: WaitlistEntry) => {
        setEditingNoteId(entry.id);
        setNoteText(entry.notes || '');
    };

    const publicLink = `${window.location.origin}/public/waitlist/${user?.studio_id || 'studio-1'}`;

    // Memoized Filter Logic
    const filteredEntries = useMemo(() => {
        try {
            return entries.filter(entry => {
                // Tab Filter
                const matchesTab = (() => {
                    if (activeTab === 'PENDING') return entry.status === 'PENDING';
                    if (activeTab === 'IN_PROGRESS') return entry.status === 'IN_PROGRESS' || entry.status === 'CONTACTED';
                    if (activeTab === 'COMPLETED') return entry.status === 'BOOKED' || entry.status === 'REJECTED';
                    return true;
                })();

                // Safe accessors for potentially missing fields
                const safeName = (entry.client_name || '').toLowerCase();
                const safeEmail = (entry.email || '').toLowerCase();
                const searchLower = searchTerm.toLowerCase();

                // Search Filter (Name/Email)
                const matchesSearch = searchTerm === '' ||
                    safeName.includes(searchLower) ||
                    safeEmail.includes(searchLower);

                // Style Filter
                const matchesStyle = styleFilter === '' ||
                    (entry.styles || []).some(s => s.toLowerCase().includes(styleFilter.toLowerCase()));

                // Date Filter
                const matchesDate = dateFilter === '' ||
                    (entry.created_at && new Date(entry.created_at).toISOString().split('T')[0] === dateFilter);

                // Interest Filter
                const matchesInterest = interestFilter === 'ALL' || entry.interest_type === interestFilter;

                return matchesTab && matchesSearch && matchesStyle && matchesDate && matchesInterest;
            }).sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return sortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
            });
        } catch (e) {
            console.error("Error filtering waitlist entries:", e);
            return [];
        }
    }, [entries, activeTab, searchTerm, dateFilter, styleFilter, interestFilter, sortOrder]);

    // Visible Entries for Pagination
    const visibleEntries = useMemo(() => {
        return filteredEntries.slice(0, visibleCount);
    }, [filteredEntries, visibleCount]);

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + ITEMS_PER_PAGE);
    };

    // Reset pagination and invalidate query when filters change significantly if needed
    // But mostly we just reset pagination
    React.useEffect(() => {
        setVisibleCount(ITEMS_PER_PAGE);
    }, [activeTab, searchTerm, dateFilter, styleFilter, interestFilter, sortOrder]);


    // Helper for Status Actions
    const renderActions = (entry: WaitlistEntry, isMobile = false) => {
        const getBtnClass = (color: 'blue' | 'green' | 'red') => {
            const base = "px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap";
            if (color === 'blue') return `${base} bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border-blue-500/20`;
            if (color === 'green') return `${base} bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/20`;
            if (color === 'red') return `${base} bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20`;
            return base;
        };

        const btnDefault =
            `px-3 py-1.5 bg-bg-tertiary hover:bg-white/10 text-text-muted hover:text-text-primary rounded-lg text-xs font-medium border border-border whitespace-nowrap`;

        return (
            <div className={clsx("flex items-center gap-2", isMobile ? "grid grid-cols-2 w-full" : "justify-end")}>
                {entry.status === 'PENDING' && (
                    <>
                        <button onClick={() => handleStatusUpdate(entry.id, 'IN_PROGRESS')} className={getBtnClass('blue')}>In Lavorazione</button>
                        <button onClick={() => handleStatusUpdate(entry.id, 'BOOKED')} className={getBtnClass('green')}>Completa</button>
                        <button onClick={() => handleStatusUpdate(entry.id, 'REJECTED')} className={getBtnClass('red')}>Rifiuta</button>
                    </>
                )}
                {(entry.status === 'IN_PROGRESS' || entry.status === 'CONTACTED') && (
                    <>
                        <button onClick={() => handleStatusUpdate(entry.id, 'BOOKED')} className={getBtnClass('green')}>Completa</button>
                        <button onClick={() => handleStatusUpdate(entry.id, 'PENDING')} className={btnDefault}>Attesa</button>
                        <button onClick={() => handleStatusUpdate(entry.id, 'REJECTED')} className={getBtnClass('red')}>Rifiuta</button>
                    </>
                )}
                {(entry.status === 'BOOKED' || entry.status === 'REJECTED') && (
                    <>
                        <button onClick={() => handleStatusUpdate(entry.id, 'IN_PROGRESS')} className={getBtnClass('blue')}>Riapri (Lavorazione)</button>
                        <button onClick={() => handleStatusUpdate(entry.id, 'PENDING')} className={btnDefault}>Riapri (Attesa)</button>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="w-full overflow-x-hidden pt-20 md:pt-8 p-4 md:p-8 relative">

            <div className="max-w-7xl mx-auto space-y-6 w-full min-w-0">

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-1 md:mb-2">Lista d'Attesa</h1>
                        <p className="text-sm text-text-muted">Gestisci le richieste di appuntamento in arrivo.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(publicLink);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            className="flex items-center gap-2 bg-bg-tertiary hover:bg-white/10 text-text-primary px-4 py-2 rounded-lg border border-border transition-colors text-sm"
                        >
                            {copied ? <Check size={18} className="text-green-500" /> : <Link size={18} />}
                            <span className="hidden sm:inline">{copied ? 'Copiato!' : 'Copia Link'}</span>
                        </button>
                        <button
                            onClick={() => setShowQr(!showQr)}
                            className="flex items-center gap-2 bg-bg-tertiary hover:bg-white/10 text-text-primary px-4 py-2 rounded-lg border border-border transition-colors text-sm"
                        >
                            <QrCode size={18} />
                            <span className="hidden sm:inline">{showQr ? 'Nascondi QR' : 'Mostra QR Code'}</span>
                            <span className="sm:hidden">{showQr ? 'Chiudi' : 'QR'}</span>
                        </button>
                    </div>
                </div>

                {/* Interest Type Filter (Tabs) */}
                <div className="flex justify-start border-b border-border/50 mb-4">
                    <button
                        onClick={() => setInterestFilter('ALL')}
                        className={clsx(
                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                            interestFilter === 'ALL' ? "border-text-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
                        )}
                    >
                        Tutti
                    </button>
                    <button
                        onClick={() => setInterestFilter('TATTOO')}
                        className={clsx(
                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                            interestFilter === 'TATTOO' ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-primary"
                        )}
                    >
                        <PenTool size={14} />
                        Tattoo
                    </button>
                    <button
                        onClick={() => setInterestFilter('ACADEMY')}
                        className={clsx(
                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                            interestFilter === 'ACADEMY' ? "border-purple-500 text-purple-500" : "border-transparent text-text-muted hover:text-text-primary"
                        )}
                    >
                        <span className="text-sm">🎓</span>
                        Academy
                    </button>
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
                <div className="xl:hidden mb-6">
                    <div className="relative bg-bg-secondary border border-border rounded-lg p-2">
                        <select
                            value={activeTab}
                            onChange={(e) => setActiveTab(e.target.value as any)}
                            className="w-full bg-transparent text-text-primary font-medium outline-none appearance-none p-2"
                        >
                            <option value="PENDING" className="bg-bg-secondary text-text-primary">
                                🕒 In Attesa ({entries.filter(e => e.status === 'PENDING').length})
                            </option>
                            <option value="IN_PROGRESS" className="bg-bg-secondary text-text-primary">
                                👤 In Lavorazione ({entries.filter(e => e.status === 'IN_PROGRESS' || e.status === 'CONTACTED').length})
                            </option>
                            <option value="COMPLETED" className="bg-bg-secondary text-text-primary">
                                ✅ Completati ({entries.filter(e => e.status === 'BOOKED' || e.status === 'REJECTED').length})
                            </option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                </div>

                {/* Desktop Tabs */}
                <div className="hidden xl:flex border-b border-border mb-6 w-full min-w-0">
                    <button
                        onClick={() => setActiveTab('PENDING')}
                        className={clsx(
                            'px-6 py-3 border-b-2 font-medium transition-colors flex items-center gap-2 text-sm',
                            activeTab === 'PENDING' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
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
                            activeTab === 'IN_PROGRESS' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
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
                            activeTab === 'COMPLETED' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
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
                            className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={clsx(
                            "flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors",
                            isFilterOpen
                                ? "bg-accent text-white border-accent"
                                : "bg-bg-secondary border-border text-text-muted hover:text-text-primary"
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
                                    className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary text-sm focus:border-accent focus:outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-text-muted mb-1 block">Stile Tatuaggio</label>
                                <select
                                    value={styleFilter}
                                    onChange={(e) => setStyleFilter(e.target.value)}
                                    className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary text-sm focus:border-accent focus:outline-none"
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
                                            sortOrder === 'ASC' ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                                        )}
                                    >
                                        <ArrowUpNarrowWide size={14} />
                                        Data Crescente
                                    </button>
                                    <button
                                        onClick={() => setSortOrder('DESC')}
                                        className={clsx(
                                            "px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1",
                                            sortOrder === 'DESC' ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary"
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
                                        queryClient.invalidateQueries({ queryKey: ['waitlist', user?.studio_id] });
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
                <div className="hidden xl:block bg-bg-secondary rounded-xl border border-border overflow-x-auto">
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
                            ) : visibleEntries.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-text-muted">Nessuna richiesta in questa sezione.</td></tr>
                            ) : (
                                visibleEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-bg-tertiary/50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="font-medium text-text-primary hover:text-accent cursor-pointer transition-colors" onClick={() => entry.client_id ? navigate(`/clients/${entry.client_id}`, { state: { fromWaitlist: true } }) : alert('Scheda cliente non disponibile')}>
                                                        {entry.client_name || 'Senza Nome'}
                                                    </div>
                                                    <div className="text-xs text-text-muted truncate max-w-[150px]">{entry.email}</div>
                                                    <div className="flex gap-1 mt-1">
                                                        {entry.interest_type === 'ACADEMY' ? (
                                                            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                                                                🎓 Academy
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20 flex items-center gap-1">
                                                                <PenTool size={10} /> Tattoo
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => entry.client_id ? navigate(`/clients/${entry.client_id}`, { state: { fromWaitlist: true } }) : alert('Scheda cliente non disponibile')}
                                                    className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-white/10 transition-colors"
                                                    title={entry.client_id ? "Vai alla scheda cliente" : "Scheda non disponibile"}
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

                                            {/* Notes Field */}
                                            <div className="mt-2">
                                                {editingNoteId === entry.id ? (
                                                    <div className="flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                                                        <textarea
                                                            value={noteText}
                                                            onChange={(e) => setNoteText(e.target.value)}
                                                            className="text-xs bg-bg-tertiary border border-border rounded p-1 w-full min-w-[200px] outline-none focus:border-red-500 text-red-500 font-medium"
                                                            placeholder="Scrivi una nota importante..."
                                                            rows={2}
                                                            autoFocus
                                                        />
                                                        <button onClick={() => handleSaveNote(entry.id)} className="p-1 hover:bg-green-500/10 text-green-500 rounded"><Save size={14} /></button>
                                                        <button onClick={() => setEditingNoteId(null)} className="p-1 hover:bg-red-500/10 text-red-500 rounded"><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => startEditingNote(entry)}
                                                        className={clsx(
                                                            "text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 group/note",
                                                            entry.notes ? "text-red-500 hover:text-red-400" : "text-text-muted hover:text-text-primary"
                                                        )}
                                                    >
                                                        <StickyNote size={12} className={entry.notes ? "fill-red-500/20" : ""} />
                                                        {entry.notes ? entry.notes : <span className="opacity-0 group-hover/note:opacity-100 transition-opacity">Aggiungi nota</span>}
                                                        {!entry.notes && <Edit3 size={10} className="opacity-0 group-hover/note:opacity-100" />}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-text-secondary">
                                            {new Date(entry.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            {renderActions(entry)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {/* Load More Button (Desktop) */}
                    {visibleCount < filteredEntries.length && (
                        <div className="p-4 flex justify-center border-t border-border">
                            <button
                                onClick={handleLoadMore}
                                className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-white/10 text-text-secondary rounded-lg text-sm transition-colors"
                            >
                                <ChevronDownCircle size={16} />
                                Carica altri ({filteredEntries.length - visibleCount})
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile Card View */}
                <div className="xl:hidden space-y-4">
                    {loading ? (
                        <div className="p-8 text-center text-text-muted">Caricamento...</div>
                    ) : visibleEntries.length === 0 ? (
                        <div className="p-8 text-center text-text-muted">Nessuna richiesta in questa sezione.</div>
                    ) : (
                        visibleEntries.map(entry => (
                            <div key={entry.id} className="bg-bg-secondary rounded-xl border border-border p-4 flex flex-col gap-3 min-w-0 w-full overflow-hidden">
                                <div className="flex justify-between items-start gap-2 min-w-0">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-bold text-text-primary text-lg truncate hover:text-accent cursor-pointer transition-colors" onClick={() => entry.client_id ? navigate(`/clients/${entry.client_id}`, { state: { fromWaitlist: true } }) : alert('Scheda cliente non disponibile')}>{entry.client_name || 'Senza Nome'}</h4>
                                        <p className="text-xs text-text-muted truncate">{entry.email}</p>
                                        <div className="flex gap-1 mt-1">
                                            {entry.interest_type === 'ACADEMY' ? (
                                                <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20 flex items-center gap-1 w-fit">
                                                    🎓 Academy
                                                </span>
                                            ) : (
                                                <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded border border-accent/20 flex items-center gap-1 w-fit">
                                                    <PenTool size={10} /> Tattoo
                                                </span>
                                            )}
                                        </div>
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

                                {/* Notes Section for Mobile */}
                                <div className="border-t border-border/50 pt-2">
                                    {editingNoteId === entry.id ? (
                                        <div className="flex gap-2 items-start">
                                            <textarea
                                                value={noteText}
                                                onChange={(e) => setNoteText(e.target.value)}
                                                className="text-sm bg-bg-tertiary border border-border rounded p-2 w-full outline-none focus:border-red-500 text-red-500 font-bold"
                                                placeholder="Nota importante..."
                                                rows={2}
                                            />
                                            <div className="flex flex-col gap-1">
                                                <button onClick={() => handleSaveNote(entry.id)} className="p-2 bg-green-500/10 text-green-500 rounded"><Save size={16} /></button>
                                                <button onClick={() => setEditingNoteId(null)} className="p-2 bg-red-500/10 text-red-500 rounded"><X size={16} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => startEditingNote(entry)}
                                            className={clsx(
                                                "p-2 rounded cursor-pointer transition-colors flex items-start gap-2",
                                                entry.notes ? "bg-red-500/5 border border-red-500/20" : "hover:bg-bg-tertiary"
                                            )}
                                        >
                                            <StickyNote size={16} className={clsx("mt-0.5", entry.notes ? "text-red-500 fill-red-500/20" : "text-text-muted")} />
                                            <div className="flex-1">
                                                {entry.notes ? (
                                                    <p className="text-sm font-bold text-red-500">{entry.notes}</p>
                                                ) : (
                                                    <p className="text-sm text-text-muted">Aggiungi una nota...</p>
                                                )}
                                            </div>
                                            <Edit3 size={14} className="text-text-muted mt-0.5" />
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-border mt-1">
                                    {renderActions(entry, true)}
                                </div>
                            </div>
                        ))
                    )}
                    {/* Load More Button (Mobile) */}
                    {visibleCount < filteredEntries.length && (
                        <div className="p-4 flex justify-center">
                            <button
                                onClick={handleLoadMore}
                                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-bg-tertiary hover:bg-white/10 text-text-secondary rounded-lg text-sm transition-colors border border-border"
                            >
                                <ChevronDownCircle size={16} />
                                Carica altri ({filteredEntries.length - visibleCount})
                            </button>
                        </div>
                    )}
                </div>

                {/* Undo Toast */}
                {undoAction && (
                    <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-black/90 text-white px-6 py-4 rounded-xl border border-white/10 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 z-50">
                        <div className="flex flex-col">
                            <span className="font-bold text-sm">Stato Aggiornato</span>
                            <span className="text-xs text-gray-400">Hai cambiato lo stato di una richiesta.</span>
                        </div>
                        <div className="h-8 w-px bg-white/20"></div>
                        <button
                            onClick={handleUndo}
                            className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                        >
                            Annulla
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
};
