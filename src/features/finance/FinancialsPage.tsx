import React, { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Filter,
    Download,
    Users,
    Trash2,
    CalendarClock,
    X,
    Pencil,
    Calendar,
    Wallet,
    Eye,
    EyeOff,
    ChevronLeft,
    ChevronRight,
    KeyRound
} from 'lucide-react';
import {
    addMonths,
    subMonths,
    addYears,
    subYears,
    addWeeks,
    subWeeks,
    startOfWeek,
    endOfWeek
} from 'date-fns';
import { api } from '../../services/api';
import type { Transaction, ArtistContract, User as StudioUser, RecurringExpense } from '../../services/types';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, isSameDay, isSameWeek, isSameMonth, isSameYear } from 'date-fns';
import { it } from 'date-fns/locale';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';
import { useLayoutStore } from '../../stores/layoutStore';
import { useRealtime } from '../../hooks/useRealtime';

export const FinancialsPage: React.FC = () => {
    const { user } = useAuth();
    const { isPrivacyMode } = useLayoutStore();
    const isOwner = user?.role?.toLowerCase() === 'owner' || user?.role?.toLowerCase() === 'manager';

    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<{
        revenue: number;
        expenses: number;
        net: number;
        revenueToday: number;
        revenueWeek: number;
        revenueMonth: number;
        revenueYear: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [monthStats, setMonthStats] = useState<number[]>(new Array(12).fill(0));

    // Owner Perspective State
    const [viewPerspective, setViewPerspective] = useState<'gross' | 'net'>('gross'); // 'gross' = Total Revenue, 'net' = Studio Share
    const [rawYearTransactions, setRawYearTransactions] = useState<Transaction[]>([]);

    // Filter Logic
    const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);

    // Recurring Expenses
    // Recurring Expenses
    const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    // Edit Transaction
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Privacy & History State
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [showSetPinModal, setShowSetPinModal] = useState(false);
    const [viewMode, setViewMode] = useState<'month' | 'year' | 'week' | 'custom'>('month');

    // Breakdown State
    const [team, setTeam] = useState<StudioUser[]>([]);
    const [contracts, setContracts] = useState<Record<string, ArtistContract>>({});
    const [producerStats, setProducerStats] = useState<any[]>([]);

    // Filter State
    const [dateRange, setDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
    });
    const [currentDateReference, setCurrentDateReference] = useState(new Date()); // Anchor for navigation
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, dateRange]);

    // Enable Realtime Updates
    useRealtime('transactions', () => {
        loadData();
    });

    useRealtime('recurring_expenses', () => {
        loadData();
    });

    // Re-process data when perspective changes
    useEffect(() => {
        if (rawYearTransactions.length > 0) {
            processData(rawYearTransactions, team, contracts);
        }
    }, [viewPerspective, rawYearTransactions, team, contracts, dateRange]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (!user) return;

            // 1. Fetch Transactions for the WHOLE YEAR (of the selected range)
            const yearStart = startOfYear(dateRange.start);
            const yearEnd = endOfYear(dateRange.start);
            const allTxs = await api.financials.listTransactions(yearStart, yearEnd, user.studio_id);

            // 2. Fetch Team & Contracts (if Owner/Manager)
            const userRole = user.role?.toLowerCase();
            let teamMembers: StudioUser[] = [];
            let contractsMap: Record<string, ArtistContract> = {};

            if (userRole === 'owner' || userRole === 'manager') {
                // Fetch Team
                teamMembers = await api.settings.listTeamMembers(user.studio_id!);
                setTeam(teamMembers);

                // Fetch Contracts for all Artists
                const artists = teamMembers.filter(m => m.role?.toLowerCase() === 'artist');
                await Promise.all(artists.map(async (artist) => {
                    const contract = await api.artists.getContract(artist.id);
                    if (contract) {
                        contractsMap[artist.id] = contract;
                    }
                }));
                contractsMap['studio'] = { commission_rate: 0 } as any; // Dummy for Studio
                setContracts(contractsMap);

                // Fetch Recurring Expenses
                const rec = await api.financials.listRecurringExpenses(user.studio_id!);
                setRecurringExpenses(rec);
            } else if (userRole === 'artist') {
                // Fetch own contract
                const contract = await api.artists.getContract(user.id);
                if (contract) contractsMap[user.id] = contract;
                setContracts(contractsMap);
            }
            // 3. Store Raw Data & Process
            setRawYearTransactions(allTxs);
            // Processing happens in useEffect due to dependency on state

        } catch (error) {
            console.error("Failed to load financials:", error);
        } finally {
            setLoading(false);
        }
    };

    const processData = (allTxs: Transaction[], teamMembers: StudioUser[], contractsMap: Record<string, ArtistContract>) => {
        const userRole = user?.role?.toLowerCase();

        // 3. Process Data for Chart (Yearly Trend)
        const monthlyData = new Array(12).fill(0);
        allTxs.forEach(tx => {
            if (tx.type === 'INCOME') {
                const month = new Date(tx.date).getMonth(); // 0-11
                let amount = tx.amount;

                // Logic for Value based on Role & Perspective
                if (userRole === 'artist') {
                    // Artist always sees commission
                    if (tx.artist_id === user?.id) {
                        const rate = contractsMap[user?.id || '']?.commission_rate || 50;
                        amount = (tx.amount * rate / 100);
                    } else {
                        amount = 0;
                    }
                } else {
                    // Owner/Manager
                    if (viewPerspective === 'net') {
                        // Net = Gross - Artist Commission
                        if (tx.artist_id && contractsMap[tx.artist_id]) {
                            const rate = contractsMap[tx.artist_id].commission_rate || 50;
                            const comm = tx.amount * (rate / 100);
                            amount = tx.amount - comm;
                        } else if (tx.artist_id) {
                            // Default 50% if no contract
                            amount = tx.amount * 0.5;
                        }
                    }
                    // If 'gross', amount is full tx.amount (default)
                }

                monthlyData[month] += amount;
            }
        });
        setMonthStats(monthlyData);

        // 4. Filter Transactions for Selected Range (for Table & Cards)
        const filteredTxs = allTxs.filter(tx =>
            isWithinInterval(new Date(tx.date), { start: dateRange.start, end: dateRange.end })
        );

        // If Artist, filter only own transactions
        const displayTxs = userRole === 'artist'
            ? filteredTxs.filter(tx => tx.artist_id === user?.id)
            : filteredTxs;

        setTransactions(displayTxs);

        // 5. Calculate Stats & Breakdown
        let totalRev = 0; // This will respect perspective
        let totalExp = 0;
        let totalNet = 0; // Studio Net (Rev - Comm - Exp)

        // Setup breakdown map (Artists Only)
        const breakdown: Record<string, { id: string; name: string; gross: number; net: number; comm: number }> = {};
        teamMembers
            .filter(m => m.role?.toLowerCase() === 'artist')
            .forEach(m => {
                breakdown[m.id] = { id: m.id, name: m.full_name, gross: 0, net: 0, comm: 0 };
            });

        displayTxs.forEach(tx => {
            if (tx.type === 'EXPENSE') {
                totalExp += tx.amount;
            } else if (tx.type === 'INCOME') {
                const amount = tx.amount;

                // Calculate Commission
                let commission = 0;
                if (tx.artist_id && contractsMap[tx.artist_id]) {
                    const rate = contractsMap[tx.artist_id].commission_rate || 50;
                    commission = amount * (rate / 100); // Portion going to Artist
                } else if (tx.artist_id) {
                    commission = amount * 0.5; // Default 50%
                }

                if (userRole === 'artist') {
                    // Artist View: Revenue = Commission
                    totalRev += commission;
                } else {
                    // Studio View
                    // Logic depends on Perspective for "Revenue" stats
                    if (viewPerspective === 'gross') {
                        totalRev += amount;
                    } else {
                        // Net Perspective: Revenue = Studio Share
                        totalRev += (amount - commission);
                    }

                    totalNet += (amount - commission); // Net is always Net

                    // Update Breakdown (Only if in map - i.e. is Artist)
                    const producerId = tx.artist_id || 'studio';
                    if (breakdown[producerId]) {
                        breakdown[producerId].gross += amount;
                        breakdown[producerId].comm += commission;
                        breakdown[producerId].net += (amount - commission);
                    }
                }
            }
        });

        if (userRole !== 'artist') {
            totalNet -= totalExp; // Deduct expenses from Studio Net
        }

        // Calculate Granular Stats (Relative to Selected Period)
        const referenceDate = dateRange.end;

        let revToday = 0;
        let revWeek = 0;
        let revMonth = 0;
        let revYear = 0;

        allTxs.forEach(tx => {
            if (tx.type === 'INCOME') {
                const txDate = new Date(tx.date);
                let val = tx.amount;

                // Logic for Value based on Role & Perspective
                if (userRole === 'artist') {
                    if (tx.artist_id === user?.id) {
                        const rate = contractsMap[user?.id || '']?.commission_rate || 50;
                        val = (tx.amount * rate / 100);
                    } else {
                        val = 0;
                    }
                } else {
                    // Owner
                    if (viewPerspective === 'net') {
                        if (tx.artist_id && contractsMap[tx.artist_id]) {
                            const rate = contractsMap[tx.artist_id].commission_rate || 50;
                            const comm = tx.amount * (rate / 100);
                            val = tx.amount - comm;
                        } else if (tx.artist_id) {
                            val = tx.amount * 0.5;
                        }
                    }
                }

                if (val > 0) {
                    // "Today" - check if transaction is on ACTUAL Today
                    if (isSameDay(txDate, new Date())) revToday += val;

                    // Week/Month/Year relative to selection
                    if (isSameWeek(txDate, referenceDate, { locale: it })) revWeek += val;
                    if (isSameMonth(txDate, referenceDate)) revMonth += val;
                    if (isSameYear(txDate, referenceDate)) revYear += val;
                }
            }
        });

        setStats({
            revenue: totalRev,
            expenses: totalExp,
            net: totalNet,
            revenueToday: revToday,
            revenueWeek: revWeek,
            revenueMonth: revMonth,
            revenueYear: revYear
        });

        // Convert Breakdown Map to Array
        setProducerStats(Object.values(breakdown).sort((a, b) => b.gross - a.gross));




    };

    const handleExport = () => {
        if (transactions.length === 0) {
            alert('Nessuna transazione da esportare.');
            return;
        }

        const headers = ["Data", "Categoria", "Descrizione", "Tipo", "Importo", "Quota Studio", "Quota Artista"];
        const csvContent = [
            headers.join(','),
            ...transactions.map(tx => {
                const commissionRate = (tx.artist_id && contracts[tx.artist_id]?.commission_rate) || 50;
                const artistShare = tx.type === 'INCOME' ? (tx.amount * commissionRate / 100) : 0;
                const studioShare = tx.type === 'INCOME' ? (tx.amount - artistShare) : 0;

                return [
                    format(new Date(tx.date), 'yyyy-MM-dd'),
                    `"${tx.category}"`,
                    `"${tx.description || ''}"`,
                    tx.type,
                    tx.amount.toFixed(2),
                    studioShare.toFixed(2),
                    artistShare.toFixed(2)
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `financials_export.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const formatCurrency = (amount: number) => {
        // If Privacy Mode (Global) is on OR locally locked
        if (isPrivacyMode || (!isUnlocked && !isPrivacyMode)) return '••••••';
        // Wait, logic: user wants "hide and show with password".
        // If locked -> hidden. If unlocked -> visible.
        // Let's rely on local `isUnlocked`.
        if (!isUnlocked) return '••••••';
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    // Navigation Handlers
    const handlePrev = () => {
        let newDate = new Date(currentDateReference);
        if (viewMode === 'month') newDate = subMonths(newDate, 1);
        else if (viewMode === 'year') newDate = subYears(newDate, 1);
        else if (viewMode === 'week') newDate = subWeeks(newDate, 1);

        setCurrentDateReference(newDate);
        updateDateRange(newDate, viewMode);
    };

    const handleNext = () => {
        let newDate = new Date(currentDateReference);
        if (viewMode === 'month') newDate = addMonths(newDate, 1);
        else if (viewMode === 'year') newDate = addYears(newDate, 1);
        else if (viewMode === 'week') newDate = addWeeks(newDate, 1);

        setCurrentDateReference(newDate);
        updateDateRange(newDate, viewMode);
    };

    const updateDateRange = (refDate: Date, mode: string) => {
        let start = startOfMonth(refDate);
        let end = endOfMonth(refDate);

        if (mode === 'year') {
            start = startOfYear(refDate);
            end = endOfYear(refDate);
        } else if (mode === 'week') {
            start = startOfWeek(refDate, { locale: it });
            end = endOfWeek(refDate, { locale: it });
        }

        setDateRange({ start, end });
    };

    const handleViewModeChange = (mode: 'month' | 'year' | 'week') => {
        setViewMode(mode);
        updateDateRange(currentDateReference, mode);
    };

    // Privacy Handlers
    const handleTogglePrivacy = () => {
        if (isUnlocked) {
            setIsUnlocked(false);
        } else {
            // Check if user has PIN
            if (user?.privacy_pin) {
                setShowUnlockModal(true);
            } else {
                setShowSetPinModal(true);
            }
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questa transazione?')) return;
        try {
            await api.financials.deleteTransaction(id);
            loadData();
        } catch (error) {
            console.error("Error deleting transaction:", error);
            alert("Errore durante l'eliminazione.");
        }
    };

    const handleSaveExpense = async (data: any) => {
        if (!user?.studio_id) return;
        try {
            const amount = parseFloat(data.amount);

            // 1. Create the Transaction (Immediate Expense)
            if (data.createTransaction) {
                await api.financials.createTransaction({
                    studio_id: user.studio_id,
                    amount: amount,
                    type: 'EXPENSE',
                    category: data.category,
                    date: new Date(data.date).toISOString(),
                    description: data.description
                });
            }

            // 2. Create Recurring Entry if requested
            if (data.isRecurring) {
                await api.financials.createRecurringExpense({
                    studio_id: user.studio_id,
                    name: data.description || 'Spesa Fissa',
                    amount: amount,
                    category: data.category,
                    day_of_month: parseInt(data.dayOfMonth)
                });
            }

            loadData();
            setIsExpenseModalOpen(false);
        } catch (error) {
            console.error("Error saving expense:", error);
            alert("Errore durante il salvataggio della spesa.");
        }
    };

    const handleDeleteRecurring = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questa spesa fissa? Le transazioni passate rimarranno.')) return;
        try {
            await api.financials.deleteRecurringExpense(id);
            loadData();
        } catch (error) {
            console.error("Error deleting recurring expense:", error);
        }
    };

    const handleGenerateRecurring = async () => {
        if (!user?.studio_id) return;
        if (!confirm('Generare le transazioni per le spese fisse di questo mese?')) return;
        try {
            await api.financials.generateRecurringTransactions(user.studio_id, new Date());
            loadData();
            alert('Spese generate con successo.');
        } catch (error) {
            console.error("Error generating recurring:", error);
        }
    };

    const handleUpdateTransaction = async (id: string, data: Partial<Transaction>) => {
        try {
            await api.financials.updateTransaction(id, data);
            setEditingTransaction(null);
            loadData();
        } catch (error) {
            console.error("Failed to update transaction:", error);
            alert("Errore durante l'aggiornamento della transazione.");
        }
    };

    // Derived filtered transactions based on click interaction
    const visibleTransactions = React.useMemo(() => {
        if (!selectedProducerId) return transactions;
        if (selectedProducerId === 'studio') {
            return transactions.filter(tx => !tx.artist_id); // Studio ones
        }
        return transactions.filter(tx => tx.artist_id === selectedProducerId);
    }, [transactions, selectedProducerId]);


    if (!user) return null;

    return (
        <div className="w-full p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">
                        {isOwner ? 'Finanze Studio' : 'Le Tue Finanze'}
                    </h1>
                    <p className="text-text-muted">
                        {isOwner
                            ? 'Monitora entrate, uscite e andamento dello studio.'
                            : 'Monitora i tuoi guadagni e le commissioni.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Perspective Toggle (Owner Only) */}
                    {isOwner && (
                        <div className="flex bg-bg-tertiary p-1 rounded-lg border border-border">
                            <button
                                onClick={() => setViewPerspective('gross')}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                    viewPerspective === 'gross' ? "bg-accent text-white shadow" : "text-text-muted hover:text-text-primary"
                                )}
                            >
                                Totale Studio
                            </button>
                            <button
                                onClick={() => setViewPerspective('net')}
                                className={clsx(
                                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                    viewPerspective === 'net' ? "bg-accent text-white shadow" : "text-text-muted hover:text-text-primary"
                                )}
                            >
                                Netto Studio
                            </button>
                        </div>
                    )}

                    {/* Privacy Toggle */}
                    <button
                        onClick={handleTogglePrivacy}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border",
                            isUnlocked
                                ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                                : "bg-accent/10 text-accent border-accent/20 hover:bg-accent/20"
                        )}
                        title={isUnlocked ? "Nascondi Importi" : "Mostra Importi"}
                    >
                        {isUnlocked ? <EyeOff size={18} /> : <Eye size={18} />}
                        <span className="hidden lg:inline">{isUnlocked ? 'Nascondi' : 'Mostra'}</span>
                    </button>

                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={clsx(
                            "flex items-center gap-2 border hover:bg-white/5 px-4 py-2 rounded-lg font-medium transition-colors",
                            isFilterOpen ? "bg-accent border-accent text-white" : "bg-bg-secondary border-border text-text-primary"
                        )}
                    >
                        <Filter size={18} />
                        <span>Filtra</span>
                    </button>
                    {isOwner && (
                        <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg font-medium transition-colors border border-red-500/20"
                        >
                            <DollarSign size={18} />
                            <span className="hidden lg:inline">Nuova Spesa</span>
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary px-4 py-2 rounded-lg font-medium transition-colors border border-border"
                    >
                        <Download size={18} />
                        <span className="hidden lg:inline">Esporta Report</span>
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {/* Filter Panel & History Navigation */}
            {isFilterOpen && (
                <div className="bg-bg-secondary p-4 rounded-lg border border-border animate-in fade-in slide-in-from-top-2 space-y-4">





                    <div className="border-t border-border pt-4 mt-2">
                        <p className="text-xs text-text-muted mb-2 text-center uppercase tracking-wider">Intervallo Personalizzato</p>
                        <div className="flex flex-col md:flex-row gap-4 items-end justify-center">
                            <div className="w-full md:w-auto">
                                <label className="block text-xs text-text-muted mb-1">Data Inizio</label>
                                <input
                                    type="date"
                                    value={format(dateRange.start, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setViewMode('custom');
                                            setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }));
                                        }
                                    }}
                                    className="bg-bg-tertiary border border-border text-text-primary text-sm rounded-lg p-2.5 outline-none focus:border-accent w-full"
                                />
                            </div>
                            <div className="w-full md:w-auto">
                                <label className="block text-xs text-text-muted mb-1">Data Fine</label>
                                <input
                                    type="date"
                                    value={format(dateRange.end, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setViewMode('custom');
                                            setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }));
                                        }
                                    }}
                                    className="bg-bg-tertiary border border-border text-text-primary text-sm rounded-lg p-2.5 outline-none focus:border-accent w-full"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Always Visible Navigation Bar */}
            <div className="bg-bg-secondary p-4 rounded-lg border border-border flex flex-col md:flex-row items-center justify-between gap-4">
                {/* View Mode Switcher */}
                <div className="flex bg-bg-tertiary p-1 rounded-lg">
                    {(['week', 'month', 'year'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => handleViewModeChange(m)}
                            className={clsx(
                                "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
                                viewMode === m ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            {m === 'week' ? 'Settimana' : m === 'month' ? 'Mese' : 'Anno'}
                        </button>
                    ))}
                </div>

                {/* Date Controls */}
                <div className="flex items-center gap-4">
                    <button onClick={handlePrev} className="p-2 hover:bg-white/10 rounded-full text-text-primary">
                        <ChevronLeft size={24} />
                    </button>

                    <div className="text-center min-w-[200px]">
                        <h3 className="text-lg font-bold text-text-primary capitalize">
                            {viewMode === 'month' && format(currentDateReference, 'MMMM yyyy', { locale: it })}
                            {viewMode === 'year' && format(currentDateReference, 'yyyy', { locale: it })}
                            {viewMode === 'week' && `Settimana ${format(dateRange.start, 'd MMM')} - ${format(dateRange.end, 'd MMM')}`}
                        </h3>
                    </div>

                    <button onClick={handleNext} className="p-2 hover:bg-white/10 rounded-full text-text-primary">
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            {/* Main Stats Cards */}
            {/* NEW STATS CARDS (4 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-bg-secondary p-5 rounded-lg border border-border">
                    <p className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1">Oggi (Live)</p>
                    <div className="flex justify-between items-end">
                        <h3 className="text-2xl font-bold text-text-primary">{stats ? formatCurrency(stats.revenueToday) : '-'}</h3>
                        <div className="text-accent/20"><CalendarClock size={24} /></div>
                    </div>
                </div>
                <div className="bg-bg-secondary p-5 rounded-lg border border-border">
                    <p className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1">
                        Settimana {viewMode === 'week' ? 'Corrente' : ''}
                    </p>
                    <div className="flex justify-between items-end">
                        <h3 className="text-2xl font-bold text-text-primary">{stats ? formatCurrency(stats.revenueWeek) : '-'}</h3>
                        <div className="text-accent/20"><Calendar size={24} /></div>
                    </div>
                </div>
                <div className="bg-bg-secondary p-5 rounded-lg border border-border">
                    <p className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1">
                        Mese: {format(currentDateReference, 'MMMM', { locale: it })}
                    </p>
                    <div className="flex justify-between items-end">
                        <h3 className="text-2xl font-bold text-text-primary">{stats ? formatCurrency(stats.revenueMonth) : '-'}</h3>
                        <div className="text-accent/20"><Wallet size={24} /></div>
                    </div>
                </div>
                <div className="bg-bg-secondary p-5 rounded-lg border border-border">
                    <p className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1">
                        Anno: {format(currentDateReference, 'yyyy')}
                    </p>
                    <div className="flex justify-between items-end">
                        <h3 className="text-2xl font-bold text-text-primary">{stats ? formatCurrency(stats.revenueYear) : '-'}</h3>
                        <div className="text-accent/20"><TrendingUp size={24} /></div>
                    </div>
                </div>
            </div>

            {/* EXPENSES & NET (Secondary Row) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-bg-secondary p-5 rounded-lg border border-border flex justify-between items-center">
                    <div>
                        <p className="text-text-muted text-sm font-medium">Uscite Totali (Mese)</p>
                        <h3 className="text-xl font-bold text-text-primary">{stats ? formatCurrency(stats.expenses) : '-'}</h3>
                    </div>
                    <div className="p-2 bg-red-500/10 text-red-500 rounded-lg"><TrendingDown size={20} /></div>
                </div>
                <div className="bg-bg-secondary p-5 rounded-lg border border-border flex justify-between items-center">
                    <div>
                        <p className="text-text-muted text-sm font-medium">{isOwner ? 'Utile Netto (Mese)' : 'Netto Stimato (Mese)'}</p>
                        <h3 className={clsx("text-xl font-bold", (stats?.net || 0) >= 0 ? "text-accent" : "text-red-500")}>
                            {stats ? formatCurrency(stats.net) : '-'}
                        </h3>
                    </div>
                    <div className="p-2 bg-accent/10 text-accent rounded-lg"><DollarSign size={20} /></div>
                </div>
            </div>

            {/* Content Switcher: Breakdown vs Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Production Breakdown (Owner Only) - Left Side */}
                {isOwner && (
                    <div className="lg:col-span-1 bg-bg-secondary rounded-lg border border-border flex flex-col">
                        <div className="p-4 border-b border-border flex items-center gap-2">
                            <Users size={18} className="text-accent" />
                            <h3 className="font-bold text-text-primary">Dettaglio Produzione</h3>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4 max-h-[400px]">
                            {producerStats.length === 0 ? (
                                <p className="text-sm text-text-muted text-center py-4">Nessun dato per il periodo.</p>
                            ) : (
                                producerStats.map((p, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedProducerId(selectedProducerId === p.id ? null : p.id)} // Toggle filter
                                        className={clsx(
                                            "flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition-all",
                                            selectedProducerId === p.id
                                                ? "bg-accent/10 border-accent"
                                                : "bg-bg-tertiary border-border/50 hover:border-accent/50"
                                        )}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-text-primary">{p.name}</span>
                                            <span className="text-xs text-text-muted bg-white/5 px-2 py-0.5 rounded">
                                                {formatCurrency(p.gross)} Lordi
                                            </span>
                                        </div>
                                        <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden mt-1 mb-1">
                                            <div className="bg-accent h-full" style={{ width: p.gross > 0 ? `${(p.net / p.gross) * 100}%` : '0%' }}></div>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-text-muted">Quota Studio: <span className="text-green-500">{formatCurrency(p.net)}</span></span>
                                            <span className="text-text-muted">Artista: <span className="text-orange-400">{formatCurrency(p.comm)}</span></span>
                                        </div>
                                        <div className="text-[10px] text-text-muted text-right italic mt-1">
                                            Clicca per dettagli
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Yearly Trend Chart - Right Side (Takes more space) */}
                <div className={clsx("bg-bg-secondary p-6 rounded-lg border border-border", isOwner ? "lg:col-span-2" : "lg:col-span-3")}>
                    <h3 className="text-lg font-bold text-text-primary mb-6">
                        {isOwner
                            ? (viewPerspective === 'gross' ? 'Andamento Fatturato Totale' : 'Andamento Netto Studio')
                            : 'I Tuoi Guadagni (Anno Corrente)'}
                    </h3>
                    <div className="relative">
                        <div className="h-64 flex items-end justify-between gap-1 md:gap-2 px-2">
                            {monthStats.map((val, i) => {
                                const maxVal = Math.max(...monthStats, 1);
                                const height = `${(val / maxVal) * 100}%`;
                                return (
                                    <div key={i} className="w-full flex-1 flex flex-col justify-end items-center h-full group">
                                        <div className="w-full bg-bg-tertiary hover:bg-accent/80 transition-all rounded-t-sm relative" style={{ height: height === '0%' ? '1px' : height }}>
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none">
                                                {formatCurrency(val)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-between mt-4 text-[10px] md:text-xs text-text-muted px-2 uppercase tracking-wider">
                            {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'].map((m, i) => (
                                <span key={m} className={clsx("w-full text-center", i % 2 !== 0 && "hidden sm:block")}>{m.substring(0, 3)}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Transactions Table WITH FILTERING */}
            <div className="bg-bg-secondary rounded-lg border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h3 className="text-lg font-bold text-text-primary">
                        Transazioni
                        {selectedProducerId && <span className="text-accent ml-2 text-sm">(Filtrato: {producerStats.find(p => p.id === selectedProducerId)?.name || 'Studio'})</span>}
                    </h3>
                    {selectedProducerId && (
                        <button onClick={() => setSelectedProducerId(null)} className="text-sm text-red-400 hover:text-red-300">Resetta Filtri</button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-bg-tertiary">
                            <tr className="text-sm text-text-muted font-medium border-b border-border">
                                <th className="px-6 py-3">Data</th>
                                <th className="px-6 py-3">Descrizione</th>
                                <th className="px-6 py-3">Operatore</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3 text-right">Importo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-muted">Caricamento transazioni...</td></tr>
                            ) : visibleTransactions.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-muted">Nessuna transazione trovata nel periodo.</td></tr>
                            ) : (
                                visibleTransactions.map(tx => {
                                    // Calculate display amount for Artists
                                    let displayAmount = tx.amount;
                                    let isCommission = false;

                                    if (!isOwner && tx.type === 'INCOME') {
                                        // If viewing as artist (already filtered by user.id in loadData)
                                        // We show only the SHARE
                                        const rate = contracts[user.id]?.commission_rate || 50;
                                        displayAmount = (tx.amount * rate / 100);
                                        isCommission = true;
                                    }

                                    return (
                                        <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-sm text-text-secondary">
                                                {format(new Date(tx.date), 'dd MMM yyyy', { locale: it })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-text-primary">{tx.category}</div>
                                                {tx.description && <div className="text-xs text-text-muted">{tx.description}</div>}
                                                {isCommission && <div className="text-[10px] text-accent mt-0.5">La tua commissione (Prezzo intero: {formatCurrency(tx.amount)})</div>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-text-secondary">
                                                {/* Try to resolve artist name from team array */}
                                                {tx.artist_id ? (team.find(m => m.id === tx.artist_id)?.full_name || 'Artista') : 'Studio'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={clsx(
                                                    "text-xs px-2 py-1 rounded font-medium",
                                                    tx.type === 'INCOME' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                                )}>
                                                    {tx.type === 'INCOME' ? 'ENTRATA' : 'USCITA'}
                                                </span>
                                            </td>
                                            <td className={clsx(
                                                "px-6 py-4 text-right font-medium",
                                                tx.type === 'INCOME' ? "text-green-500" : "text-text-primary"
                                            )}>
                                                <div className="flex items-center justify-end gap-3">
                                                    <span>{tx.type === 'EXPENSE' ? '-' : '+'}{formatCurrency(displayAmount)}</span>
                                                    {isOwner && (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => setEditingTransaction(tx)}
                                                                className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-colors"
                                                                title="Modifica"
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                                className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                                title="Elimina Transazione"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* OWNER TOTALS FOOTER (Fatturato Lordo moved here) */}
            {isOwner && (
                <div className="bg-bg-tertiary p-6 rounded-lg border border-border flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h4 className="text-lg font-bold text-text-primary">Riepilogo Totale Periodo</h4>
                        <p className="text-sm text-text-muted">Somma di tutte le entrate lorde, incluse le quote artisti.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="block text-sm text-text-muted">Fatturato Lordo</span>
                            <span className="text-2xl font-bold text-text-primary">{stats ? formatCurrency(stats.revenue) : '-'}</span>
                        </div>
                    </div>
                </div>
            )}


            {/* Expenses Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-bg-secondary rounded-xl border border-border w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold text-text-primary">Gestione Spese</h3>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-text-muted hover:text-text-primary">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto">
                            <ExpenseForm
                                onSave={handleSaveExpense}
                                recurringExpenses={recurringExpenses}
                                onDeleteRecurring={handleDeleteRecurring}
                                onGenerateRecurring={handleGenerateRecurring}
                            />
                        </div>
                    </div>
                </div>
            )}
            {/* Edit Transaction Modal */}
            {editingTransaction && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-bg-secondary rounded-xl border border-border w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold text-text-primary">Modifica Transazione</h3>
                            <button onClick={() => setEditingTransaction(null)} className="text-text-muted hover:text-text-primary">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4">
                            <EditTransactionForm
                                transaction={editingTransaction}
                                onSave={(data) => handleUpdateTransaction(editingTransaction.id, data)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Modals */}
            {showUnlockModal && user && (
                <PinModal
                    title="Inserisci PIN Privacy"
                    type="verify"
                    user={{ ...user }}
                    onClose={() => setShowUnlockModal(false)}
                    onSuccess={() => {
                        setShowUnlockModal(false);
                        setIsUnlocked(true);
                    }}
                />
            )}

            {showSetPinModal && user && (
                <PinModal
                    title="Crea il tuo PIN Privacy"
                    type="create"
                    user={{ ...user }}
                    onClose={() => setShowSetPinModal(false)}
                    onSuccess={(newPin) => {
                        // Manually update local user object's privacy_pin to avoid reload
                        user.privacy_pin = newPin;
                        setShowSetPinModal(false);
                        setIsUnlocked(true);
                        alert('PIN impostato con successo! Ora puoi vedere i dati.');
                    }}
                />
            )}
        </div>
    );
};

const EditTransactionForm = ({ transaction, onSave }: { transaction: Transaction, onSave: (data: Partial<Transaction>) => void }) => {
    const [formData, setFormData] = useState({
        amount: transaction.amount,
        date: transaction.date.split('T')[0],
        description: transaction.description || '',
        category: transaction.category
    });

    const categories = ['Service', 'Affitto', 'Utenze', 'Materiali', 'Software', 'Marketing', 'Manutenzione', 'Altro'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            amount: Number(formData.amount),
            date: new Date(formData.date).toISOString(),
            description: formData.description,
            category: formData.category
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm text-text-muted mb-1">Importo (€)</label>
                <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                />
            </div>
            <div>
                <label className="block text-sm text-text-muted mb-1">Data</label>
                <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                />
            </div>
            <div>
                <label className="block text-sm text-text-muted mb-1">Categoria</label>
                <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                >
                    {!categories.includes(transaction.category) && <option value={transaction.category}>{transaction.category}</option>}
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm text-text-muted mb-1">Descrizione</label>
                <input
                    type="text"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                />
            </div>
            <button type="submit" className="w-full bg-accent hover:bg-accent/80 text-white font-bold py-3 rounded-lg transition-colors">
                Salva Modifiche
            </button>
        </form>
    );
};

const PinModal = ({ title, type, onClose, onSuccess, user }: { title: string, type: 'create' | 'verify', onClose: () => void, onSuccess: (pin: string) => void, user: any }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (pin.length < 4) {
            setError('Il PIN deve essere di almeno 4 cifre.');
            return;
        }

        setLoading(true);
        try {
            if (type === 'create') {
                await api.settings.setPrivacyPin(user.id, pin);
                onSuccess(pin);
            } else {
                // Verify
                if (pin === user.privacy_pin) {
                    onSuccess(pin);
                } else {
                    setError('PIN non corretto.');
                }
            }
        } catch (err) {
            console.error(err);
            setError('Si è verificato un errore.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-bg-secondary p-6 rounded-xl border border-border w-full max-w-sm">
                <div className="text-center mb-6">
                    <div className="mx-auto w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent mb-3">
                        <KeyRound size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-text-primary">{title}</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        placeholder="Inserisci PIN"
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        className="w-full text-center text-2xl tracking-[0.5em] bg-bg-tertiary border border-border rounded-lg p-4 text-text-primary focus:border-accent outline-none font-mono"
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-text-muted hover:text-text-primary transition-colors">
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-accent hover:bg-accent/80 text-white px-4 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Attendere...' : 'Conferma'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};



const ExpenseForm = ({ onSave, recurringExpenses, onDeleteRecurring, onGenerateRecurring }: any) => {
    const [tab, setTab] = useState<'new' | 'recurring'>('new');
    const [formData, setFormData] = useState({
        amount: '',
        description: '',
        category: 'Affitto',
        date: new Date().toISOString().split('T')[0],
        isRecurring: false,
        dayOfMonth: '1'
    });

    const categories = ['Affitto', 'Utenze', 'Materiali', 'Software', 'Marketing', 'Manutenzione', 'Altro'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            createTransaction: true // Always create transaction for "New Expense"
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2 p-1 bg-bg-tertiary rounded-lg">
                <button
                    onClick={() => setTab('new')}
                    className={clsx("flex-1 py-2 text-sm font-medium rounded-md transition-colors", tab === 'new' ? "bg-accent text-white" : "text-text-muted hover:text-text-primary")}
                >
                    Nuova Spesa
                </button>
                <button
                    onClick={() => setTab('recurring')}
                    className={clsx("flex-1 py-2 text-sm font-medium rounded-md transition-colors", tab === 'recurring' ? "bg-accent text-white" : "text-text-muted hover:text-text-primary")}
                >
                    Spese Fisse ({recurringExpenses.length})
                </button>
            </div>

            {tab === 'new' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-text-muted mb-1">Importo (€)</label>
                        <input
                            type="number"
                            step="0.01"
                            required
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                            placeholder="0.00"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-text-muted mb-1">Data</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-text-muted mb-1">Categoria</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-text-muted mb-1">Descrizione</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                            placeholder="Es. Bolletta Luce"
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-bg-tertiary/50">
                        <input
                            type="checkbox"
                            checked={formData.isRecurring}
                            onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })}
                            className="w-5 h-5 accent-accent"
                        />
                        <div className="flex-1">
                            <div className="text-sm font-medium text-text-primary">Rendi spesa fissa mensile</div>
                            <div className="text-xs text-text-muted">Creerà automaticamente una voce tra le spese fisse.</div>
                        </div>
                    </div>

                    {formData.isRecurring && (
                        <div>
                            <label className="block text-sm text-text-muted mb-1">Giorno del mese in cui si ripete</label>
                            <select
                                value={formData.dayOfMonth}
                                onChange={e => setFormData({ ...formData, dayOfMonth: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-text-primary focus:border-accent outline-none"
                            >
                                {[...Array(28)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}° del mese</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors">
                            Salva Spesa
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="bg-bg-tertiary p-4 rounded-lg border border-border">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold text-text-primary">Generazione Automatica</h4>
                            <button
                                onClick={onGenerateRecurring}
                                className="text-xs bg-accent hover:bg-accent/80 text-white px-3 py-1.5 rounded flex items-center gap-1"
                            >
                                <CalendarClock size={14} /> Genera per questo mese
                            </button>
                        </div>
                        <p className="text-xs text-text-muted">
                            Puoi generare automaticamente le transazioni di spesa per tutte le voci fisse qui sotto.
                        </p>
                    </div>

                    <div className="space-y-2">
                        {recurringExpenses.length === 0 ? (
                            <p className="text-center text-text-muted py-4">Nessuna spesa fissa configurata.</p>
                        ) : (
                            recurringExpenses.map((rec: any) => (
                                <div key={rec.id} className="flex justify-between items-center p-3 bg-bg-tertiary rounded-lg border border-border group">
                                    <div>
                                        <div className="font-medium text-text-primary">{rec.name}</div>
                                        <div className="text-xs text-text-muted">
                                            {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(rec.amount)}
                                            • {rec.category} • Ogni {rec.day_of_month}° del mese
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onDeleteRecurring(rec.id)}
                                        className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
