import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../features/auth/AuthContext';
import { api } from '../../../services/api';
import type { ArtistContract, PresenceLog } from '../../../services/types';
import { Clock, FileText } from 'lucide-react';
// import { format } from 'date-fns';
// import { it } from 'date-fns/locale';

export const ArtistContractSettings: React.FC = () => {
    const { user } = useAuth();
    const [contract, setContract] = useState<ArtistContract | null>(null);
    const [_logs, setLogs] = useState<PresenceLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            loadData();
        }
    }, [user?.id]);

    const loadData = async () => {
        try {
            const c = await api.artists.getContract(user!.id);
            setContract(c);
            if (c?.rent_type === 'PRESENCES') {
                const l = await api.artists.getPresenceLogs(user!.id);
                setLogs(l);
            }
        } catch (e) {
            console.error('Failed to load contract', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-text-primary">Caricamento contratto...</div>;
    if (!contract) return <div className="text-text-muted">Nessun contratto attivo trovato.</div>;

    const isPresences = contract.rent_type === 'PRESENCES';
    const remaining = isPresences ? (contract.presence_package_limit || 0) - (contract.used_presences || 0) : 0;
    const progress = isPresences && contract.presence_package_limit
        ? (contract.used_presences || 0) / contract.presence_package_limit * 100
        : 0;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-text-primary mb-6">Il Tuo Contratto</h2>

            {/* Main Status Card */}
            <div className="bg-bg-secondary p-6 rounded-xl border border-border">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-text-muted text-sm uppercase tracking-wider mb-1">Tipologia Contratto</p>
                        <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                            {contract.rent_type === 'FIXED' ? 'Affitto Fisso' :
                                contract.rent_type === 'PERCENTAGE' ? 'Percentuale' : 'A Pacchetto Presenze'}
                        </h3>
                    </div>
                    <div className="bg-accent/10 p-3 rounded-full text-accent">
                        <FileText size={24} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                        <p className="text-text-muted text-sm mb-1">Commissione Studio</p>
                        <p className="text-2xl font-bold text-text-primary">{contract.commission_rate}%</p>
                    </div>
                    {contract.rent_type === 'FIXED' && (
                        <div>
                            <p className="text-text-muted text-sm mb-1">Canone Mensile</p>
                            <p className="text-2xl font-bold text-text-primary">€{contract.rent_fixed_amount}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Presences Countdown (Only if PRESENCES type) */}
            {isPresences && (
                <div className="bg-bg-secondary p-6 rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                            <Clock size={20} className="text-orange-500" />
                            Contatore Presenze
                        </h3>
                        <span className="text-2xl font-bold text-text-primary">
                            {remaining} <span className="text-sm text-text-muted font-normal">rimanenti</span>
                        </span>
                    </div>

                    <div className="relative w-full h-4 bg-bg-tertiary rounded-full overflow-hidden mb-4">
                        <div
                            className={`absolute top-0 left-0 h-full transition-all duration-500 ${remaining < 3 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, (remaining / (contract.presence_package_limit || 1)) * 100)}%` }} // Showing remaining bar or used? Usually progress bar shows used.
                        // Let's show USED bar
                        />
                        <div
                            className={`absolute top-0 left-0 h-full transition-all duration-500 bg-accent`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-sm text-text-muted">
                        <span>{contract.used_presences} usate</span>
                        <span>Totale: {contract.presence_package_limit}</span>
                    </div>
                </div>
            )}

            {/* Legal & Docs */}
            <div className="bg-bg-secondary p-6 rounded-xl border border-border">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Dettagli Legali</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-bg-tertiary rounded-lg">
                        <p className="text-xs text-text-muted mb-1">P.IVA / C.F.</p>
                        <p className="text-text-primary font-mono">{contract.vat_number || contract.fiscal_code || '-'}</p>
                    </div>
                    <div className="p-4 bg-bg-tertiary rounded-lg">
                        <p className="text-xs text-text-muted mb-1">Indirizzo</p>
                        <p className="text-text-primary">{contract.address || '-'}</p>
                    </div>
                    <div className="p-4 bg-bg-tertiary rounded-lg col-span-full">
                        <p className="text-xs text-text-muted mb-1">IBAN</p>
                        <p className="text-text-primary font-mono">{contract.iban || '-'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
