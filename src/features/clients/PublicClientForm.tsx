import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Send, CheckCircle, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';
import { DragDropUpload } from '../../components/DragDropUpload';

export const PublicClientForm: React.FC = () => {
    const { studioId } = useParams<{ studioId: string }>();
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        fiscal_code: '',
        address: '',
        city: '',
        zip_code: '',
        styles: [] as string[],
        description: '',
        images: [] as string[],
        privacy_consent: false
    });



    const STYLES = ['Realistico', 'Minimal', 'Old School', 'Blackwork', 'Lettering', 'Colorato', 'Geometrico'];

    const handleContinue = async (e: React.FormEvent) => {
        e.preventDefault();

        // Comprehensive validation
        if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone ||
            !formData.fiscal_code || !formData.address || !formData.city || !formData.zip_code) {
            setError('Compila tutti i campi obbligatori nei Dati Personali');
            return;
        }

        if (formData.styles.length === 0) {
            setError('Seleziona almeno uno stile preferito');
            return;
        }

        if (!formData.privacy_consent) {
            setError('Devi accettare il trattamento dei dati personali e della privacy per procedere');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            // Check if client exists using secure RPC
            const existingClientId = await api.clients.getByContact(
                formData.email,
                formData.phone,
                studioId || 'studio-1'
            );

            if (existingClientId) {
                // Client exists
                setError('Sei già registrato come cliente!');
                setLoading(false);
            } else {
                // New client, proceed to registration immediately
                await submitRegistration();
            }
        } catch (err) {
            console.error(err);
            setError('Si è verificato un errore. Riprova.');
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


    const submitRegistration = async () => {
        try {
            // 1. Create client first
            if (api.clients.createPublic) {
                await api.clients.createPublic({
                    full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
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
            } else {
                await api.clients.create({
                    full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
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
            }

            // 2. Consent step removed for public form (will be handled by studio)
            // if (step === 'CONSENT' && template && signatureData && clientIdToUse) { ... }

            setSubmitted(true);
        } catch (err) {
            console.error("Error creating new client:", err);
            throw new Error("Failed to create new client.");
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
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Nome *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.first_name}
                                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none"
                                    placeholder="Mario"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Cognome *</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.last_name}
                                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-white focus:border-accent focus:outline-none"
                                    placeholder="Rossi"
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
                            <label className="block text-sm font-medium text-text-muted mb-1">Note / Idee (Opzionale)</label>
                            <textarea
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


                    <div className="bg-bg-tertiary p-4 rounded-xl border border-border/50">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative flex items-center mt-1">
                                <input
                                    type="checkbox"
                                    required
                                    checked={formData.privacy_consent}
                                    onChange={e => setFormData({ ...formData, privacy_consent: e.target.checked })}
                                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-border bg-bg-secondary checked:border-accent checked:bg-accent transition-all"
                                />
                                <CheckCircle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" size={14} />
                            </div>
                            <div className="text-sm text-text-muted group-hover:text-text-secondary transition-colors">
                                <span className="font-bold text-white">Consenso Privacy e Trattamento Dati *</span>
                                <p className="mt-1 leading-relaxed">
                                    Dichiaro di aver letto e compreso l'informativa sulla privacy e acconsento al trattamento dei miei dati personali per le finalità legate alla gestione del servizio e agli obblighi di legge.
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
                        {loading ? 'Elaborazione...' : (
                            <>
                                Conferma Registrazione
                                <Send size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div >
        </div >
    );
};
