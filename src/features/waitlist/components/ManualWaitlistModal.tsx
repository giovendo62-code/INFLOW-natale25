import React, { useState } from 'react';
import { api } from '../../../services/api';
import { X, Send, UserPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx'; // Assuming clsx is available as used elsewhere

interface ManualWaitlistModalProps {
    isOpen: boolean;
    onClose: () => void;
    studioId: string;
}

export const ManualWaitlistModal: React.FC<ManualWaitlistModalProps> = ({ isOpen, onClose, studioId }) => {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        interest_type: 'TATTOO' as 'TATTOO' | 'ACADEMY',
        notes: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Determine Identity (New or Existing)
            let clientID = 'new';

            // Only attempt lookup if contact info is present
            if (formData.email || formData.phone) {
                const existing = await api.clients.getByContact(
                    formData.email || '',
                    formData.phone || '',
                    studioId
                );
                if (existing) {
                    clientID = existing;
                }
            }

            // 2. Create Client (if needed)
            if (clientID === 'new') {
                // If no name is provided, give a fallback for the system record
                const nameToUse = formData.full_name.trim() || 'Cliente Manuale (Senza Nome)';

                const newClient = await api.clients.create({
                    studio_id: studioId,
                    full_name: nameToUse,
                    email: formData.email,
                    phone: formData.phone,
                    // Minimal default values
                    address: '',
                    city: '',
                    zip_code: '',
                    fiscal_code: '',
                    whatsapp_broadcast_opt_in: false,
                    preferred_styles: [],
                    images: []
                });
                clientID = newClient.id;
            }

            // 3. Add to Waitlist
            await api.waitlist.addToWaitlist({
                studio_id: studioId,
                client_id: clientID,
                client_name: formData.full_name || 'Cliente Manuale', // Display name in waitlist
                email: formData.email,
                phone: formData.phone,
                interest_type: formData.interest_type,
                description: formData.notes,
                styles: [], // Optional
                images: []
            }, undefined, undefined); // No signature, no template version for manual entry

            // Success
            queryClient.invalidateQueries({ queryKey: ['waitlist', studioId] });
            onClose();
            // Reset form
            setFormData({
                full_name: '',
                email: '',
                phone: '',
                interest_type: 'TATTOO',
                notes: ''
            });

        } catch (error) {
            console.error("Manual Entry Error:", error);
            alert("Errore durante l'inserimento. Controlla la console.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-bg-secondary w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                            <UserPlus className="text-accent" size={24} />
                            Inserimento Manuale
                        </h2>
                        <p className="text-sm text-text-muted">Aggiungi un nominativo alla lista d'attesa (tutti i campi sono opzionali).</p>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="manual-entry-form" onSubmit={handleSubmit} className="space-y-4">

                        {/* Type Selection */}
                        <div className="flex gap-2 p-1 bg-bg-tertiary rounded-lg">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, interest_type: 'TATTOO' })}
                                className={clsx(
                                    "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                    formData.interest_type === 'TATTOO'
                                        ? "bg-bg-primary text-accent shadow-sm"
                                        : "text-text-muted hover:text-text-primary"
                                )}
                            >
                                Tattoo
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, interest_type: 'ACADEMY' })}
                                className={clsx(
                                    "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                                    formData.interest_type === 'ACADEMY'
                                        ? "bg-bg-primary text-purple-400 shadow-sm"
                                        : "text-text-muted hover:text-text-primary"
                                )}
                            >
                                Academy
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1">Nome Completo</label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder="Es. Mario Rossi"
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:border-accent outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="email@esempio.com"
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:border-accent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-text-muted mb-1">Telefono</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+39 333..."
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:border-accent outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-text-muted mb-1">Note / Descrizione</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Note aggiuntive..."
                                rows={3}
                                className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary focus:border-accent outline-none"
                            />
                        </div>

                        {/* Info Message */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3">
                            <div className="min-w-[4px] h-full bg-blue-500 rounded-full" />
                            <div className="text-xs text-blue-400">
                                <p className="font-bold mb-1">Funzionamento automatico</p>
                                <p>Se l'email o il telefono corrispondono a un cliente esistente, questa richiesta verrà associata automaticamente. Altrimenti verrà creato un nuovo cliente.</p>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex justify-end gap-3 bg-bg-secondary rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                    >
                        Annulla
                    </button>
                    <button
                        type="submit"
                        form="manual-entry-form"
                        disabled={loading}
                        className="px-6 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Salvataggio...' : (
                            <>
                                <Send size={16} />
                                Inserisci
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};
