import React, { useState } from 'react';
import { MessageSquare, Users, Send, Clock, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { MessageEditor } from './components/MessageEditor';
import { ClientSegmenter } from './components/ClientSegmenter';
import { CampaignSummary } from './components/CampaignSummary';
import { CampaignHistory } from './components/CampaignHistory';
import type { MarketingCampaign } from '../../services/types';

type Tab = 'EDITOR' | 'SEGMENTS' | 'SUMMARY' | 'HISTORY';

export const MarketingPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('EDITOR');
    const [draftCampaign, setDraftCampaign] = useState<Partial<MarketingCampaign>>({
        channel: 'WHATSAPP',
        message_text: '',
        filters: { broadcast_status: 'ALL', styles: [] },
        ai_used: false
    });
    const [selectedRecipients, setSelectedRecipients] = useState<any[]>([]);

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
    };

    return (
        <div className="w-full max-w-full overflow-x-hidden pt-20 md:pt-8 p-4 md:p-8 user-select-none">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Marketing</h1>
                    <p className="text-text-muted">Crea campagne, segmenta i clienti e invia messaggi.</p>
                </div>
            </div>

            {/* Mobile Tabs (Dropdown) */}
            <div className="md:hidden mb-6">
                <div className="relative bg-bg-secondary border border-border rounded-lg p-2">
                    <select
                        value={activeTab}
                        onChange={(e) => handleTabChange(e.target.value as Tab)}
                        className="w-full bg-transparent text-white font-medium outline-none appearance-none p-2"
                    >
                        <option value="EDITOR" className="bg-bg-secondary text-white">✍️ Crea Messaggio</option>
                        <option value="SEGMENTS" className="bg-bg-secondary text-white">👥 Seleziona Clienti</option>
                        <option value="SUMMARY" className="bg-bg-secondary text-white">🚀 Riepilogo & Invio</option>
                        <option value="HISTORY" className="bg-bg-secondary text-white">🕒 Storico</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                        <ChevronDown size={16} />
                    </div>
                </div>
            </div>

            {/* Desktop Tabs */}
            <div className="hidden md:flex border-b border-border mb-6 overflow-x-auto">
                <button
                    onClick={() => handleTabChange('EDITOR')}
                    className={clsx(
                        'flex items-center gap-2 px-6 py-3 border-b-2 font-medium transition-colors whitespace-nowrap',
                        activeTab === 'EDITOR'
                            ? 'border-accent text-accent'
                            : 'border-transparent text-text-muted hover:text-white'
                    )}
                >
                    <MessageSquare size={18} />
                    Crea Messaggio
                </button>
                <button
                    onClick={() => handleTabChange('SEGMENTS')}
                    className={clsx(
                        'flex items-center gap-2 px-6 py-3 border-b-2 font-medium transition-colors whitespace-nowrap',
                        activeTab === 'SEGMENTS'
                            ? 'border-accent text-accent'
                            : 'border-transparent text-text-muted hover:text-white'
                    )}
                >
                    <Users size={18} />
                    Seleziona Clienti
                </button>
                <button
                    onClick={() => handleTabChange('SUMMARY')}
                    className={clsx(
                        'flex items-center gap-2 px-6 py-3 border-b-2 font-medium transition-colors whitespace-nowrap',
                        activeTab === 'SUMMARY'
                            ? 'border-accent text-accent'
                            : 'border-transparent text-text-muted hover:text-white'
                    )}
                >
                    <Send size={18} />
                    Riepilogo & Invio
                </button>
                <button
                    onClick={() => handleTabChange('HISTORY')}
                    className={clsx(
                        'flex items-center gap-2 px-6 py-3 border-b-2 font-medium transition-colors whitespace-nowrap',
                        activeTab === 'HISTORY'
                            ? 'border-accent text-accent'
                            : 'border-transparent text-text-muted hover:text-white'
                    )}
                >
                    <Clock size={18} />
                    Storico
                </button>
            </div>

            {/* Content */}
            <div className="w-full">
                {activeTab === 'EDITOR' && (
                    <MessageEditor
                        data={draftCampaign}
                        onChange={setDraftCampaign}
                        onNext={() => setActiveTab('SEGMENTS')}
                    />
                )}
                {activeTab === 'SEGMENTS' && (
                    <ClientSegmenter
                        data={draftCampaign}
                        onChange={setDraftCampaign}
                        onNext={() => setActiveTab('SUMMARY')}
                        onSelectionChange={setSelectedRecipients}
                    />
                )}
                {activeTab === 'SUMMARY' && (
                    <CampaignSummary
                        data={draftCampaign}
                        recipients={selectedRecipients}
                        onEdit={() => setActiveTab('EDITOR')}
                    />
                )}
                {activeTab === 'HISTORY' && (
                    <CampaignHistory />
                )}
            </div>
        </div>
    );
};
