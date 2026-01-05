import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Send, CheckCircle, AlertTriangle, PenTool, ArrowLeft, X } from 'lucide-react';
import clsx from 'clsx';
import { DigitalSignature } from '../consents/components/DigitalSignature';
import { DragDropUpload } from '../../components/DragDropUpload';
import type { ConsentTemplate } from '../../services/types';
import { generateConsentPDF } from '../../utils/pdfGenerator';

export const PublicClientForm: React.FC = () => {
    const { studioId } = useParams<{ studioId: string }>();
    const [step, setStep] = useState<'DETAILS' | 'CONSENT'>('DETAILS');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [template, setTemplate] = useState<ConsentTemplate | null>(null);

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        fiscal_code: '',
        address: '',
        city: '',
        zip_code: '',
        styles: [] as string[],
        description: '',
        images: [] as string[]
    });

    useEffect(() => {
        // Fetch consent template on mount
        const loadTemplate = async () => {
            try {
                const t = await api.consents.getTemplate(studioId || 'studio-1');
                setTemplate(t);
            } catch (err) {
                console.error("Error loading template:", err);
            }
        };
        loadTemplate();
    }, [studioId]);

    const STYLES = ['Realistico', 'Minimal', 'Old School', 'Blackwork', 'Lettering', 'Colorato', 'Geometrico'];

    const handleContinue = async (e: React.FormEvent) => {
        e.preventDefault();

        // Comprehensive validation
        if (!formData.full_name || !formData.email || !formData.phone ||
            !formData.fiscal_code || !formData.address || !formData.city || !formData.zip_code) {
            setError('Compila tutti i campi obbligatori nei Dati Personali');
            return;
        }

        if (formData.styles.length === 0) {
            setError('Seleziona almeno uno stile preferito');
            return;
        }

        if (!formData.description.trim()) {
            setError('Inserisci una descrizione o delle note');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            // Check if client exists
            const clients = await api.clients.list(studioId || 'studio-1');
            const existingClient = clients.find(c =>
                c.email.toLowerCase() === formData.email.toLowerCase() ||
                c.phone === formData.phone
            );

            if (existingClient) {
                // Client exists
                setError('Sei già registrato come cliente!');
            } else {
                // New client, require consent
                setStep('CONSENT');
            }
        } catch (err) {
            console.error(err);
            setError('Si è verificato un errore. Riprova.');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({
                ...prev,
                images: [...prev.images, reader.result as string]
            }));
        };
        reader.readAsDataURL(file);
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };


    const submitRegistration = async (signatureData: string) => {
        try {
            // 1. Create client first
            const newClient = await api.clients.create({
                full_name: formData.full_name || 'Nuovo Cliente',
                email: formData.email,
                phone: formData.phone || '',
                studio_id: studioId || 'studio-1',
                address: formData.address || '',
                city: formData.city || '',
                zip_code: formData.zip_code || '',
                fiscal_code: formData.fiscal_code || '',
                whatsapp_broadcast_opt_in: false,
                preferred_styles: formData.styles || [],
                images: []
            });

            // 2. If consent step active, save signature and generate PDF
            if (step === 'CONSENT' && template && signatureData) {
                try {
                    const consent = await api.consents.signConsent(
                        newClient.id,
                        template.id,
                        signatureData,
                        template.version,
                        'client'
                    );

                    // Fetch studio for real data in PDF
                    const studio = await api.settings.getStudio(studioId || 'studio-1');

                    // 3. Generate and download PDF
                    await generateConsentPDF(newClient, template, consent, studio);

                } catch (consentError) {
                    console.error("Error saving consent:", consentError);
                    // We don't block success, but we should log it. 
                    // Maybe show a warning? For now we proceed as client is created.
                }
            }

            setSubmitted(true);
        } catch (err) {
            console.error("Error creating new client:", err);
            throw new Error("Failed to create new client.");
        }
    };

    const handleSignatureSave = async (signatureData: string) => {
        setError(null);
        setLoading(true);

        try {
            await submitRegistration(signatureData);
        } catch (err) {
            console.error(err);
            setError('Si è verificato un errore. Riprova più tardi.');
            setLoading(false);
        }
    };

    const toggleStyle = (style: string) => {
        setFormData(prev => ({
            ...prev,
            styles: prev.styles.includes(style)
                ? prev.styles.filter(s => s !== style)
                : [...prev.styles, style]
        }));
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-bg-secondary p-8 rounded-2xl border border-accent/20 text-center">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Registrazione Completata!</h2>
                    <p className="text-text-muted">
                        I tuoi dati sono stati inseriti correttamente nel nostro database.
                    </p>
                </div>
            </div>
        );
    }

    // Step 2: Consent & Signature (Reuse logic)
    if (step === 'CONSENT') {
        return (
            <div className="min-h-screen bg-bg-primary py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <button
                        onClick={() => setStep('DETAILS')}
                        className="flex items-center text-text-muted hover:text-white"
                    >
                        <ArrowLeft size={20} className="mr-2" />
                        Torna ai Dati
                    </button>

                    <div className="bg-bg-secondary p-8 rounded-2xl border border-border shadow-xl">
                        <h2 className="text-2xl font-bold text-white mb-6">Consenso Informato</h2>

                        {template ? (
                            <div className="space-y-8">
                                <div className="bg-white text-black p-6 rounded-lg prose max-w-none max-h-[400px] overflow-y-auto">
                                    <div dangerouslySetInnerHTML={{
                                        __html: template.content
                                            .replace('{{nome}}', formData.full_name.split(' ')[0] || '')
                                            .replace('{{cognome}}', formData.full_name.split(' ').slice(1).join(' ') || '')
                                            .replace('{{data_nascita}}', '---')
                                            .replace('{{codice_fiscale}}', formData.fiscal_code || '---')
                                    }} />
                                </div>

                                <div>
                                    <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                                        <PenTool size={20} className="text-accent" />
                                        Firma qui sotto per accettare
                                    </h3>
                                    {loading ? (
                                        <div className="text-center py-8 text-text-muted">Caricamento in corso...</div>
                                    ) : (
                                        <DigitalSignature
                                            onSave={handleSignatureSave}
                                            onClear={() => { }}
                                        />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-text-muted">
                                Impossibile caricare il consenso. Contatta lo studio.
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center mt-4">
                                <AlertTriangle size={20} className="mr-2 flex-shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg-primary py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2">Registrazione Cliente</h1>
                    <p className="text-text-muted">Compila il modulo per registrarti nel nostro studio.</p>
                </div>

                <form onSubmit={handleContinue} className="bg-bg-secondary p-8 rounded-2xl border border-border shadow-xl space-y-6">
                    {/* Anagrafica */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-border pb-2">Dati Personali</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-text-muted mb-1">Nome Completo *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none"
                                    placeholder="Mario Rossi"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Email *</label>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none"
                                    placeholder="mario@email.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Telefono *</label>
                                <input
                                    required
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none"
                                    placeholder="+39 333 0000000"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Codice Fiscale *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.fiscal_code}
                                    onChange={e => setFormData({ ...formData, fiscal_code: e.target.value.toUpperCase() })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none uppercase"
                                    placeholder="RSSMRA..."
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-text-muted mb-1">Indirizzo *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none"
                                    placeholder="Via Roma 1, Milano"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-muted mb-1">Città *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none"
                                        placeholder="Milano"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-muted mb-1">CAP *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.zip_code}
                                        onChange={e => setFormData({ ...formData, zip_code: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none"
                                        placeholder="20100"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tattoo Info (Optional for simpleregistration but kept as user asked 'like waitlist') */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-border pb-2">Preferenze</h3>

                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">Stili Preferiti *</label>
                            <div className="flex flex-wrap gap-2">
                                {STYLES.map(style => (
                                    <button
                                        key={style}
                                        type="button"
                                        onClick={() => toggleStyle(style)}
                                        className={clsx(
                                            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                                            formData.styles.includes(style)
                                                ? "bg-accent/20 border-accent text-accent"
                                                : "bg-bg-tertiary border-border text-text-muted hover:border-text-muted"
                                        )}
                                    >
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Note / Idee *</label>
                            <textarea
                                required
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none min-h-[100px]"
                                placeholder="Note aggiuntive..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">Immagini di Riferimento</label>
                            <DragDropUpload
                                onUpload={handleImageUpload}
                                label="Carica immagini"
                                sublabel="Clicca o trascina per aggiungere reference"
                                className="mb-4"
                            />
                            {formData.images.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {formData.images.map((img, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                                            <img src={img} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(idx)}
                                                className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 rounded-full text-white transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center">
                            <AlertTriangle size={20} className="mr-2 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-accent text-white py-4 rounded-xl font-semibold hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Elaborazione...' : (
                            <>
                                Conferma Registrazione
                                <Send size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
