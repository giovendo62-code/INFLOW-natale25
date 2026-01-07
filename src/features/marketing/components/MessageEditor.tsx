import React, { useState } from 'react';
import { Sparkles, Save, ArrowRight, Wand2 } from 'lucide-react';
import { api } from '../../../services/api';
import type { MarketingCampaign, Studio } from '../../../services/types';
import { useAuth } from '../../auth/AuthContext';


interface MessageEditorProps {
    data: Partial<MarketingCampaign>;
    onChange: (data: Partial<MarketingCampaign>) => void;
    onNext: () => void;
}

export const MessageEditor: React.FC<MessageEditorProps> = ({ data, onChange, onNext }) => {
    const { user } = useAuth();
    const [studio, setStudio] = useState<Studio | null>(null);

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

    const [aiPrompt, setAiPrompt] = useState({
        goal: 'Promo',
        tone: 'Amichevole',
        length: 'Breve',
        customContext: ''
    });
    const [generating, setGenerating] = useState(false);
    const [aiOptions, setAiOptions] = useState<string[]>([]);
    const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || ''); // Simulated API Key input

    const handleGenerateAI = async () => {
        setGenerating(true);
        try {
            const options = await api.marketing.generateAIMessage({
                ...aiPrompt,
                apiKey,
                studioName: studio?.name || 'lo Studio',
                studioAddress: studio?.address,
                studioPhone: studio?.phone
            });
            setAiOptions(options);
        } catch (error: any) {
            console.error('AI Generation failed:', error);
            alert('Errore AI: ' + (error.message || JSON.stringify(error)));
        } finally {
            setGenerating(false);
        }
    };

    const insertVariable = (variable: string) => {
        onChange({ ...data, message_text: (data.message_text || '') + variable });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left: Editor */}
            <div className="space-y-6">
                <div className="bg-bg-secondary p-6 rounded-lg border border-border">
                    <h2 className="text-lg font-bold text-white mb-4">Componi Messaggio</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Titolo Campagna</label>
                            <input
                                type="text"
                                className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-accent outline-none"
                                placeholder="Es: Promo Natale 2024"
                                value={data.title || ''}
                                onChange={(e) => onChange({ ...data, title: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Canale</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="channel"
                                        checked={data.channel === 'WHATSAPP'}
                                        onChange={() => onChange({ ...data, channel: 'WHATSAPP' })}
                                        className="text-accent focus:ring-accent"
                                    />
                                    <span className="text-white">WhatsApp</span>
                                </label>
                                <label className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                                    <input type="radio" name="channel" disabled />
                                    <span className="text-text-muted">SMS (Coming Soon)</span>
                                </label>
                                <label className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                                    <input type="radio" name="channel" disabled />
                                    <span className="text-text-muted">Email (Coming Soon)</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Messaggio</label>
                            <textarea
                                className="w-full h-48 bg-bg-primary border border-border rounded-lg p-4 text-white focus:ring-2 focus:ring-accent outline-none resize-none"
                                placeholder="Scrivi il tuo messaggio qui..."
                                value={data.message_text || ''}
                                onChange={(e) => onChange({ ...data, message_text: e.target.value })}
                            />
                            <div className="flex justify-between items-center mt-2 text-xs text-text-muted">
                                <span>{(data.message_text || '').length} caratteri</span>
                                <div className="flex gap-2">
                                    {['{{nome}}', '{{studio_nome}}', '{{data_appuntamento}}'].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => insertVariable(v)}
                                            className="bg-bg-tertiary hover:bg-white/10 px-2 py-1 rounded transition-colors"
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted hover:text-white hover:bg-bg-tertiary transition-colors">
                        <Save size={18} />
                        Salva Bozza
                    </button>
                    <button
                        onClick={onNext}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors font-medium"
                    >
                        Prosegui
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            {/* Right: AI Generator */}
            <div className="bg-bg-secondary p-4 md:p-6 rounded-lg border border-border flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="text-accent shrink-0" size={24} />
                    <h2 className="text-lg font-bold text-white truncate">AI Assistant</h2>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="bg-bg-tertiary p-3 md:p-4 rounded-lg border border-border">
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">Configurazione AI</label>
                        <div className="flex flex-col sm:flex-row gap-2 mb-2">
                            <input
                                type="password"
                                placeholder="Tua API Key (Opzionale)"
                                className="flex-1 bg-bg-primary border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none w-full"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-green-500/10 border border-green-500/20 shrink-0">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <span className="text-xs font-medium text-green-500">System AI Active</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Obiettivo</label>
                            <select
                                className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-white text-sm focus:outline-none"
                                value={aiPrompt.goal}
                                onChange={(e) => setAiPrompt({ ...aiPrompt, goal: e.target.value })}
                            >
                                <option>Promo</option>
                                <option>Promemoria</option>
                                <option>Referral</option>
                                <option>Richiesta Recensione</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Tono</label>
                            <select
                                className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-white text-sm focus:outline-none"
                                value={aiPrompt.tone}
                                onChange={(e) => setAiPrompt({ ...aiPrompt, tone: e.target.value })}
                            >
                                <option>Amichevole</option>
                                <option>Professionale</option>
                                <option>Diretto</option>
                                <option>Elegante</option>
                            </select>
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs text-text-secondary mb-1">Istruzioni Personalizzate (Opzionale)</label>
                            <textarea
                                className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-white text-sm focus:outline-none h-24 resize-none"
                                placeholder="Es: Offerta speciale per San Valentino, sconto 20% su tutti i tatuaggi realistici..."
                                value={aiPrompt.customContext}
                                onChange={(e) => setAiPrompt({ ...aiPrompt, customContext: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerateAI}
                        disabled={generating}
                        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg border border-dashed border-border transition-all"
                    >
                        {generating ? (
                            <span className="animate-pulse">Generazione in corso...</span>
                        ) : (
                            <>
                                <Wand2 size={18} />
                                Genera con AI
                            </>
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4">
                    {aiOptions.map((opt, idx) => (
                        <div key={idx} className="bg-bg-primary p-4 rounded-lg border border-border group hover:border-accent transition-colors">
                            <p className="text-sm text-text-secondary mb-3 whitespace-pre-wrap">{opt}</p>
                            <button
                                onClick={() => onChange({ ...data, message_text: opt, ai_used: true })}
                                className="text-xs text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                Usa questo testo
                            </button>
                        </div>
                    ))}
                    {aiOptions.length === 0 && !generating && (
                        <div className="text-center text-text-muted text-sm py-10">
                            Configura i parametri e clicca "Genera" per ottenere suggerimenti.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
