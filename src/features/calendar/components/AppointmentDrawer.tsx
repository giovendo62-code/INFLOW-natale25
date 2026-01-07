import React, { useState, useEffect } from 'react';
import { useLayoutStore } from '../../../stores/layoutStore';
import { X, Save, Trash2, Clock, User, Calendar as CalIcon, Banknote, Search, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import type { Appointment, Client, User as StudioUser } from '../../../services/types';
import { api } from '../../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { format } from 'date-fns';
import { DragDropUpload } from '../../../components/DragDropUpload';

interface AppointmentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    selectedAppointment: Appointment | null;
    onSave: (data: Partial<Appointment>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    initialClientId?: string;
}

export const AppointmentDrawer: React.FC<AppointmentDrawerProps> = ({
    isOpen,
    onClose,
    selectedDate,
    selectedAppointment,
    onSave,
    onDelete,
    initialClientId
}) => {
    const { user } = useAuth();
    const { isPrivacyMode } = useLayoutStore();
    const [clients, setClients] = useState<Client[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [artists, setArtists] = useState<StudioUser[]>([]);

    // Delete Confirmation State
    const [isDeleting, setIsDeleting] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Appointment>>({
        service_name: '',
        client_id: '',
        artist_id: '',
        start_time: '',
        end_time: '',
        status: 'PENDING',
        notes: '',
        images: []
    });

    // Load Clients and Artists on Mount (or when drawer opens)
    useEffect(() => {
        if (isOpen && user?.studio_id) {
            const loadData = async () => {
                console.log('AppointmentDrawer: Loading data for studio:', user.studio_id);
                const [clientsList, teamList] = await Promise.all([
                    api.clients.list(undefined, user.studio_id!),
                    api.settings.listTeamMembers(user.studio_id!)
                ]);
                console.log('AppointmentDrawer: Raw Team List:', teamList);
                const filtered = teamList.filter(m => (m.role || '').toUpperCase() === 'ARTIST');
                console.log('AppointmentDrawer: Filtered Artists:', filtered);
                setClients(clientsList);
                setArtists(filtered);
            };
            loadData();
        }
    }, [isOpen, user?.studio_id]);

    // Reset delete state when drawer closes or selection changes
    useEffect(() => {
        setIsDeleting(false);
    }, [isOpen, selectedAppointment]);

    // Initialize Form Data
    useEffect(() => {
        if (selectedAppointment) {
            setFormData({
                ...selectedAppointment,
                images: selectedAppointment.images || []
            });
        } else if (selectedDate || isOpen) {
            // Default to current user if they are an artist, otherwise first artist found
            const defaultArtist = user?.role === 'ARTIST' ? user.id : (artists.length > 0 ? artists[0].id : '');

            // Use provided selectedDate or fallback to now next hour
            const baseDate = selectedDate || new Date();
            // Round up to next hour if strictly "now"
            if (!selectedDate) {
                baseDate.setMinutes(0, 0, 0);
                baseDate.setHours(baseDate.getHours() + 1);
            }

            setFormData({
                service_name: '',
                client_id: initialClientId || '',
                artist_id: defaultArtist,
                start_time: baseDate.toISOString(),
                end_time: new Date(baseDate.getTime() + 60 * 60 * 1000).toISOString(), // +1 hour
                status: 'PENDING',
                notes: '',
                images: []
            });
        }
    }, [selectedAppointment, selectedDate, isOpen, user, artists, initialClientId]);

    const handleUpload = async (file: File) => {
        try {
            // Upload to Supabase Storage
            // Use appointment ID if available, otherwise 'temp' or timestamp folder
            const path = `appointments/${Date.now()}_${file.name}`;
            const publicUrl = await api.storage.upload('attachments', path, file);

            setFormData(prev => ({
                ...prev,
                images: [...(prev.images || []), publicUrl]
            }));
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Errore durante il caricamento dell\'immagine. Riprova.');
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images?.filter((_, i) => i !== index)
        }));
    };

    const STATUS_LABELS: Record<string, string> = {
        PENDING: 'IN ATTESA',
        CONFIRMED: 'CONFERMATO',
        COMPLETED: 'COMPLETATO',
        NO_SHOW: 'ASSENTE'
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed top-0 right-0 h-[100dvh] w-full md:w-[500px] bg-bg-secondary border-l border-border shadow-2xl z-50 transform transition-transform duration-300 flex flex-col overflow-x-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-bg-secondary sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-1 -ml-2 text-text-muted hover:text-white md:hidden"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <h2 className="text-xl font-bold text-text-primary">
                            {selectedAppointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-bg-tertiary rounded-lg text-text-muted transition-colors hidden md:block">
                        <X size={20} />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-bg-tertiary rounded-lg text-text-muted transition-colors md:hidden">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-6">

                    {/* Artist Selection */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Artista</label>
                        <select
                            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-accent outline-none"
                            value={formData.artist_id}
                            onChange={(e) => setFormData({ ...formData, artist_id: e.target.value })}
                        >
                            <option value="">Seleziona Artista</option>
                            {artists.map(artist => (
                                <option key={artist.id} value={artist.id}>
                                    {artist.full_name ? `${artist.full_name} (${artist.email})` : artist.email}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Client Selection */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Cliente</label>
                        <div className="space-y-2">
                            {/* Search Input */}
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none placeholder:text-text-muted"
                                    placeholder="Cerca cliente..."
                                    value={clientSearch}
                                    onChange={(e) => setClientSearch(e.target.value)}
                                />
                                <Search className="absolute left-3 top-2.5 text-text-muted" size={18} />
                            </div>

                            {/* Dropdown */}
                            <div className="relative">
                                <select
                                    className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none appearance-none"
                                    value={formData.client_id}
                                    onChange={(e) => {
                                        setFormData({ ...formData, client_id: e.target.value });
                                        // Optional: clear search on selection? Users might prefer it stays.
                                        // For now, let's keep it simple.
                                    }}
                                >
                                    <option value="">Seleziona Cliente</option>
                                    {clients
                                        .filter(client =>
                                            client.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                            client.email.toLowerCase().includes(clientSearch.toLowerCase())
                                        )
                                        .map(client => (
                                            <option key={client.id} value={client.id}>{client.full_name}</option>
                                        ))
                                    }
                                </select>
                                <User className="absolute left-3 top-2.5 text-text-muted" size={18} />
                            </div>
                        </div>
                    </div>

                    {/* Service Section */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Servizio</label>
                        <input
                            type="text"
                            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                            placeholder="es. Tatuaggio Braccio, Ritocco..."
                            value={formData.service_name}
                            onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                        />
                    </div>

                    {/* Financials (Price & Deposit) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Preventivo (€)</label>
                            <div className="relative">
                                <input
                                    type={isPrivacyMode ? "password" : "number"}
                                    min="0"
                                    step="10"
                                    className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                    placeholder={isPrivacyMode ? "••••" : "0.00"}
                                    value={formData.price || ''}
                                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                />
                                <Banknote className="absolute left-3 top-2.5 text-text-muted" size={18} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Acconto (€)</label>
                            <div className="relative">
                                <input
                                    type={isPrivacyMode ? "password" : "number"}
                                    min="0"
                                    step="10"
                                    className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                    placeholder={isPrivacyMode ? "••••" : "0.00"}
                                    value={formData.deposit || ''}
                                    onChange={(e) => setFormData({ ...formData, deposit: parseFloat(e.target.value) || 0 })}
                                />
                                <Banknote className="absolute left-3 top-2.5 text-text-muted" size={18} />
                            </div>
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-medium text-text-secondary mb-2">Data</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                    value={formData.start_time ? format(new Date(formData.start_time), 'yyyy-MM-dd') : ''}
                                    onChange={(e) => {
                                        if (!e.target.value) return;
                                        const newDate = new Date(e.target.value);
                                        const currentStart = new Date(formData.start_time!);
                                        newDate.setHours(currentStart.getHours(), currentStart.getMinutes());

                                        const currentEnd = new Date(formData.end_time!);
                                        const duration = currentEnd.getTime() - currentStart.getTime();

                                        setFormData({
                                            ...formData,
                                            start_time: newDate.toISOString(),
                                            end_time: new Date(newDate.getTime() + duration).toISOString()
                                        });
                                    }}
                                />
                                <CalIcon className="absolute left-3 top-2.5 text-text-muted" size={18} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Ora Inizio</label>
                            <div className="relative">
                                <input
                                    type="time"
                                    className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                    value={formData.start_time ? format(new Date(formData.start_time), 'HH:mm') : ''}
                                    onChange={(e) => {
                                        if (!e.target.value) return;
                                        const [hours, mins] = e.target.value.split(':').map(Number);
                                        const newStart = new Date(formData.start_time!);
                                        newStart.setHours(hours, mins);

                                        const currentEnd = new Date(formData.end_time!);
                                        const currentStart = new Date(formData.start_time!);
                                        const duration = currentEnd.getTime() - currentStart.getTime();

                                        setFormData({
                                            ...formData,
                                            start_time: newStart.toISOString(),
                                            end_time: new Date(newStart.getTime() + duration).toISOString()
                                        });
                                    }}
                                />
                                <Clock className="absolute left-3 top-2.5 text-text-muted" size={18} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">Ora Fine</label>
                            <div className="relative">
                                <input
                                    type="time"
                                    className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                    value={formData.end_time ? format(new Date(formData.end_time), 'HH:mm') : ''}
                                    onChange={(e) => {
                                        if (!e.target.value) return;
                                        const [hours, mins] = e.target.value.split(':').map(Number);
                                        const newEnd = new Date(formData.end_time!);
                                        newEnd.setHours(hours, mins);

                                        setFormData({
                                            ...formData,
                                            end_time: newEnd.toISOString()
                                        });
                                    }}
                                />
                                <Clock className="absolute left-3 top-2.5 text-text-muted" size={18} />
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Stato</label>
                        <div className="flex gap-2 bg-bg-primary p-1 rounded-lg border border-border">
                            {['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFormData({ ...formData, status: status as any })}
                                    className={clsx(
                                        "flex-1 py-2 text-xs font-medium rounded transition-all",
                                        formData.status === status
                                            ? "bg-accent text-white shadow-sm"
                                            : "text-text-muted hover:text-text-primary"
                                    )}
                                >
                                    {STATUS_LABELS[status]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reference Images */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Immagini di Riferimento</label>
                        <DragDropUpload onUpload={handleUpload} className="py-4" label="Aggiungi referenza" />

                        {formData.images && formData.images.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                {formData.images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border group cursor-pointer" onClick={() => window.open(img, '_blank')}>
                                        <img src={img} alt="Referenza" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">Apri</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                                            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all z-10"
                                            title="Chiudi"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Note</label>
                        <textarea
                            className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none min-h-[100px]"
                            placeholder="Dettagli aggiuntivi..."
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 pb-24 md:pb-6 border-t border-border flex items-center justify-between bg-bg-secondary sticky bottom-0 z-10 transition-colors">
                    {selectedAppointment && onDelete ? (
                        <div className="flex items-center gap-2">
                            {isDeleting ? (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                    <span className="text-sm text-text-muted mr-2">Confermi?</span>
                                    <button
                                        onClick={() => onDelete(selectedAppointment.id)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Sì, elimina
                                    </button>
                                    <button
                                        onClick={() => setIsDeleting(false)}
                                        className="bg-bg-tertiary hover:bg-bg-primary text-text-primary px-3 py-2 rounded-lg text-sm transition-colors border border-border"
                                    >
                                        Annulla
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsDeleting(true)}
                                    className="text-red-500 hover:text-red-400 p-2 transition-colors flex items-center gap-2 hover:bg-red-500/10 rounded-lg"
                                >
                                    <Trash2 size={20} />
                                    <span className="font-medium">Elimina</span>
                                </button>
                            )}
                        </div>
                    ) : <div />}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="bg-bg-primary hover:bg-bg-tertiary text-text-primary px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-black/20 border border-border"
                        >
                            Annulla
                        </button>
                        <button
                            onClick={() => {
                                if (!formData.start_time || !formData.end_time) {
                                    alert('Data e Orario sono obbligatori');
                                    return;
                                }

                                // Sanitize data: remove joined objects that are not columns in appointments table
                                const { client, artist, ...dataToSave } = formData as any;

                                // Ensure studio_id is set
                                if (!dataToSave.studio_id && user?.studio_id) {
                                    dataToSave.studio_id = user.studio_id;
                                }

                                onSave(dataToSave);
                            }}
                            className="bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                        >
                            <Save size={20} />
                            <span>Salva</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};
