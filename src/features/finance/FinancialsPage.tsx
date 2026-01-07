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
    X
} from 'lucide-react';
import { api } from '../../services/api';
import type { Transaction, ArtistContract, User as StudioUser, RecurringExpense } from '../../services/types';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';
import { useLayoutStore } from '../../stores/layoutStore';

export const FinancialsPage: React.FC = () => {
    const { user } = useAuth();
    const { isPrivacyMode } = useLayoutStore();
    const isOwner = user?.role?.toLowerCase() === 'owner' || user?.role?.toLowerCase() === 'manager';

    // Data State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<{ revenue: number; expenses: number; net: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [monthStats, setMonthStats] = useState<number[]>(new Array(12).fill(0));

    // Recurring Expenses
    const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    // Breakdown State
    const [team, setTeam] = useState<StudioUser[]>([]);
    const [contracts, setContracts] = useState<Record<string, ArtistContract>>({});
    const [producerStats, setProducerStats] = useState<any[]>([]);

    // Filter State
    const [dateRange, setDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
    });
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, dateRange]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (!user) return;

            // 1. Fetch Transactions for the WHOLE YEAR (for Chart)
            const yearStart = startOfYear(new Date());
            const yearEnd = endOfYear(new Date());
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
                setContracts(contractsMap);
            } else if (userRole === 'artist') {
                // Fetch own contract
                const contract = await api.artists.getContract(user.id);
                if (contract) contractsMap[user.id] = contract;
                setContracts(contractsMap);
            }

            // 3. Process Data for Chart (Yearly Trend)
            const monthlyData = new Array(12).fill(0);
            allTxs.forEach(tx => {
                if (tx.type === 'INCOME') {
                    const month = new Date(tx.date).getMonth(); // 0-11

                    // Logic for Value:
                    // If Owner: Total Income
                    // If Artist: Only Own Share
                    if (userRole === 'artist') {
                        if (tx.artist_id === user.id) {
                            const rate = contractsMap[user.id]?.commission_rate || 50;
                            monthlyData[month] += (tx.amount * rate / 100);
                        }
                    } else {
                        monthlyData[month] += tx.amount;
                    }
                }
            });
            setMonthStats(monthlyData);

            // 4. Filter Transactions for Selected Range (for Table & Cards)
            const filteredTxs = allTxs.filter(tx =>
                isWithinInterval(new Date(tx.date), { start: dateRange.start, end: dateRange.end })
            );

            // If Artist, filter only own transactions
            const displayTxs = userRole === 'artist'
                ? filteredTxs.filter(tx => tx.artist_id === user.id)
                : filteredTxs;

            setTransactions(displayTxs);

            // 5. Calculate Stats & Breakdown
            let totalRev = 0;
            let totalExp = 0;
            let totalNet = 0; // Studio Net (Rev - Comm - Exp)

            // Setup breakdown map
            const breakdown: Record<string, { name: string; gross: number; net: number; comm: number }> = {};
            teamMembers.forEach(m => {
                breakdown[m.id] = { name: m.full_name, gross: 0, net: 0, comm: 0 };
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
                        // Artist View
                        totalRev += commission;
                    } else {
                        // Studio View
                        totalRev += amount; // Gross Revenue
                        totalNet += (amount - commission); // Studio Share

                        // Update Breakdown
                        const producerId = tx.artist_id || 'studio';
                        if (breakdown[producerId]) {
                            breakdown[producerId].gross += amount;
                            breakdown[producerId].comm += commission;
                            breakdown[producerId].net += (amount - commission);
                        } else if (producerId === 'studio') {
                            if (!breakdown['studio']) breakdown['studio'] = { name: 'Studio', gross: 0, net: 0, comm: 0 };
                            breakdown['studio'].gross += amount;
                            breakdown['studio'].net += amount;
                        }
                    }
                }
            });

            if (userRole !== 'artist') {
                totalNet -= totalExp; // Deduct expenses from Studio Net
            }

            setStats({
                revenue: totalRev,
                expenses: totalExp,
                net: userRole === 'artist' ? (totalRev - totalExp) : totalNet
            });

            // Finalize Breakdown Array
            setProducerStats(Object.values(breakdown).filter(b => b.gross > 0));

            // 6. Load Recurring Expenses (if Owner)
            if (userRole === 'owner' || userRole === 'manager') {
                const rec = await api.financials.listRecurringExpenses(user.studio_id!);
                setRecurringExpenses(rec);
            }

        } catch (error) {
            console.error("Failed to load financial data:", error);
        } finally {
            setLoading(false);
        }
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
        if (isPrivacyMode) return '••••••';
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
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
            // If the user is adding a "Fixed Expense", they likely want to record it for now too.
            // Or maybe they just want to configure it?
            // "Nuova Spesa" implies action. 
            // We'll create the transaction regardless if date is set.
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

    if (!user) return null;

    return (
        <div className="w-full p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {isOwner ? 'Finanze Studio' : 'Le Tue Finanze'}
                    </h1>
                    <p className="text-text-muted">
                        {isOwner
                            ? 'Monitora entrate, uscite e andamento dello studio.'
                            : 'Monitora i tuoi guadagni e le commissioni.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
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
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-white/10"
                    >
                        <Download size={18} />
                        <span className="hidden lg:inline">Esporta Report</span>
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {isFilterOpen && (
                <div className="bg-bg-secondary p-4 rounded-lg border border-border animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-text-muted mb-1">Data Inizio</label>
                            <input
                                type="date"
                                value={format(dateRange.start, 'yyyy-MM-dd')}
                                onChange={(e) => e.target.value && setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                                className="bg-bg-tertiary border border-border text-white text-sm rounded-lg p-2.5 outline-none focus:border-accent w-full"
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-text-muted mb-1">Data Fine</label>
                            <input
                                type="date"
                                value={format(dateRange.end, 'yyyy-MM-dd')}
                                onChange={(e) => e.target.value && setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                                className="bg-bg-tertiary border border-border text-white text-sm rounded-lg p-2.5 outline-none focus:border-accent w-full"
                            />
                        </div>
                        <div className="w-full md:w-auto">
                            <button
                                onClick={() => setDateRange({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) })}
                                className="text-sm text-accent hover:underline px-2 py-2.5"
                            >
                                Mese Corrente
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Card */}
                <div className="bg-bg-secondary p-6 rounded-lg border border-border">
                    <p className="text-text-muted text-sm font-medium mb-1">
                        {isOwner ? 'Fatturato Lordo' : 'I Tuoi Guadagni'}
                    </p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-bold text-white">{stats ? formatCurrency(stats.revenue) : '-'}</h3>
                        <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><TrendingUp size={20} /></div>
                    </div>
                </div>

                {/* Expenses Card */}
                <div className="bg-bg-secondary p-6 rounded-lg border border-border">
                    <p className="text-text-muted text-sm font-medium mb-1">
                        {isOwner ? 'Uscite Totali' : 'Spese Delegate'}
                    </p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-bold text-white">{stats ? formatCurrency(stats.expenses) : '-'}</h3>
                        <div className="p-2 bg-red-500/10 text-red-500 rounded-lg"><TrendingDown size={20} /></div>
                    </div>
                </div>

                {/* Net Card */}
                <div className="bg-bg-secondary p-6 rounded-lg border border-border relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <DollarSign size={80} className="w-20 h-20 lg:w-32 lg:h-32" />
                    </div>
                    <p className="text-text-muted text-sm font-medium mb-1 relative z-10">
                        {isOwner ? 'Utile Netto (Post Commissioni)' : 'Netto Stimato'}
                    </p>
                    <div className="flex items-end justify-between relative z-10">
                        <h3 className={clsx("text-2xl font-bold", (stats?.net || 0) >= 0 ? "text-accent" : "text-red-500")}>
                            {stats ? formatCurrency(stats.net) : '-'}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Content Switcher: Breakdown vs Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Production Breakdown (Owner Only) - Left Side */}
                {isOwner && (
                    <div className="lg:col-span-1 bg-bg-secondary rounded-lg border border-border flex flex-col">
                        <div className="p-4 border-b border-border flex items-center gap-2">
                            <Users size={18} className="text-accent" />
                            <h3 className="font-bold text-white">Dettaglio Produzione</h3>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4 max-h-[400px]">
                            {producerStats.length === 0 ? (
                                <p className="text-sm text-text-muted text-center py-4">Nessun dato per il periodo.</p>
                            ) : (
                                producerStats.map((p, idx) => (
                                    <div key={idx} className="flex flex-col gap-1 p-3 bg-bg-tertiary rounded-lg border border-border/50">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-white">{p.name}</span>
                                            <span className="text-xs text-text-muted bg-white/5 px-2 py-0.5 rounded">
                                                {formatCurrency(p.gross)} Lordi
                                            </span>
                                        </div>
                                        <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden mt-1 mb-1">
                                            <div className="bg-accent h-full" style={{ width: `${(p.net / p.gross) * 100}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-text-muted">Quota Studio: <span className="text-green-500">{formatCurrency(p.net)}</span></span>
                                            <span className="text-text-muted">Artista: <span className="text-orange-400">{formatCurrency(p.comm)}</span></span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Yearly Trend Chart - Right Side (Takes more space) */}
                <div className={clsx("bg-bg-secondary p-6 rounded-lg border border-border", isOwner ? "lg:col-span-2" : "lg:col-span-3")}>
                    <h3 className="text-lg font-bold text-white mb-6">Andamento Entrate (Anno Corrente)</h3>
                    <div className="h-64 flex items-end justify-between gap-2 px-2">
                        {monthStats.map((val, i) => {
                            const maxVal = Math.max(...monthStats, 1);
                            const height = `${(val / maxVal) * 100}%`;
                            return (
                                <div key={i} className="w-full flex flex-col justify-end items-center gap-2 h-full group">
                                    <div className="w-full bg-bg-tertiary hover:bg-accent/80 transition-all rounded-t-sm relative" style={{ height: height || '1px' }}>
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap">
                                            {formatCurrency(val)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-4 text-xs text-text-muted px-2 uppercase tracking-wider">
                        {['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'].map(m => (
                            <span key={m} className="w-full text-center">{m.substring(0, 3)}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-bg-secondary rounded-lg border border-border overflow-hidden">
                <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-bold text-white">Transazioni (Periodo Selezionato)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-bg-tertiary">
                            <tr className="text-sm text-text-muted font-medium border-b border-border">
                                <th className="px-6 py-3">Data</th>
                                <th className="px-6 py-3">Descrizione</th>
                                <th className="px-6 py-3">Produttore</th>
                                <th className="px-6 py-3">Tipo</th>
                                <th className="px-6 py-3 text-right">Importo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-muted">Caricamento transazioni...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-text-muted">Nessuna transazione trovata nel periodo.</td></tr>
                            ) : (
                                transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-sm text-text-secondary">
                                            {format(new Date(tx.date), 'dd MMM yyyy', { locale: it })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{tx.category}</div>
                                            {tx.description && <div className="text-xs text-text-muted">{tx.description}</div>}
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
                                                <span>{tx.type === 'EXPENSE' ? '-' : '+'}{formatCurrency(tx.amount)}</span>
                                                {isOwner && (
                                                    <button
                                                        onClick={() => handleDeleteTransaction(tx.id)}
                                                        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                                        title="Elimina Transazione"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Expenses Modal */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-bg-secondary rounded-xl border border-border w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Gestione Spese</h3>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-text-muted hover:text-white">
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
        </div >
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
                    className={clsx("flex-1 py-2 text-sm font-medium rounded-md transition-colors", tab === 'new' ? "bg-accent text-white" : "text-text-muted hover:text-white")}
                >
                    Nuova Spesa
                </button>
                <button
                    onClick={() => setTab('recurring')}
                    className={clsx("flex-1 py-2 text-sm font-medium rounded-md transition-colors", tab === 'recurring' ? "bg-accent text-white" : "text-text-muted hover:text-white")}
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
                            className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-white focus:border-accent outline-none"
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
                                className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-white focus:border-accent outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-text-muted mb-1">Categoria</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-white focus:border-accent outline-none"
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
                            className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-white focus:border-accent outline-none"
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
                            <div className="text-sm font-medium text-white">Rendi spesa fissa mensile</div>
                            <div className="text-xs text-text-muted">Creerà automaticamente una voce tra le spese fisse.</div>
                        </div>
                    </div>

                    {formData.isRecurring && (
                        <div>
                            <label className="block text-sm text-text-muted mb-1">Giorno del mese in cui si ripete</label>
                            <select
                                value={formData.dayOfMonth}
                                onChange={e => setFormData({ ...formData, dayOfMonth: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg p-3 text-white focus:border-accent outline-none"
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
                            <h4 className="font-bold text-white">Generazione Automatica</h4>
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
                                        <div className="font-medium text-white">{rec.name}</div>
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
