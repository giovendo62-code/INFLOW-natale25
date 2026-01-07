import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Send, CheckCircle, AlertTriangle, PenTool, ArrowLeft, X } from 'lucide-react';
import clsx from 'clsx';
import { DigitalSignature } from '../consents/components/DigitalSignature';
import { DragDropUpload } from '../../components/DragDropUpload';
import type { ConsentTemplate } from '../../services/types';

export const WaitlistForm: React.FC = () => {
    const { studioId } = useParams<{ studioId: string }>();
    const [step, setStep] = useState<'DETAILS' | 'CONSENT'>('DETAILS');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [template, setTemplate] = useState<ConsentTemplate | null>(null);

    const [formData, setFormData] = useState({
        interest_type: 'TATTOO' as 'TATTOO' | 'ACADEMY',
        full_name: '',
        email: '',
        phone: '',
        fiscal_code: '',
        address: '',
        city: '',
        zip_code: '',
        styles: [] as string[],
        artist_pref_id: '',
        description: '',
        images: [] as string[] // Base64 strings for simplicity
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

    const [privacyAccepted, setPrivacyAccepted] = useState(false);

    const handleContinue = async (e: React.FormEvent) => {
        e.preventDefault();
        // Basic validation
        if (!formData.full_name || !formData.email || !formData.phone) {
            setError('Compila tutti i campi obbligatori');
            return;
        }

        if (!privacyAccepted) {
            setError('Devi accettare il consenso al trattamento dei dati per proseguire');
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
                // Client exists, skip consent
                await submitWaitlistRequest(null);
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

    const submitWaitlistRequest = async (signatureData: string | null) => {
        // If the client is new and consent is given, create the client first.
        // This logic is moved here from handleContinue to ensure client creation happens
        // only after consent is potentially given.
        let clientIdToUse = 'new'; // Default to 'new' for backend to handle
        if (step === 'CONSENT') { // This implies a new client is being processed
            try {
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
                clientIdToUse = newClient.id; // Use the newly created client's ID
            } catch (err) {
                console.error("Error creating new client:", err);
                throw new Error("Failed to create new client before waitlist submission.");
            }
        }

        await api.waitlist.addToWaitlist({
            studio_id: studioId || 'studio-1',
            client_id: clientIdToUse, // Use the created client ID or 'new'
            client_name: formData.full_name,
            email: formData.email, // Ensure email is passed
            phone: formData.phone,
            styles: formData.styles,
            interest_type: formData.interest_type,
            description: formData.description,
            artist_pref_id: formData.artist_pref_id,
            images: formData.images
        }, signatureData || undefined, template?.version);
        setSubmitted(true);
    };

    const handleSignatureSave = async (signatureData: string) => {
        setError(null);
        setLoading(true);

        try {
            await submitWaitlistRequest(signatureData);
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
                    <h2 className="text-2xl font-bold text-text-primary mb-2">Richiesta Inviata!</h2>
                    <p className="text-text-muted">
                        Grazie per esserti iscritto alla nostra lista d'attesa. Ti contatteremo non appena si libererà un posto.
                    </p>
                </div>
            </div>
        );
    }

    // Step 2: Consent & Signature
    if (step === 'CONSENT') {
        return (
            <div className="min-h-screen bg-bg-primary py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <button
                        onClick={() => setStep('DETAILS')}
                        className="flex items-center text-text-muted hover:text-text-primary"
                    >
                        <ArrowLeft size={20} className="mr-2" />
                        Torna ai Dati
                    </button>

                    <div className="bg-bg-secondary p-8 rounded-2xl border border-border shadow-xl">
                        <h2 className="text-2xl font-bold text-text-primary mb-6">Consenso Informato</h2>

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
                                    <h3 className="text-text-primary text-lg font-semibold mb-4 flex items-center gap-2">
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

    // Step 1: Details Form
    return (
        <div className="min-h-screen bg-bg-primary py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-text-primary mb-2">Lista d'Attesa</h1>
                    <p className="text-text-muted">Compila il modulo per essere ricontattato.</p>
                </div>

                <form onSubmit={handleContinue} className="bg-bg-secondary p-8 rounded-2xl border border-border shadow-xl space-y-6">
                    {/* Interest Type */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">A cosa sei interessato? *</h3>
                        <div className="flex gap-4">
                            <label className={clsx(
                                "flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                                formData.interest_type === 'TATTOO'
                                    ? "border-accent bg-accent/10 text-white"
                                    : "border-border bg-bg-tertiary text-text-muted hover:border-text-muted"
                            )}>
                                <input
                                    type="radio"
                                    name="interest_type"
                                    value="TATTOO"
                                    checked={formData.interest_type === 'TATTOO'}
                                    onChange={() => setFormData({ ...formData, interest_type: 'TATTOO' })}
                                    className="hidden"
                                />
                                <PenTool size={20} />
                                <span className="font-bold">Tatuaggio</span>
                            </label>
                            <label className={clsx(
                                "flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                                formData.interest_type === 'ACADEMY'
                                    ? "border-accent bg-accent/10 text-white"
                                    : "border-border bg-bg-tertiary text-text-muted hover:border-text-muted"
                            )}>
                                <input
                                    type="radio"
                                    name="interest_type"
                                    value="ACADEMY"
                                    checked={formData.interest_type === 'ACADEMY'}
                                    onChange={() => setFormData({ ...formData, interest_type: 'ACADEMY' })}
                                    className="hidden"
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🎓</span>
                                    <span className="font-bold">Academy</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Anagrafica */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Dati Personali</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-text-muted mb-1">Nome Completo *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
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
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
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
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
                                    placeholder="+39 333 0000000"
                                />
                            </div>
                            {/* NEW: Fiscal Code */}
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Codice Fiscale</label>
                                <input
                                    type="text"
                                    value={formData.fiscal_code}
                                    onChange={e => setFormData({ ...formData, fiscal_code: e.target.value.toUpperCase() })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none uppercase"
                                    placeholder="RSSMRA..."
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-text-muted mb-1">Indirizzo</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
                                    placeholder="Via Roma 1, Milano"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-muted mb-1">Città</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
                                        placeholder="Milano"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-muted mb-1">CAP</label>
                                    <input
                                        type="text"
                                        value={formData.zip_code}
                                        onChange={e => setFormData({ ...formData, zip_code: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
                                        placeholder="20100"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tattoo Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-text-primary border-b border-border pb-2">Idea Tatuaggio</h3>

                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">Stile Preferito</label>
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
                            <label className="block text-sm font-medium text-text-muted mb-1">Descrizione</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none min-h-[100px]"
                                placeholder="Descrivi brevemente la tua idea..."
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

                    <div className="pt-4 border-t border-border">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative flex items-center mt-1">
                                <input
                                    type="checkbox"
                                    required
                                    checked={privacyAccepted}
                                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                                    className="peer h-5 w-5 appearance-none rounded border border-border bg-bg-tertiary checked:bg-accent focus:ring-2 focus:ring-accent focus:ring-offset-0 focus:ring-offset-bg-primary transition-all"
                                />
                                <CheckCircle size={12} className="absolute left-[3px] top-[3px] text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                            </div>
                            <div className="flex-1">
                                <span className="block text-sm font-medium text-text-primary mb-1 group-hover:text-accent transition-colors">
                                    Consenso al trattamento dei dati personali *
                                </span>
                                <p className="text-xs text-text-muted leading-relaxed">
                                    Dichiaro di aver letto l'informativa sulla privacy e acconsento al trattamento dei miei dati personali ai fini della gestione della richiesta di appuntamento, in conformità con il GDPR (Regolamento UE 2016/679).
                                </p>
                            </div>
                        </label>
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
                        {loading ? 'Caricamento...' : (
                            <>
                                Prosegui
                                <Send size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
