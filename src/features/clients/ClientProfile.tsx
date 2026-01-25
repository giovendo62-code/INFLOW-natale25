import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Calendar, Image, FileText, Activity, X, Save, Tag, MapPin, CreditCard, ClipboardList } from 'lucide-react';
import { api } from '../../services/api';
import { supabase } from '../../lib/supabase';
import type { Client, WaitlistEntry, ClientConsent } from '../../services/types';
import clsx from 'clsx';

import { Trash2, Eye } from 'lucide-react';
import { generateConsentPDF } from '../../utils/pdfGenerator';

// Custom Drag & Drop Component removed, imported from components
import { DragDropUpload } from '../../components/DragDropUpload';
import { AppointmentDrawer } from '../calendar/components/AppointmentDrawer';
import type { Appointment } from '../../services/types';
import { useAuth } from '../auth/AuthContext';

export const ClientProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [client, setClient] = useState<Client | null>(null);
    const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [consents, setConsents] = useState<ClientConsent[]>([]);
    const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('gallery'); // Default to Gallery
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Client>>({});

    const [isAppointmentDrawerOpen, setIsAppointmentDrawerOpen] = useState(false);

    const isNewClient = id === 'new';
    const fromWaitlist = location.state?.fromWaitlist;

    useEffect(() => {
        if (isNewClient) {
            setClient({
                id: 'new',
                full_name: '',
                email: '',
                phone: '',
                whatsapp_broadcast_opt_in: false,
                studio_id: user?.studio_id || '',
                preferred_styles: []
            } as Client);
            setFormData({});
            setIsEditing(true);
            setLoading(false);
        } else if (id) {
            loadClient(id);
        }
    }, [id]);

    const loadClient = async (clientId: string) => {
        if (clientId === 'new') return;
        setLoading(true);
        try {
            const data = await api.clients.getById(clientId);
            setClient(data);

            // Fetch History & Consents
            const history = await api.appointments.listByClient(clientId);
            setAppointments(history);

            const clientConsents = await api.consents.listClientConsents(clientId);
            setConsents(clientConsents);

            // Fetch Waitlist Entry if exists
            if (data?.id) {
                const { data: entries } = await supabase
                    .from('waitlist_entries')
                    .select('*')
                    .eq('client_id', data.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (entries && entries.length > 0) {
                    setWaitlistEntry(entries[0]);
                    // If navigated from waitlist, show Request tab by default
                    if (fromWaitlist) {
                        setActiveTab('request');
                    }
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (fromWaitlist) {
            navigate('/waitlist');
        } else {
            navigate('/clients');
        }
    };

    const handleUpload = async (file: File) => {
        if (!client || id === 'new') {
            alert('Salva prima il cliente per caricare le immagini.');
            return;
        }

        try {
            // Upload to Supabase Storage
            const path = `clients/${client.id}/${Date.now()}_${file.name}`;
            // Use 'clients' bucket
            const url = await api.storage.upload('clients', path, file);

            const newImage = {
                id: crypto.randomUUID(),
                url,
                description: file.name,
                uploaded_at: new Date().toISOString()
            };

            const updatedImages = [...(client.images || []), newImage];

            // Update UI immediately (optimistic)
            setClient({ ...client, images: updatedImages });

            // Persist to DB
            // Note: DB expects 'images' jsonb column to matches ClientImage[] structure
            await api.clients.update(client.id, { images: updatedImages });

        } catch (error: any) {
            console.error('Upload failed:', error);
            alert('Errore durante il caricamento: ' + error.message);
            // Revert on error would be ideal, but for now just alert
        }
    };

    const handleDeleteImage = async (imgId: string) => {
        if (!client) return;
        if (!window.confirm('Eliminare questa immagine?')) return;

        try {
            const updatedImages = (client.images || []).filter(img => img.id !== imgId);

            // Update UI
            setClient({ ...client, images: updatedImages });

            // Persist
            await api.clients.update(client.id, { images: updatedImages });

        } catch (error: any) {
            console.error('Delete failed:', error);
            alert('Errore eliminazione: ' + error.message);
        }
    };

    const handleEditClick = () => {
        if (client) {
            setFormData({
                full_name: client.full_name,
                email: client.email,
                phone: client.phone,
                preferred_styles: client.preferred_styles,
                whatsapp_broadcast_opt_in: client.whatsapp_broadcast_opt_in,
                fiscal_code: client.fiscal_code,
                address: client.address,
                city: client.city,
                zip_code: client.zip_code
            });
            setIsEditing(true);
        }
    };

    const handleCancelClick = () => {
        if (isNewClient) {
            navigate('/clients');
            return;
        }
        setIsEditing(false);
        setFormData({});
    };

    const handleDeleteClick = async () => {
        if (!client || isNewClient) return;
        if (confirm('Sei sicuro di voler eliminare questo cliente? Questa azione non può essere annullata.')) {
            try {
                await api.clients.delete(client.id);
                navigate('/clients', { replace: true });
            } catch (error) {
                console.error('Error deleting client:', error);
                alert('Errore durante l\'eliminazione');
            }
        }
    };

    const handleSaveClick = async () => {
        if (!client) return;

        // Validation
        if (!formData.full_name?.trim()) {
            alert('Il nome completo è obbligatorio.');
            return;
        }

        try {
            if (isNewClient) {
                if (!user?.studio_id) {
                    alert('Errore: Nessuno studio associato al tuo utente. Ricarica la pagina o contatta il supporto.');
                    return;
                }

                const newClient = await api.clients.create({
                    full_name: formData.full_name || 'Nuovo Cliente',
                    email: formData.email || '',
                    phone: formData.phone || '',
                    whatsapp_broadcast_opt_in: formData.whatsapp_broadcast_opt_in || false,
                    preferred_styles: formData.preferred_styles || [],
                    fiscal_code: formData.fiscal_code || '',
                    address: formData.address || '',
                    city: formData.city || '',
                    zip_code: formData.zip_code || '',
                    studio_id: user.studio_id
                });

                // --- AUTO SYNC TO GOOGLE SHEETS ---
                try {
                    // Fetch Studio Config
                    const { data: studioData } = await supabase
                        .from('studios')
                        .select('google_sheets_config')
                        .eq('id', user.studio_id)
                        .single();

                    const config = studioData?.google_sheets_config;

                    if (config && config.auto_sync_enabled && config.spreadsheet_id && config.sheet_name) {
                        // Prepare row data
                        const rowData = [
                            newClient.full_name || '',
                            newClient.email || '',
                            newClient.phone || '',
                            newClient.fiscal_code || '',
                            newClient.address || '',
                            newClient.city || '',
                            newClient.zip_code || '',
                            newClient.notes || '',
                            new Date().toLocaleDateString() // Registrato Il
                        ];

                        // Call Edge Function
                        await supabase.functions.invoke('fetch-google-sheets', {
                            body: {
                                action: 'append_data',
                                spreadsheetId: config.spreadsheet_id,
                                sheetName: config.sheet_name,
                                values: [rowData]
                            }
                        });
                        console.log('✅ Auto-synced to Google Sheets');
                    }
                } catch (syncError) {
                    console.error('⚠️ Auto-sync failed (non-blocking):', syncError);
                    // Do not block UI/User flow
                }
                // ----------------------------------

                navigate(`/clients/${newClient.id}`, { replace: true });
            } else {
                const updatedClient = await api.clients.update(client.id, formData);
                setClient(updatedClient);
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Errore durante il salvataggio');
        }
    };

    const handleInputChange = (field: keyof Client, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveAppointment = async (appointmentData: Partial<Appointment>) => {
        try {
            await api.appointments.create({
                ...appointmentData,
                client_id: client?.id || '',
                // Ensure required fields
                service_name: appointmentData.service_name || 'Nuovo Appuntamento',
                artist_id: appointmentData.artist_id || '',
                start_time: appointmentData.start_time || new Date().toISOString(),
                end_time: appointmentData.end_time || new Date().toISOString(),
                status: 'PENDING'
            } as Appointment);
            setIsAppointmentDrawerOpen(false);
            alert('Appuntamento creato con successo!');
        } catch (error) {
            console.error('Error creating appointment:', error);
            alert('Errore durante la creazione dell\'appuntamento');
        }
    };

    const handleDeleteAppointment = async (aptId: string) => {
        if (!confirm('Eliminare questo appuntamento?')) return;
        try {
            await api.appointments.delete(aptId);
            setAppointments(prev => prev.filter(a => a.id !== aptId));
            setSelectedAppointments(prev => prev.filter(id => id !== aptId));
        } catch (error) {
            console.error('Error deleting appointment:', error);
            alert('Errore durante l\'eliminazione');
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Eliminare ${selectedAppointments.length} appuntamenti selezionati?`)) return;
        try {
            // Delete sequentially to avoid race conditions or use a bulk API if available
            for (const id of selectedAppointments) {
                await api.appointments.delete(id);
            }
            setAppointments(prev => prev.filter(a => !selectedAppointments.includes(a.id)));
            setSelectedAppointments([]);
        } catch (error) {
            console.error('Error bulk deleting:', error);
            alert('Errore durante l\'eliminazione multipla');
        }
    };

    const toggleSelection = (aptId: string) => {
        setSelectedAppointments(prev =>
            prev.includes(aptId) ? prev.filter(id => id !== aptId) : [...prev, aptId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedAppointments.length === appointments.length) {
            setSelectedAppointments([]);
        } else {
            setSelectedAppointments(appointments.map(a => a.id));
        }
    };

    const totalSpent = appointments.reduce((sum, apt) => sum + (apt.price || 0), 0);

    const [downloadingConsent, setDownloadingConsent] = useState<string | null>(null);

    const handleDownloadPDF = async (consent: ClientConsent) => {
        if (!client) return;
        setDownloadingConsent(consent.id);
        try {
            const template = await api.consents.getTemplate(client.studio_id);
            if (!template) throw new Error("Template not found");

            const studio = await api.settings.getStudio(client.studio_id);
            await generateConsentPDF(client, template, consent, studio);
        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Errore nella generazione del PDF');
        } finally {
            setDownloadingConsent(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-text-muted">Caricamento profilo...</div>;
    if (!client) return <div className="p-8 text-center text-red-500">Cliente non trovato</div>;

    return (
        <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b border-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10">
                <button
                    onClick={handleBack}
                    className="p-2 hover:bg-white/5 rounded-full text-text-secondary transition-colors"
                    title={fromWaitlist ? "Torna alla lista d'attesa" : "Torna ai clienti"}
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-3">
                        {isNewClient ? 'Nuovo Cliente' : client.full_name}
                        {!isNewClient && (
                            <span className={clsx(
                                "px-2 py-0.5 rounded text-xs border",
                                client.whatsapp_broadcast_opt_in
                                    ? "bg-green-500/10 border-green-500/20 text-green-500"
                                    : "bg-gray-500/10 border-gray-500/20 text-gray-400"
                            )}>
                                {client.whatsapp_broadcast_opt_in ? 'Broadcast Attivo' : 'No Broadcast'}
                            </span>
                        )}
                    </h1>
                    {!isNewClient && (
                        <div className="flex items-center gap-2 text-sm text-text-muted mt-1">
                            <span className="flex items-center gap-1"><Mail size={12} /> {client.email || 'N/D'}</span>
                            <span className="w-1 h-1 bg-gray-600 rounded-full" />
                            <span className="flex items-center gap-1"><Phone size={12} /> {client.phone || 'N/D'}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {/* Profile Header Card */}
                <div className="bg-bg-secondary rounded-2xl border border-border p-6 md:p-8 flex flex-col xl:flex-row gap-8 mb-8">
                    {/* Avatar / Initials */}
                    <div className="shrink-0 flex justify-center xl:justify-start">
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-accent to-purple-600 p-1 shadow-xl shadow-accent/20">
                            <div className="w-full h-full rounded-full bg-bg-tertiary flex items-center justify-center border-4 border-bg-primary overflow-hidden relative group cursor-pointer">
                                {client.full_name ? (
                                    <span className="text-2xl md:text-4xl font-bold text-white">
                                        {client.full_name.charAt(0).toUpperCase()}
                                    </span>
                                ) : (
                                    <span className="text-2xl md:text-4xl font-bold text-white">?</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info / Edit Form */}
                    <div className="flex-1 space-y-6">
                        {isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <input
                                        type="text"
                                        value={formData.full_name || ''}
                                        onChange={(e) => handleInputChange('full_name', e.target.value)}
                                        className="w-full text-xl md:text-2xl font-bold bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all placeholder:text-gray-600"
                                        placeholder="Nome e Cognome *"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-accent outline-none"
                                        placeholder="Email"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="tel"
                                        value={formData.phone || ''}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-accent outline-none"
                                        placeholder="Telefono"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="text"
                                        value={formData.fiscal_code || ''}
                                        onChange={(e) => handleInputChange('fiscal_code', e.target.value)}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-accent outline-none"
                                        placeholder="Codice Fiscale"
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <input
                                        type="text"
                                        value={formData.address || ''}
                                        onChange={(e) => handleInputChange('address', e.target.value)}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-accent outline-none"
                                        placeholder="Indirizzo"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.city || ''}
                                        onChange={(e) => handleInputChange('city', e.target.value)}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-accent outline-none"
                                        placeholder="Città"
                                    />
                                    <input
                                        type="text"
                                        value={formData.zip_code || ''}
                                        onChange={(e) => handleInputChange('zip_code', e.target.value)}
                                        className="w-24 bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-white focus:border-accent outline-none"
                                        placeholder="CAP"
                                    />
                                </div>

                                <div className="col-span-2 mt-2">
                                    <label className="block text-sm font-medium text-text-muted mb-2">Stili Preferiti</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['Realistico', 'Minimal', 'Geometrico', 'Old School', 'Colorato', 'Tutti'].map(style => {
                                            const selected = formData.preferred_styles?.includes(style);
                                            return (
                                                <button
                                                    key={style}
                                                    onClick={() => {
                                                        const current = formData.preferred_styles || [];
                                                        const updated = selected
                                                            ? current.filter(s => s !== style)
                                                            : [...current, style];
                                                        handleInputChange('preferred_styles', updated);
                                                    }}
                                                    className={clsx(
                                                        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                                                        selected
                                                            ? "bg-accent text-white border-accent"
                                                            : "bg-bg-tertiary text-text-muted border-border hover:border-text-secondary"
                                                    )}
                                                >
                                                    {style}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary select-none mt-4">
                                        <input
                                            type="checkbox"
                                            checked={formData.whatsapp_broadcast_opt_in || false}
                                            onChange={(e) => handleInputChange('whatsapp_broadcast_opt_in', e.target.checked)}
                                            className="rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
                                        />
                                        Iscritto alla lista Broadcast WhatsApp
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h2 className="text-3xl font-bold text-white break-words">{client.full_name}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-text-secondary text-base">
                                    <span className="flex items-center gap-2 break-all"><Mail size={18} className="shrink-0" /> {client.email || 'N/D'}</span>
                                    <span className="flex items-center gap-2"><Phone size={18} className="shrink-0" /> {client.phone || 'N/D'}</span>
                                    {(client.address || client.city) && (
                                        <span className="flex items-center gap-2 col-span-1 md:col-span-2 xl:col-span-1">
                                            <MapPin size={18} className="shrink-0" />
                                            <span className="break-words">
                                                {[client.address, client.city, client.zip_code].filter(Boolean).join(', ')}
                                            </span>
                                        </span>
                                    )}
                                    {client.fiscal_code && (
                                        <span className="flex items-center gap-2">
                                            <CreditCard size={18} className="shrink-0" /> <span className="break-all">{client.fiscal_code}</span>
                                        </span>
                                    )}
                                </div>
                                {client.preferred_styles && client.preferred_styles.length > 0 && (
                                    <div className="flex items-center gap-2 mt-4">
                                        <Tag size={18} className="text-accent shrink-0" />
                                        <div className="flex gap-2 flex-wrap">
                                            {client.preferred_styles.map((style, idx) => (
                                                <span key={idx} className="bg-accent/10 text-accent px-2.5 py-1 rounded-full text-sm border border-accent/20">
                                                    {style}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3 justify-end w-full md:w-auto h-fit">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleCancelClick}
                                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <X size={18} /> Annulla
                                </button>
                                <button
                                    onClick={handleSaveClick}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <Save size={18} /> Salva
                                </button>
                            </>
                        ) : (
                            <>
                                {!isNewClient && (
                                    <>
                                        <button
                                            onClick={handleDeleteClick}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-900/50 text-red-500 rounded-lg font-medium transition-colors flex items-center gap-2"
                                        >
                                            <Trash2 size={18} /> Elimina
                                        </button>
                                        <button
                                            onClick={handleEditClick}
                                            className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 border border-border rounded-lg text-white font-medium transition-colors"
                                        >
                                            Modifica Profilo
                                        </button>
                                        <button
                                            onClick={() => setIsAppointmentDrawerOpen(true)}
                                            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors shadow-lg shadow-accent/20"
                                        >
                                            Nuovo Appuntamento
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
                {/* Tabs */}
                <div className="border-b border-border">
                    <nav className="flex gap-6 overflow-x-auto">
                        {[
                            { id: 'request', label: 'Richiesta', icon: ClipboardList, visible: !!waitlistEntry },
                            { id: 'gallery', label: 'Galleria', icon: Image, visible: true },
                            { id: 'history', label: 'Storico', icon: Calendar, visible: true },
                            { id: 'consents', label: 'Consensi', icon: FileText, visible: true },
                            { id: 'medical', label: 'Info Mediche', icon: Activity, visible: true },
                        ].filter(t => t.visible).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "pb-4 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "text-accent border-accent"
                                        : "text-text-muted border-transparent hover:text-white hover:border-gray-700"
                                )}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="min-h-[300px] mt-6">
                    {activeTab === 'request' && waitlistEntry && (
                        <div className="space-y-6">
                            <div className="bg-bg-secondary rounded-lg border border-border p-6">
                                <h3 className="text-lg font-bold text-white mb-4">Dettagli Richiesta</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-text-muted">Descrizione Idea</label>
                                        <p className="text-white mt-1 whitespace-pre-wrap">{waitlistEntry.description || 'Nessuna descrizione.'}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-text-muted">Stili Indicati</label>
                                        <div className="flex gap-2 mt-1 flex-wrap">
                                            {waitlistEntry.styles && waitlistEntry.styles.length > 0 ? (
                                                waitlistEntry.styles.map((s, i) => (
                                                    <span key={i} className="px-2 py-1 rounded bg-bg-tertiary text-sm text-text-secondary border border-border">
                                                        {s}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-text-secondary italic">Nessuno stile specificato</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm text-text-muted">Immagini di Riferimento</label>
                                        {waitlistEntry.images && waitlistEntry.images.length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                                {waitlistEntry.images.map((url, i) => (
                                                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border bg-bg-tertiary" onClick={() => {
                                                        const win = window.open();
                                                        if (win) {
                                                            win.document.write('<img src="' + url + '" style="max-width:100%;" />');
                                                        }
                                                    }}>
                                                        <img src={url} alt={`Riferimento ${i}`} className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-text-secondary italic mt-1">Nessuna immagine allegata.</p>
                                        )}
                                    </div>
                                    <div className="pt-4 border-t border-border mt-4">
                                        <p className="text-xs text-text-muted">Richiesta inviata il: {new Date(waitlistEntry.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-bg-secondary p-4 rounded-lg border border-border">
                                <div>
                                    <h4 className="text-text-muted text-sm uppercase font-bold">Totale Speso</h4>
                                    <p className="text-2xl font-bold text-green-500">€ {totalSpent.toFixed(2)}</p>
                                </div>
                                {selectedAppointments.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <Trash2 size={16} /> Elimina ({selectedAppointments.length})
                                    </button>
                                )}
                            </div>

                            {appointments.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-2 mb-2 px-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedAppointments.length === appointments.length && appointments.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded border-border bg-bg-tertiary text-accent focus:ring-accent w-4 h-4"
                                        />
                                        <span className="text-sm text-text-muted">Seleziona tutti</span>
                                    </div>
                                    {appointments.map((apt) => (
                                        <div key={apt.id} className={clsx(
                                            "bg-bg-secondary rounded-lg border p-4 flex justify-between items-center transition-colors",
                                            selectedAppointments.includes(apt.id) ? "border-accent bg-accent/5" : "border-border"
                                        )}>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAppointments.includes(apt.id)}
                                                    onChange={() => toggleSelection(apt.id)}
                                                    className="rounded border-border bg-bg-tertiary text-accent focus:ring-accent w-5 h-5"
                                                />
                                                <div>
                                                    <h4 className="font-bold text-white">{apt.service_name}</h4>
                                                    <p className="text-sm text-text-muted">
                                                        {new Date(apt.start_time).toLocaleDateString()} - {new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className={clsx(
                                                        "px-2 py-1 rounded text-xs font-medium",
                                                        apt.status === 'COMPLETED' ? "bg-green-500/10 text-green-500" :
                                                            apt.status === 'CONFIRMED' ? "bg-blue-500/10 text-blue-500" :
                                                                "bg-gray-500/10 text-gray-400"
                                                    )}>
                                                        {apt.status}
                                                    </span>
                                                    {apt.price && <p className="text-sm font-bold text-white mt-1">€ {apt.price}</p>}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteAppointment(apt.id)}
                                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Elimina appuntamento"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div className="bg-bg-secondary rounded-lg border border-border p-8 text-center text-text-muted">
                                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>Nessun appuntamento passato.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {
                        activeTab === 'gallery' && (
                            <div className="space-y-6">
                                {/* Upload Area */}
                                <DragDropUpload onUpload={handleUpload} />

                                {/* Gallery Grid */}
                                {client.images && client.images.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {client.images.map((img) => (
                                            <div key={img.id} className="group relative aspect-square bg-bg-secondary rounded-lg overflow-hidden border border-border">
                                                <img
                                                    src={img.url}
                                                    alt={img.description || 'Cliente Image'}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => window.open(img.url, '_blank')}
                                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                                        title="Visualizza"
                                                    >
                                                        <Eye size={20} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteImage(img.id)}
                                                        className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full transition-colors"
                                                        title="Elimina"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-bg-secondary rounded-lg border border-border p-8 text-center text-text-muted">
                                        <Image size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>Nessuna immagine caricata.</p>
                                    </div>
                                )}
                            </div>
                        )
                    }
                    {
                        activeTab === 'consents' && (
                            <div className="space-y-4">
                                {consents.length > 0 ? (
                                    consents.map((c) => (
                                        <div key={c.id} className="bg-bg-secondary rounded-lg border border-border p-4 flex justify-between items-center group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-accent/10 rounded-lg text-accent">
                                                    <FileText size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white">Consenso Firmato v{c.template_version || '1'}</h4>
                                                    <p className="text-sm text-text-muted">Firmato il {new Date(c.signed_at).toLocaleDateString()} alle {new Date(c.signed_at).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleDownloadPDF(c)}
                                                    disabled={downloadingConsent === c.id}
                                                    className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                                >
                                                    {downloadingConsent === c.id ? (
                                                        <span className="animate-pulse">Generazione PDF...</span>
                                                    ) : (
                                                        <>
                                                            <FileText size={16} />
                                                            Visualizza Consenso
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-bg-secondary rounded-lg border border-border p-8 text-center text-text-muted">
                                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                        <p>Nessun consenso firmato.</p>
                                    </div>
                                )}
                            </div>
                        )
                    }
                    {
                        activeTab === 'medical' && (
                            <div className="bg-bg-secondary rounded-lg border border-border p-8 text-center text-text-muted">
                                <Activity size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Nessuna nota medica registrata.</p>
                            </div>
                        )
                    }
                </div >

                {isAppointmentDrawerOpen && (
                    <AppointmentDrawer
                        isOpen={isAppointmentDrawerOpen}
                        onClose={() => setIsAppointmentDrawerOpen(false)}
                        selectedDate={new Date()}
                        selectedAppointment={null}
                        onSave={handleSaveAppointment}
                        initialClientId={client.id}
                        initialData={activeTab === 'request' && waitlistEntry ? {
                            notes: waitlistEntry.description
                                ? `[Da Richiesta Lista d'Attesa]\nDescrizione: ${waitlistEntry.description}\n${waitlistEntry.notes ? `Note Interne: ${waitlistEntry.notes}` : ''}`
                                : waitlistEntry.notes,
                            service_name: waitlistEntry.styles.join(', '),
                            images: waitlistEntry.images || []
                        } : undefined}
                    />
                )}
            </div>
        </div>
    );
};
