import React, { useState, useEffect } from 'react';
import { Building, Globe, MapPin, Save, Trash2, UploadCloud, ExternalLink } from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { DragDropUpload } from '../../../components/DragDropUpload';
import type { Studio } from '../../../services/types';

export const StudioSettings: React.FC = () => {
    const { user } = useAuth();
    const [studio, setStudio] = useState<Studio | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const loadStudio = async () => {
            console.log('StudioSettings: loading for user', user?.id, 'studio_id:', user?.studio_id);
            if (!user?.studio_id) {
                console.warn('StudioSettings: No studio_id found on user');
                return;
            }
            setLoading(true);
            try {
                const data = await api.settings.getStudio(user.studio_id);
                console.log('StudioSettings: data received', data);
                setStudio(data);
            } catch (err) {
                console.error('StudioSettings: error loading studio', err);
            } finally {
                setLoading(false);
            }
        };
        loadStudio();
    }, [user?.studio_id]);

    // State for status messages
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studio || !user?.studio_id) return;

        setSaving(true);
        setStatusMsg(null);

        try {
            // Remove ID and other potentially immutable system fields from the update payload
            const { id, ...updates } = studio;

            await api.settings.updateStudio(user.studio_id, updates);
            setStatusMsg({ type: 'success', text: "Modifiche salvate con successo!" });

            // Clear success message after 3 seconds
            setTimeout(() => setStatusMsg(null), 3000);
        } catch (err: any) {
            console.error("Save error:", err);
            // Check for specific error codes if possible
            if (err?.code === '42703') { // Postgres "undefined_column"
                setStatusMsg({ type: 'error', text: "Errore: Colonna mancante nel database. Esegui la migrazione SQL." });
            } else {
                setStatusMsg({ type: 'error', text: "Errore durante il salvataggio. Controlla la console o la migrazione DB." });
            }
        } finally {
            setSaving(false);
        }
    };

    // ... (rest of the component)

    // Hook to clear message on unmount
    useEffect(() => {
        return () => setStatusMsg(null);
    }, []);

    // ... render ...



    const handleLogoUpload = async (file: File) => {
        if (!user?.studio_id || !studio) return;
        setUploading(true);
        try {
            const path = `logos/${user.studio_id}/${Date.now()}_${file.name}`;
            const url = await api.storage.upload('studios', path, file);
            setStudio({ ...studio, logo_url: url });
        } catch (err) {
            console.error("Upload failed", err);
            alert("Errore caricamento immagine");
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveLogo = () => {
        if (!studio) return;
        // Optional: Call api.storage.delete if we want to clean up, but keeping it simple for now (just unlinking)
        setStudio({ ...studio, logo_url: '' });
    };

    if (loading) return <div className="text-text-muted">Caricamento...</div>;
    if (!studio) return <div className="text-text-muted">Studio non trovato</div>;

    return (
        <div className="space-y-8">
            <div className="bg-bg-secondary p-8 rounded-2xl border border-border">
                <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
                    <Building className="text-accent" size={24} />
                    Dettagli Studio
                </h2>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div className="xl:col-span-2">
                            <label className="block text-sm font-medium text-text-muted mb-2">Logo Studio</label>
                            {studio.logo_url ? (
                                <div className="flex items-center gap-6 p-4 bg-bg-tertiary rounded-xl border border-border">
                                    <img
                                        src={studio.logo_url}
                                        alt="Logo Studio"
                                        className="w-24 h-24 rounded-full object-cover border-2 border-accent"
                                    />
                                    <div className="flex flex-col gap-2">
                                        <div className="relative overflow-hidden">
                                            <button type="button" className="flex items-center gap-2 px-4 py-2 bg-bg-primary hover:bg-white/5 border border-border rounded-lg text-sm transition-colors text-text-primary">
                                                <UploadCloud size={16} />
                                                <span>Modifica Logo</span>
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => e.target.files && handleLogoUpload(e.target.files[0])}
                                                    accept="image/*"
                                                />
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveLogo}
                                            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-400/10 rounded-lg text-sm transition-colors justify-start"
                                        >
                                            <Trash2 size={16} />
                                            <span>Rimuovi Logo</span>
                                        </button>
                                    </div>
                                    {uploading && <div className="text-sm text-accent animate-pulse ml-4">Caricamento...</div>}
                                </div>
                            ) : (
                                <DragDropUpload
                                    onUpload={handleLogoUpload}
                                    label={uploading ? "Caricamento in corso..." : "Trascina qui il tuo logo"}
                                    sublabel="Formati supportati: PNG, JPG, GIF"
                                    className="w-full bg-bg-tertiary"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Nome Studio</label>
                            <input
                                type="text"
                                value={studio.name}
                                onChange={e => setStudio({ ...studio, name: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Sito Web</label>
                            <div className="relative">
                                <Globe size={18} className="absolute left-3 top-2.5 text-text-muted" />
                                <input
                                    type="url"
                                    value={studio.website || ''}
                                    onChange={e => setStudio({ ...studio, website: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Link Recensioni Google</label>
                            <div className="relative">
                                <Globe size={18} className="absolute left-3 top-2.5 text-text-muted" />
                                <input
                                    type="url"
                                    value={studio.google_review_url || ''}
                                    onChange={e => setStudio({ ...studio, google_review_url: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                    placeholder="https://g.page/r/..."
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Link Report Studio</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Globe size={18} className="absolute left-3 top-2.5 text-text-muted" />
                                    <input
                                        type="url"
                                        value={studio.report_url || ''}
                                        onChange={e => setStudio({ ...studio, report_url: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                        placeholder="https://..."
                                    />
                                </div>
                                {studio.report_url && (
                                    <a
                                        href={studio.report_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 bg-bg-tertiary border border-border rounded-lg text-text-muted hover:text-accent transition-colors flex items-center justify-center hover:bg-white/5"
                                        title="Apri link"
                                    >
                                        <ExternalLink size={20} />
                                    </a>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Città</label>
                            <div className="relative">
                                <MapPin size={18} className="absolute left-3 top-2.5 text-text-muted" />
                                <input
                                    type="text"
                                    value={studio.city || ''}
                                    onChange={e => setStudio({ ...studio, city: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Indirizzo</label>
                            <input
                                type="text"
                                value={studio.address || ''}
                                onChange={e => setStudio({ ...studio, address: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-4 border-t border-border">
                        <div className="xl:col-span-2">
                            <h3 className="text-text-primary font-medium mb-4">Configurazione AI</h3>
                        </div>
                        <div className="xl:col-span-2">
                            <label className="block text-sm font-medium text-text-muted mb-1">Chiave API Gemini</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={studio.ai_settings?.gemini_api_key || ''}
                                    onChange={e => setStudio({ ...studio, ai_settings: { ...studio.ai_settings, gemini_api_key: e.target.value } })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                    placeholder="Incolla qui la tua API Key"
                                />
                                <p className="text-xs text-text-muted mt-1">
                                    Necessaria per generare testi marketing con l'intelligenza artificiale.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-4 border-t border-border">
                        <div className="xl:col-span-2">
                            <h3 className="text-text-primary font-medium mb-4">Dati Fiscali</h3>
                        </div>
                        <div className="xl:col-span-2">
                            <label className="block text-sm font-medium text-text-muted mb-1">Ragione Sociale</label>
                            <input
                                type="text"
                                value={studio.company_name || ''}
                                onChange={e => setStudio({ ...studio, company_name: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                placeholder="Es. InkFlow S.r.l."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Partita IVA</label>
                            <input
                                type="text"
                                value={studio.vat_number || ''}
                                onChange={e => setStudio({ ...studio, vat_number: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Codice Fiscale</label>
                            <input
                                type="text"
                                value={studio.fiscal_code || ''}
                                onChange={e => setStudio({ ...studio, fiscal_code: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col items-end pt-4 gap-2 border-t border-border mt-6">
                        <div className="flex items-center gap-4">
                            {statusMsg && (
                                <span className={`text-sm ${statusMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    {statusMsg.text}
                                </span>
                            )}
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-accent hover:bg-accent-hover text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={18} />
                                {saving ? 'Salvataggio...' : 'Salva Modifiche'}
                            </button>
                        </div>
                    </div>
                </form>
            </div >
        </div >
    );
};
