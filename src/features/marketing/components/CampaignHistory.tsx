import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import type { MarketingCampaign } from '../../../services/types';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import clsx from 'clsx';

export const CampaignHistory: React.FC = () => {
    const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        try {
            const data = await api.marketing.listCampaigns();
            setCampaigns(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center text-text-muted p-8">Caricamento storico...</div>;

    if (campaigns.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                <Clock size={48} className="mb-4 opacity-20" />
                <p>Nessuna campagna trovata nello storico.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {campaigns.map((camp) => (
                <div key={camp.id} className="bg-bg-secondary p-4 rounded-lg border border-border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-accent/50 transition-colors">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-white">{camp.title}</h3>
                            <span className={clsx(
                                "text-[10px] px-2 py-0.5 rounded font-bold uppercase",
                                camp.status === 'SENT' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                            )}>
                                {camp.status === 'SENT' ? 'Inviata' : 'Bozza'}
                            </span>
                            {camp.ai_used && (
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-purple-500/10 text-purple-500">
                                    AI Generated
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-text-muted line-clamp-1">{camp.message_text}</p>
                        <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                            <span>📅 {format(new Date(camp.created_at), 'dd/MM/yyyy HH:mm')}</span>
                            <span>👥 {camp.recipients_count} Destinatari</span>
                            <span>📱 {camp.channel}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
