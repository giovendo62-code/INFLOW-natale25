import React, { useState } from 'react';
import { Users, FileText, PenTool } from 'lucide-react';
import clsx from 'clsx';
import { ClientsTab } from './components/ClientsTab';
import { TemplateTab } from './components/TemplateTab';
import { DigitalSignature } from './components/DigitalSignature'; // Existing component
import { api } from '../../services/api';
import type { Client, ConsentTemplate } from '../../services/types';
import { useAuth } from '../auth/AuthContext';

export const ConsentsPage: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'clients' | 'template'>('clients');

    // Signing State
    const [isSigning, setIsSigning] = useState(false);
    const [signingClient, setSigningClient] = useState<Client | null>(null);
    const [currentTemplate, setCurrentTemplate] = useState<ConsentTemplate | null>(null);

    const canManageTemplates = ['OWNER', 'MANAGER', 'STUDIO_ADMIN'].includes(user?.role || '');

    const handleStartSignature = async (client: Client) => {
        try {
            const template = await api.consents.getTemplate('studio-1');
            if (!template) {
                alert('Nessun template attivo trovato. Crea prima un template.');
                return;
            }
            setCurrentTemplate(template);
            setSigningClient(client);
            setIsSigning(true);
        } catch (error) {
            console.error("Error fetching template:", error);
            alert("Errore nel recupero del template");
        }
    };

    const handleConfirmSignature = async (signatureData: string) => {
        if (!signingClient || !currentTemplate) return;

        try {
            await api.consents.signConsent(
                signingClient.id,
                currentTemplate.id,
                signatureData,
                currentTemplate.version,
                user?.role || 'UNKNOWN'
            );
            alert('Consenso firmato con successo!');
            setIsSigning(false);
            setSigningClient(null);
            // Ideally refresh the list here
        } catch (error) {
            console.error("Error signing consent:", error);
            alert("Errore durante il salvataggio della firma");
        }
    };

    if (isSigning && signingClient && currentTemplate) {
        // Render Full Screen Signing Mode
        return (
            <div className="fixed inset-0 z-50 bg-bg-primary flex flex-col">
                <div className="p-4 border-b border-border bg-bg-secondary flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white">Firma Consenso</h2>
                        <p className="text-text-muted">Cliente: {signingClient.full_name}</p>
                    </div>
                    <button
                        onClick={() => setIsSigning(false)}
                        className="text-text-muted hover:text-white px-4 py-2"
                    >
                        Annulla
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full space-y-8">
                    {/* Document Preview */}
                    <div className="bg-white text-black p-4 md:p-8 rounded-lg shadow-lg prose max-w-none">
                        <div dangerouslySetInnerHTML={{
                            __html: currentTemplate.content
                                .replace('{{nome}}', signingClient.full_name.split(' ')[0] || '')
                                .replace('{{cognome}}', signingClient.full_name.split(' ').slice(1).join(' ') || '')
                                .replace('{{data_nascita}}', '01/01/1990') // Mock
                                .replace('{{codice_fiscale}}', signingClient.fiscal_code || '---')
                        }} />
                    </div>

                    {/* Signature Pad */}
                    <div className="pb-8">
                        <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                            <PenTool size={20} className="text-accent" />
                            Firma qui sotto
                        </h3>
                        <DigitalSignature
                            onSave={handleConfirmSignature}
                            onClear={() => { }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Consensi Digitali</h1>
                        <p className="text-text-muted">Gestisci i consensi informati e la privacy.</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setActiveTab('clients')}
                        className={clsx(
                            'px-6 py-3 text-sm font-medium transition-colors border-b-2',
                            activeTab === 'clients'
                                ? 'border-accent text-accent'
                                : 'border-transparent text-text-muted hover:text-white'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Users size={18} />
                            Clienti & Firme
                        </div>
                    </button>

                    {canManageTemplates && (
                        <button
                            onClick={() => setActiveTab('template')}
                            className={clsx(
                                'px-6 py-3 text-sm font-medium transition-colors border-b-2',
                                activeTab === 'template'
                                    ? 'border-accent text-accent'
                                    : 'border-transparent text-text-muted hover:text-white'
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <FileText size={18} />
                                Editor Template
                            </div>
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="pt-4">
                    {activeTab === 'clients' ? (
                        <ClientsTab onStartSignature={handleStartSignature} />
                    ) : (
                        <TemplateTab />
                    )}
                </div>
            </div>
        </div>
    );
};
