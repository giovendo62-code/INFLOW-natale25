
import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, History } from 'lucide-react';
import { api } from '../../../services/api';
import type { ConsentTemplate } from '../../../services/types';

export const TemplateTab: React.FC = () => {
    const [template, setTemplate] = useState<ConsentTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [requiredResign, setRequiredResign] = useState(false);

    useEffect(() => {
        loadTemplate();
    }, []);

    const loadTemplate = async () => {
        setLoading(true);
        try {
            const data = await api.consents.getTemplate('studio-1'); // Assume current studio
            if (data) {
                setTemplate(data);
                setTitle(data.title);
                setContent(data.content);
                setRequiredResign(data.required_resign);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await api.consents.updateTemplate({
                id: template?.id,
                title,
                content,
                required_resign: requiredResign,
                version: template ? template.version : 0
            });
            setTemplate(updated);
            alert('Template aggiornato con successo! Nuova versione: v' + updated.version);
        } catch (error) {
            console.error(error);
            alert('Errore durante il salvataggio');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-text-muted">Caricamento template...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-bg-secondary border border-border rounded-lg p-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-text-muted mb-1">Titolo Documento</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent"
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-text-muted mb-1">Contenuto (HTML supportato)</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-[500px] bg-bg-tertiary border border-border rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-accent resize-none"
                            placeholder="Inserisci il testo del consenso..."
                        />
                        <p className="text-xs text-text-muted mt-2">
                            Variabili disponibili: {'{{nome}}, {{cognome}}, {{data_nascita}}, {{codice_fiscale}}, {{studio_nome}}'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-bg-secondary border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Impostazioni</h3>

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-white font-medium">Versione Corrente</p>
                            <p className="text-sm text-text-muted">Ultima modifica: {template?.updated_at ? new Date(template.updated_at).toLocaleDateString() : 'Mai'}</p>
                        </div>
                        <span className="bg-accent/20 text-accent px-3 py-1 rounded text-sm font-bold">
                            v{template?.version || 1}
                        </span>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20 mb-6">
                        <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={requiredResign}
                                    onChange={(e) => setRequiredResign(e.target.checked)}
                                    className="rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
                                />
                                <span className="text-sm text-white font-medium">Richiedi nuova firma</span>
                            </label>
                            <p className="text-xs text-text-muted">
                                Se attivo, tutti i clienti dovranno firmare nuovamente questo documento alla prossima visita.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        {saving ? 'Salvataggio...' : 'Salva Modifiche'}
                    </button>
                </div>

                <div className="bg-bg-secondary border border-border rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <History size={18} />
                        Storico Versioni
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm py-2 border-b border-border/50">
                            <span className="text-white">v{template?.version} (Attuale)</span>
                            <span className="text-text-muted">Oggi</span>
                        </div>
                        <div className="flex justify-between items-center text-sm py-2 border-b border-border/50 opacity-50">
                            <span className="text-white">v{(template?.version || 1) - 1}</span>
                            <span className="text-text-muted">--</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
