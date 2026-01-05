import React from 'react';
import { Share2, AlertTriangle, Edit2 } from 'lucide-react';
import type { MarketingCampaign, Client, Studio } from '../../../services/types';
import { api } from '../../../services/api';
import { useAuth } from '../../auth/AuthContext';


interface CampaignSummaryProps {
    data: Partial<MarketingCampaign>;
    recipients?: Client[];
    onEdit: () => void;
}

export const CampaignSummary: React.FC<CampaignSummaryProps> = ({ data, recipients = [], onEdit }) => {
    const { user } = useAuth();
    const [studio, setStudio] = React.useState<Studio | null>(null);

    React.useEffect(() => {
        const loadStudio = async () => {
            if (user?.studio_id) {
                try {
                    const data = await api.settings.getStudio(user.studio_id);
                    setStudio(data);
                } catch (err) {
                    console.error('Failed to load studio:', err);
                }
            }
        };
        loadStudio();
    }, [user?.studio_id]);

    // Helper to generate personalized message
    // Helper to generate personalized message
    const getMessageForClient = (client: Client) => {
        return (data.message_text || '')
            .replace('{{nome}}', client.full_name.split(' ')[0])
            .replace('{{studio_nome}}', studio?.name || 'lo Studio')
            .replace('{{data_appuntamento}}', client.last_appointment ? new Date(client.last_appointment).toLocaleDateString() : '---');
    };

    // Generic preview (Use first recipient if available)
    const previewClientName = recipients.length > 0 ? recipients[0].full_name.split(' ')[0] : 'Mario';
    const previewDate = recipients.length > 0 && recipients[0].last_appointment
        ? new Date(recipients[0].last_appointment).toLocaleDateString()
        : '25/12/2024';

    const previewMessage = (data.message_text || '')
        .replace('{{nome}}', previewClientName)
        .replace('{{studio_nome}}', studio?.name || 'lo Studio')
        .replace('{{data_appuntamento}}', previewDate);



    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-bg-secondary p-6 rounded-lg border border-border">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Riepilogo Campagna</h2>
                        <p className="text-text-muted">Controlla i dettagli prima di procedere.</p>
                    </div>
                    <button onClick={onEdit} className="text-accent hover:text-accent-hover flex items-center gap-2 text-sm font-medium">
                        <Edit2 size={16} /> Modifica
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-bg-tertiary p-4 rounded-lg">
                        <label className="text-xs text-text-muted uppercase font-bold">Titolo</label>
                        <p className="text-white font-medium mt-1">{data.title || 'Senza titolo'}</p>
                    </div>
                    <div className="bg-bg-tertiary p-4 rounded-lg">
                        <label className="text-xs text-text-muted uppercase font-bold">Canale</label>
                        <p className="text-white font-medium mt-1">{data.channel}</p>
                    </div>
                    <div className="bg-bg-tertiary p-4 rounded-lg">
                        <label className="text-xs text-text-muted uppercase font-bold">Destinatari</label>
                        <p className="text-white font-medium mt-1">{data.recipients_count || 0} clienti selezionati</p>
                    </div>
                </div>

                <div className="border-t border-border pt-6">
                    <label className="text-xs text-text-muted uppercase font-bold mb-3 block">Anteprima Messaggio (Esempio)</label>
                    <div className="bg-[#DCF8C6] text-black p-4 rounded-lg rounded-tl-none inline-block max-w-lg shadow-sm">
                        <p className="text-sm whitespace-pre-wrap">{previewMessage}</p>
                        <span className="text-[10px] text-gray-500 block text-right mt-1">12:30</span>
                    </div>
                </div>
            </div>

            {/* Manual Send List */}
            <div className="bg-bg-secondary p-6 rounded-lg border border-border">
                <h3 className="text-xl font-bold text-white mb-4">Invio Manuale ({data.recipients_count} destinatari)</h3>
                <p className="text-sm text-text-muted mb-6">
                    Clicca sul pulsante WhatsApp accanto ad ogni cliente per aprire la chat con il messaggio precompilato.
                    Non è necessaria alcuna automazione o API.
                </p>

                <div className="space-y-3">
                    {recipients.length === 0 ? (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-lg flex items-center gap-3">
                            <AlertTriangle size={20} />
                            <span>Per visualizzare la lista puntuale e i pulsanti, assicurati di aver selezionato dei clienti nel passaggio precedente.</span>
                        </div>
                    ) : (
                        <div className="bg-bg-tertiary rounded-lg overflow-hidden border border-border">
                            {recipients.map(client => {
                                const message = getMessageForClient(client);
                                const encodedMessage = encodeURIComponent(message);
                                const waLink = `https://wa.me/${client.phone.replace(/\s+/g, '')}?text=${encodedMessage}`;

                                return (
                                    <div key={client.id} className="p-4 border-b border-border last:border-0 flex items-center justify-between hover:bg-white/5 transition-colors">
                                        <div>
                                            <div className="font-medium text-white">{client.full_name}</div>
                                            <div className="text-xs text-text-secondary">{client.phone}</div>
                                        </div>
                                        <a
                                            href={waLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                                        >
                                            <Share2 size={16} /> invia
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

