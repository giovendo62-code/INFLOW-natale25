import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';
import type { User, ArtistContract, PresenceLog, RentType, ArtistDocument, AttendanceRecord } from '../../services/types';
import { Save, RefreshCw, Plus, Clock, AlertTriangle, ArrowLeft, Upload, FileText, Trash2, MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import { useLayoutStore } from '../../stores/layoutStore';
import { Modal } from '../../components/Modal';

type Tab = 'DETAILS' | 'CONTRACT' | 'PRESENCES' | 'Documents' | 'CHECKINS';

export const ArtistProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { isPrivacyMode } = useLayoutStore();

    const [artist, setArtist] = useState<User | null>(null);
    const [contract, setContract] = useState<ArtistContract | null>(null);
    const [logs, setLogs] = useState<PresenceLog[]>([]);
    const [checkins, setCheckins] = useState<AttendanceRecord[]>([]);
    const [activeTab, setActiveTab] = useState<Tab>('DETAILS');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [docs, setDocs] = useState<ArtistDocument[]>([]);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state (Contract)
    const [formData, setFormData] = useState<Partial<ArtistContract>>({
        commission_rate: 0,
        rent_type: 'FIXED',
        rent_fixed_amount: 0,
        rent_percent_rate: 0,
        presence_package_limit: 0,
        presence_price: 0,
        vat_number: '',
        fiscal_code: '',
        address: '',
        iban: ''
    });

    // Profile Form State
    const [profileForm, setProfileForm] = useState<{ phone: string; full_name: string; calendar_color: string }>({
        phone: '',
        full_name: '',
        calendar_color: '#eab308'
    });

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            // In a real app we might need a specific getById for users/artists, 
            // but for now we can rely on settings.listTeamMembers or assume we have a way.
            // Using listTeamMembers to find the artist is a workaround.
            const members = await api.settings.listTeamMembers(user?.studio_id || 'studio-1');
            const found = members.find(m => m.id === id);
            if (!found) throw new Error('Artist not found');
            setArtist(found);
            setProfileForm({
                phone: found.phone || '',
                full_name: found.full_name || '',
                calendar_color: found.calendar_color || '#eab308'
            });

            const c = await api.artists.getContract(id);
            setContract(c);
            if (c) {
                setFormData(c);
                if (c.rent_type === 'PRESENCES') {
                    const l = await api.artists.getPresenceLogs(id);
                    setLogs(l);
                }
                if (c.documents) {
                    setDocs(c.documents);
                }
            }

            // Load Checkins
            try {
                const history = await api.academy.getAttendanceHistory(id);
                setCheckins(history);
            } catch (e) {
                console.error('Failed to load checkins', e);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to load artist data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!id || !artist) return;
        setSaving(true);
        try {
            console.log('UpdateProfile payload:', {
                phone: profileForm.phone,
                full_name: profileForm.full_name,
                calendar_color: profileForm.calendar_color
            });
            const updated = await api.settings.updateProfile(id, {
                phone: profileForm.phone,
                full_name: profileForm.full_name,
                calendar_color: profileForm.calendar_color
            });
            console.log('UpdateProfile response:', updated);
            setArtist(updated);
            setSuccess('Profilo aggiornato con successo! La pagina verrà ricaricata.');
            setTimeout(() => window.location.reload(), 2000);
        } catch (err: any) {
            console.error(err);
            alert('Errore aggiornamento profilo: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveContract = async () => {
        if (!id) return;
        setError(null);
        setSaving(true);
        try {
            // Validation
            if (formData.commission_rate === undefined || formData.commission_rate < 0 || formData.commission_rate > 100) {
                throw new Error('Commission rate must be between 0 and 100');
            }
            if (!formData.rent_type) throw new Error('Rent type is required');

            if (formData.rent_type === 'FIXED' && !formData.rent_fixed_amount) throw new Error('Fixed rent amount is required');
            if (formData.rent_type === 'PERCENTAGE' && !formData.rent_percent_rate) throw new Error('Rent percentage is required');
            if (formData.rent_type === 'PRESENCES') {
                if (!formData.presence_package_limit) throw new Error('Package limit is required');
                if (!formData.presence_price) throw new Error('Presence price is required');
            }

            const updated = await api.artists.updateContract(id, formData);
            setContract(updated);
            setSuccess('Contratto salvato con successo!');

            // Refund logs if switched to presences
            if (updated.rent_type === 'PRESENCES') {
                const l = await api.artists.getPresenceLogs(id);
                setLogs(l);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddPresence = async () => {
        if (!id || !user?.studio_id || !user?.id) return;
        try {
            await api.artists.addPresence(id, user.studio_id, user.id);
            // Reload
            const c = await api.artists.getContract(id);
            setContract(c);
            const l = await api.artists.getPresenceLogs(id);
            setLogs(l);
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleResetPresences = async () => {
        if (!id || !user?.studio_id || !user?.id) return;
        if (!confirm('Are you sure you want to reset and renew the presence cycle?')) return;
        try {
            await api.artists.resetPresences(id, user.studio_id, user.id, 'Manual Reset');
            const c = await api.artists.getContract(id);
            setContract(c);
            const l = await api.artists.getPresenceLogs(id);
            setLogs(l);
        } catch (err: any) {
            alert(err.message);
        }
    };

    if (loading) return <div className="p-8 text-center text-text-muted">Caricamento...</div>;
    if (!artist) return <div className="p-8 text-center text-red-500">Artista non trovato</div>;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 overflow-x-hidden">
            <button onClick={() => navigate('/artists')} className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-4">
                <ArrowLeft size={20} /> Torna alla Lista
            </button>

            <div className="flex items-center gap-6 mb-8">
                <div
                    className="w-20 h-20 rounded-full bg-bg-tertiary flex items-center justify-center overflow-hidden border-2 border-accent relative group cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    {artist.avatar_url ? (
                        <img src={artist.avatar_url} alt={artist.full_name || 'Artist'} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-2xl font-bold text-text-muted">
                            {(artist.full_name && artist.full_name[0]) || (artist.email && artist.email[0]?.toUpperCase()) || '?'}
                        </span>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Upload className="text-white" size={24} />
                    </div>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                        if (e.target.files?.[0] && artist) {
                            try {
                                const file = e.target.files[0];
                                const path = `avatars/${artist.id}/${Date.now()}_${file.name}`;

                                // Upload to storage
                                const publicUrl = await api.storage.upload('avatars', path, file);

                                // Update profile
                                await api.settings.updateProfile(artist.id, { avatar_url: publicUrl });

                                // Update UI
                                setArtist(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
                                alert('Foto profilo aggiornata con successo!');
                            } catch (err: any) {
                                console.error('Upload failed:', err);
                                alert('Errore caricamento foto: ' + err.message);
                            }
                        }
                    }}
                />
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">{artist.full_name}</h1>
                    <div className="flex items-center gap-3">
                        <p className="text-text-muted">{artist.email}</p>
                        {artist.phone && (
                            <button
                                onClick={() => window.open(`https://wa.me/${artist.phone?.replace(/\s+/g, '') || ''}`, '_blank')}
                                className="flex items-center gap-1 text-xs font-medium text-green-500 hover:text-green-400 transition-colors bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20"
                            >
                                <MessageCircle size={12} />
                                WhatsApp
                            </button>
                        )}
                    </div>
                </div>
                <div className="ml-auto">
                    <button
                        onClick={async () => {
                            if (confirm('Sei sicuro di voler eliminare questo artista? Questa azione è irreversibile.')) {
                                try {
                                    await api.settings.removeMember(artist.id, user?.studio_id || 'default');
                                    navigate('/artists');
                                } catch (err) {
                                    alert('Errore durante l\'eliminazione');
                                    console.error(err);
                                }
                            }
                        }}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg font-medium transition-colors border border-red-500/20"
                    >
                        <Trash2 size={20} />
                        <span className="hidden md:inline">Elimina Artista</span>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
                {(['DETAILS', 'CONTRACT', 'PRESENCES', 'DOCUMENTS'] as Tab[]).map((tab) => {
                    if (tab === 'PRESENCES' && contract?.rent_type !== 'PRESENCES') return null;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                'px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap',
                                activeTab === tab ? 'text-accent' : 'text-text-muted hover:text-text-primary'
                            )}
                        >
                            {tab === 'DETAILS' && 'DETTAGLI'}
                            {tab === 'CONTRACT' && 'CONTRATTO'}
                            {tab === 'PRESENCES' && 'PRESENZE'}
                            {tab === 'Documents' && 'DOCUMENTI'}
                            {tab === 'CHECKINS' && 'INGRESSI'}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                            )}
                        </button>
                    );
                })}
                <button
                    onClick={() => setActiveTab('CHECKINS')}
                    className={clsx(
                        'px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap',
                        activeTab === 'CHECKINS' ? 'text-accent' : 'text-text-muted hover:text-text-primary'
                    )}
                >
                    INGRESSI
                    {activeTab === 'CHECKINS' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                    )}
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="bg-bg-secondary p-6 rounded-xl border border-border">
                {activeTab === 'DETAILS' && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-text-primary mb-4">Informazioni Personali</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    value={profileForm.full_name}
                                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                    placeholder="Nome e Cognome"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Email</label>
                                <div className="p-3 bg-bg-tertiary rounded-lg text-text-primary">{artist.email}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Telefono</label>
                                <div className="flex gap-2">
                                    <input
                                        type="tel"
                                        value={profileForm.phone}
                                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                        placeholder="+39 ..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Ruolo</label>
                                <div className="p-3 bg-bg-tertiary rounded-lg text-text-primary capitalize">{(artist.role || '').toLowerCase()}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-muted mb-1">Colore Calendario</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={profileForm.calendar_color}
                                        onChange={(e) => setProfileForm({ ...profileForm, calendar_color: e.target.value })}
                                        className="h-10 w-20 rounded cursor-pointer bg-transparent border-0 p-0"
                                    />
                                    <span className="text-text-muted text-sm">{profileForm.calendar_color}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleSaveProfile}
                                disabled={saving}
                                className="flex items-center gap-2 bg-bg-tertiary hover:bg-bg-primary text-text-primary px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-border"
                            >
                                <Save size={16} />
                                {saving ? 'Salvataggio...' : 'Salva Profilo'}
                            </button>
                        </div>

                        {/* Extended Details Form */}
                        <div className="pt-6 border-t border-border mt-6">
                            <h3 className="text-lg font-bold text-text-primary mb-4">Dati Fiscali e Residenza</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-muted mb-1">Codice Fiscale</label>
                                    <input
                                        type="text"
                                        value={formData.fiscal_code || ''}
                                        onChange={(e) => setFormData({ ...formData, fiscal_code: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary"
                                        placeholder="Codice Fiscale"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-muted mb-1">Partita IVA</label>
                                    <input
                                        type="text"
                                        value={formData.vat_number || ''}
                                        onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary"
                                        placeholder="P.IVA (Opzionale)"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-text-muted mb-1">Indirizzo di Residenza</label>
                                    <input
                                        type="text"
                                        value={formData.address || ''}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary"
                                        placeholder="Via, Città, CAP"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-text-muted mb-1">IBAN</label>
                                    <input
                                        type="text"
                                        value={formData.iban || ''}
                                        onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                                        className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary"
                                        placeholder="IBAN per pagamenti"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4 mt-4">
                                <button
                                    onClick={handleSaveContract}
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                                >
                                    <Save size={20} />
                                    {saving ? 'Salvataggio...' : 'Salva Dati'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'CONTRACT' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                                <span className="w-1 h-6 bg-accent rounded-full" /> Commissione
                            </h3>
                            <div className="max-w-md">
                                <label className="block text-sm font-medium text-text-muted mb-1">Percentuale Commissione (%) *</label>
                                <input
                                    type={isPrivacyMode ? "password" : "number"}
                                    min="0"
                                    max="100"
                                    value={formData.commission_rate}
                                    onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                                <span className="w-1 h-6 bg-accent rounded-full" /> Configurazione Affitto
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                {(['FIXED', 'PERCENTAGE', 'PRESENCES'] as RentType[]).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setFormData({ ...formData, rent_type: type })}
                                        className={clsx(
                                            'p-4 rounded-lg border text-left transition-all',
                                            formData.rent_type === type
                                                ? 'bg-accent/10 border-accent text-accent'
                                                : 'bg-bg-tertiary border-border text-text-muted hover:border-text-secondary'
                                        )}
                                    >
                                        <div className="font-semibold mb-1">{type === 'FIXED' ? 'FISSO' : type === 'PERCENTAGE' ? 'PERCENTUALE' : 'A PRESENZA'}</div>
                                        <div className="text-xs opacity-70">
                                            {type === 'FIXED' && 'Importo fisso mensile'}
                                            {type === 'PERCENTAGE' && 'Percentuale sul fatturato'}
                                            {type === 'PRESENCES' && 'Pacchetti di presenze'}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-bg-tertiary/50 rounded-xl border border-dashed border-border">
                                {formData.rent_type === 'FIXED' && (
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Importo Fisso (€) *</label>
                                        <input
                                            type={isPrivacyMode ? "password" : "number"}
                                            value={formData.rent_fixed_amount || ''}
                                            onChange={(e) => setFormData({ ...formData, rent_fixed_amount: Number(e.target.value) })}
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary"
                                        />
                                    </div>
                                )}

                                {formData.rent_type === 'PERCENTAGE' && (
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Percentuale Affitto (%) *</label>
                                        <input
                                            type={isPrivacyMode ? "password" : "number"}
                                            value={formData.rent_percent_rate || ''}
                                            onChange={(e) => setFormData({ ...formData, rent_percent_rate: Number(e.target.value) })}
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary"
                                        />
                                    </div>
                                )}

                                {formData.rent_type === 'PRESENCES' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-text-muted mb-1">Limite Pacchetto (Giorni) *</label>
                                            <input
                                                type="number"
                                                value={formData.presence_package_limit || ''}
                                                onChange={(e) => setFormData({ ...formData, presence_package_limit: Number(e.target.value) })}
                                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-text-muted mb-1">Prezzo per Presenza (€) *</label>
                                            <input
                                                type={isPrivacyMode ? "password" : "number"}
                                                value={formData.presence_price || ''}
                                                onChange={(e) => setFormData({ ...formData, presence_price: Number(e.target.value) })}
                                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-text-primary"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSaveContract}
                                disabled={saving}
                                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                            >
                                <Save size={20} />
                                {saving ? 'Salvataggio...' : 'Salva Contratto'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'PRESENCES' && contract && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-bg-tertiary p-6 rounded-xl border border-border">
                                <p className="text-text-muted text-sm mb-1">Presenze Usate</p>
                                <p className="text-4xl font-bold text-text-primary">{contract.used_presences}</p>
                            </div>
                            <div className="bg-bg-tertiary p-6 rounded-xl border border-border">
                                <p className="text-text-muted text-sm mb-1">Limite Totale</p>
                                <p className="text-4xl font-bold text-text-secondary">{contract.presence_package_limit}</p>
                            </div>
                            <div className="bg-bg-tertiary p-6 rounded-xl border border-border">
                                <p className="text-text-muted text-sm mb-1">Rimanenti</p>
                                <p className={clsx(
                                    "text-4xl font-bold",
                                    (contract.presence_package_limit! - contract.used_presences) <= 2 ? 'text-red-500' : 'text-green-500'
                                )}>
                                    {contract.presence_package_limit! - contract.used_presences}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleAddPresence}
                                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-bold transition-colors"
                            >
                                <Plus size={24} /> Aggiungi Presenza
                            </button>
                            <button
                                onClick={handleResetPresences}
                                className="flex-1 flex items-center justify-center gap-2 bg-bg-tertiary hover:bg-white/10 text-text-primary p-4 rounded-xl font-bold transition-colors border border-border"
                            >
                                <RefreshCw size={24} /> Rinnova Ciclo
                            </button>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-accent" /> Storico Attività
                            </h3>
                            <div className="space-y-4">
                                {logs.map(log => (
                                    <div key={log.id} className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className={clsx(
                                                "w-2 h-2 rounded-full",
                                                log.action === 'ADD' ? 'bg-green-500' : 'bg-blue-500'
                                            )} />
                                            <div>
                                                <p className="font-medium text-text-primary">
                                                    {log.action === 'ADD' ? 'Presenza Aggiunta' : 'Ciclo Rinnovato'}
                                                </p>
                                                <p className="text-xs text-text-muted">{log.note || 'Nessuna nota'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-text-secondary">
                                                {new Date(log.created_at).toLocaleDateString()}
                                            </p>
                                            <p className="text-xs text-text-muted">
                                                {new Date(log.created_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {logs.length === 0 && (
                                    <p className="text-text-muted text-center py-4">Nessuno storico presente.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Documents' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-text-primary">Documenti & Certificati</h3>
                            <button className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                <Upload size={16} /> Carica Documento
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {docs.map(doc => (
                                <div key={doc.id} className="bg-bg-tertiary p-4 rounded-xl border border-border group hover:border-accent/50 transition-colors relative">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-3 bg-white/5 rounded-lg text-accent">
                                            <FileText size={24} />
                                        </div>
                                        <button className="text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 relative z-10">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <h4 className="text-text-primary font-medium truncate mb-1">{doc.name}</h4>
                                    <p className="text-xs text-text-muted mb-4">
                                        Caricato il {new Date(doc.uploaded_at).toLocaleDateString()}
                                    </p>

                                    <a
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full text-center py-2 bg-bg-primary hover:bg-bg-tertiary text-text-primary rounded-lg text-sm font-medium transition-colors cursor-pointer"
                                    >
                                        Visualizza / Scarica
                                    </a>
                                </div>
                            ))}

                            {/* Fake Document for Demo */}
                            <div className="bg-bg-tertiary p-4 rounded-xl border border-border group hover:border-accent/50 transition-colors relative">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="p-3 bg-white/5 rounded-lg text-accent">
                                        <FileText size={24} />
                                    </div>
                                    <button className="text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 relative z-10">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <h4 className="text-text-primary font-medium truncate mb-1">Attestato Igiene.pdf</h4>
                                <p className="text-xs text-text-muted mb-4">
                                    Caricato il 12/10/2024
                                </p>

                                <button
                                    onClick={() => window.open('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '_blank')}
                                    className="block w-full text-center py-2 bg-bg-primary hover:bg-bg-tertiary text-text-primary rounded-lg text-sm font-medium transition-colors cursor-pointer"
                                >
                                    Visualizza / Scarica
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'CHECKINS' && (
                    <div>
                        <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
                            <Clock size={20} className="text-accent" /> Storico Ingressi Check-in
                        </h3>

                        {checkins.length === 0 ? (
                            <div className="text-center py-8 text-text-muted italic bg-bg-tertiary/20 rounded-lg">
                                Nessun ingresso registrato.
                            </div>
                        ) : (
                            checkins.map((record) => (
                                <div key={record.id} className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg border border-border group hover:border-red-500/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
                                            <RefreshCw size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-text-primary">Ingresso Registrato</p>
                                            <p className="text-xs text-text-muted">Metodo: {record.method}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-text-primary">
                                                {new Date(record.check_in_time).toLocaleDateString()}
                                            </p>
                                            <p className="text-xs text-text-muted">
                                                {new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        {/* Delete Button for Owner/Manager */}
                                        {(user?.role === 'owner' || user?.role === 'manager') && (
                                            <button
                                                onClick={async () => {
                                                    if (confirm('Sei sicuro di voler eliminare questa presenza? L\'artista potrà effettuare nuovamente il check-in per questa data.')) {
                                                        try {
                                                            await api.attendance.delete(record.id);
                                                            // Reload checkins
                                                            const history = await api.academy.getAttendanceHistory(id!);
                                                            setCheckins(history);
                                                            alert('Presenza eliminata.');
                                                        } catch (err: any) {
                                                            console.error(err);
                                                            alert('Errore eliminazione: ' + err.message);
                                                        }
                                                    }
                                                }}
                                                className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Elimina Presenza"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}


            </div>

            <Modal
                isOpen={!!success}
                onClose={() => setSuccess(null)}
                title="Successo"
            >
                <div className="flex flex-col gap-4">
                    <p className="text-text-secondary text-lg text-center">
                        {success}
                    </p>
                    <div className="flex justify-center">
                        <button
                            onClick={() => setSuccess(null)}
                            className="bg-accent hover:bg-accent-hover text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Chiudi
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};
