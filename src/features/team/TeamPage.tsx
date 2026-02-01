import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import { Users, Copy, Check, Mail, Shield, Trash2, Eye, EyeOff, DollarSign } from 'lucide-react';

export const TeamPage: React.FC = () => {
    const { user } = useAuth();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'manager' | 'artist' | 'student'>('artist');
    const [loading, setLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only Owner access
    if (user?.role !== 'owner') {
        return <div className="p-8 text-center text-red-500">Access Restricted</div>;
    }

    const handleGenerateInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.studio_id) return;

        setLoading(true);
        setError(null);
        setInviteLink(null);

        try {
            // Generate random token (simple implementation)
            const token = crypto.randomUUID();

            await api.settings.createInvitation(
                user.studio_id,
                email,
                role as any, // Cast to any to bypass legacy UserRole type check
                token,
                user.id
            );

            // Construct link
            const link = `${window.location.origin}/accept-invite?token=${token}`;
            setInviteLink(link);

        } catch (err: any) {
            console.error('Failed to create invitation:', err);
            setError(err.message || 'Errore durante la creazione dell\'invito');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="p-4 md:p-8 pt-20 md:pt-8 text-text-primary max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Users className="text-accent" /> Gestione Team
            </h1>
            <p className="text-text-muted mb-8">
                Invita nuovi membri nel tuo studio generando un link di invito.
            </p>

            <div className="bg-bg-secondary p-8 rounded-xl border border-border">
                <form onSubmit={handleGenerateInvite} className="space-y-6">
                    {/* Role Selection */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                            <Shield size={16} /> Ruolo
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { value: 'manager', label: 'Manager', desc: 'Gestione completa' },
                                { value: 'artist', label: 'Artista', desc: 'Agenda e Clienti' },
                                { value: 'student', label: 'Studente', desc: 'Accesso Academy' }
                            ].map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => setRole(option.value as 'manager' | 'artist' | 'student')}
                                    className={`
                                        cursor-pointer p-4 rounded-lg border transition-all
                                        ${role === option.value
                                            ? 'bg-accent/10 border-accent text-accent'
                                            : 'bg-bg-tertiary border-transparent text-text-muted hover:bg-bg-primary'}
                                    `}
                                >
                                    <div className="font-bold">{option.label}</div>
                                    <div className="text-xs opacity-70">{option.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Email Input */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                            <Mail size={16} /> Email del Membro
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:ring-accent focus:border-accent"
                            placeholder="collega@esempio.com"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                        {loading ? 'Generazione in corso...' : 'Genera Invito'}
                    </button>
                </form>

                {/* Result */}
                {inviteLink && (
                    <div className="mt-8 p-4 bg-green-500/10 border border-green-500/20 rounded-lg animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-green-400 text-sm font-medium mb-2 flex items-center gap-2">
                            <Check size={16} /> Invito Creato con Successo!
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={inviteLink}
                                className="flex-1 bg-black/20 border border-green-500/30 rounded px-3 py-2 text-sm text-green-100 font-mono"
                            />
                            <button
                                onClick={copyToClipboard}
                                className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors"
                                title="Copia Link"
                            >
                                {copied ? <Check size={20} /> : <Copy size={20} />}
                            </button>
                            <a
                                href={`mailto:${email}?subject=Invito Studio Tattoo&body=Ecco il link per unirti al team: ${inviteLink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                                title="Invia per Email"
                            >
                                <Mail size={20} />
                            </a>
                        </div>
                        <p className="text-xs text-green-500/60 mt-2">
                            Condividi questo link con l'utente. Scadrà tra 48 ore.
                        </p>
                    </div>
                )}
            </div>

            {/* Pending Invitations */}
            <PendingInvitationsList studioId={user?.studio_id} />

            {/* Active Members List */}
            <div className="mt-8 bg-bg-secondary p-8 rounded-xl border border-border">
                <h2 className="text-xl font-bold mb-6">Membri del Team</h2>
                <TeamList studioId={user?.studio_id} />
            </div>
        </div>
    );
};

const TeamList: React.FC<{ studioId?: string }> = ({ studioId }) => {
    const [members, setMembers] = useState<import('../../services/types').User[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        if (!studioId) return;
        const load = async () => {
            try {
                const data = await api.settings.listTeamMembers(studioId);
                setMembers(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [studioId]);

    if (loading) return <div className="text-text-muted">Caricamento membri...</div>;
    if (members.length === 0) return <div className="text-text-muted">Nessun membro collegato.</div>;

    const roleColors: Record<string, string> = {
        owner: 'text-purple-400',
        manager: 'text-blue-400',
        artist: 'text-accent',
        student: 'text-green-400'
    };

    const handlePermissionUpdate = async (userId: string, key: 'can_view_clients' | 'can_view_others_financials', currentValue: boolean) => {
        if (!studioId) return;
        try {
            await api.settings.updateMemberPermissions(studioId, userId, { [key]: !currentValue });
            setMembers(prev => prev.map(m =>
                m.id === userId
                    ? { ...m, permissions: { ...m.permissions!, [key]: !currentValue } }
                    : m
            ));
        } catch (err) {
            console.error('Failed to update permissions:', err);
            alert('Errore durante l\'aggiornamento dei permessi.');
        }
    };

    const handleDelete = async (userId: string, userName: string) => {
        if (!window.confirm(`Sei sicuro di voler rimuovere ${userName} dal team? \nQuesta azione rimuoverà il loro accesso allo studio e CANCELLERÀ il loro account.`)) {
            return;
        }

        if (!studioId) return;

        try {
            await api.settings.removeMember(userId, studioId);
            setMembers(prev => prev.filter(m => m.id !== userId));
        } catch (err) {
            console.error('Failed to remove member:', err);
            alert('Errore durante la rimozione del membro.');
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4">
            {members.map(member => (
                <div key={member.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-bg-tertiary rounded-lg border border-border group gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-bg-primary flex items-center justify-center font-bold text-lg text-text-primary">
                            {member.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-bold text-text-primary">{member.full_name}</div>
                            <div className="text-sm text-text-muted">
                                {member.email}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap justify-end">
                        {/* Permission Toggles (Only for Artists) */}
                        {member.role === 'artist' && (
                            <div className="flex items-center gap-2 mr-4 bg-bg-primary/50 p-1.5 rounded-lg border border-white/5">
                                <button
                                    onClick={() => handlePermissionUpdate(member.id, 'can_view_clients', member.permissions?.can_view_clients ?? true)}
                                    className={`p-2 rounded-md transition-all flex items-center gap-2 text-xs font-medium ${(member.permissions?.can_view_clients ?? true)
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-white/5 text-text-muted hover:text-text-primary'
                                        }`}
                                    title={(member.permissions?.can_view_clients ?? true) ? "Può vedere la lista Clienti" : "NON può vedere la lista Clienti"}
                                >
                                    <Users size={14} />
                                    <span className="hidden sm:inline">Clienti</span>
                                    {(member.permissions?.can_view_clients ?? true) ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>

                                <button
                                    onClick={() => handlePermissionUpdate(member.id, 'can_view_others_financials', member.permissions?.can_view_others_financials ?? false)}
                                    className={`p-2 rounded-md transition-all flex items-center gap-2 text-xs font-medium ${member.permissions?.can_view_others_financials
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : 'bg-white/5 text-text-muted hover:text-text-primary'
                                        }`}
                                    title={member.permissions?.can_view_others_financials ? "Può vedere finanze altrui" : "NON può vedere finanze altrui"}
                                >
                                    <DollarSign size={14} />
                                    <span className="hidden sm:inline">Finanze Altri</span>
                                    {member.permissions?.can_view_others_financials ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                            </div>
                        )}

                        <span className={`text-xs uppercase px-2 py-1 rounded-md font-medium bg-white/5 ${roleColors[member.role?.toLowerCase()] || 'text-gray-400'}`}>
                            {member.role}
                        </span>

                        {/* Cannot delete self or Owner if I am just a manager (Logic handled by parent usually, but here assumes Owner view) */}
                        {member.role !== 'owner' && (
                            <button
                                onClick={() => handleDelete(member.id, member.full_name)}
                                className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                title="Rimuovi dal Team"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

const PendingInvitationsList: React.FC<{ studioId?: string }> = ({ studioId }) => {
    const [invitations, setInvitations] = useState<import('../../services/types').StudioInvitation[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        if (!studioId) return;
        const load = async () => {
            try {
                const data = await api.settings.listStudioInvitations(studioId);
                setInvitations(data as any);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [studioId]);

    const copyLink = (token: string) => {
        const link = `${window.location.origin}/accept-invite?token=${token}`;
        navigator.clipboard.writeText(link);
        alert('Link copiato!');
    };

    if (loading) return null;
    if (invitations.length === 0) return null;

    return (
        <div className="mb-8 bg-bg-secondary p-8 rounded-xl border border-dashed border-accent/30">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-accent">
                <Mail size={20} /> Inviti in Attesa
            </h2>
            <div className="space-y-3">
                {invitations.map((invite) => (
                    <div key={invite.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-bg-tertiary rounded-lg border border-border gap-4">
                        <div>
                            <div className="font-bold text-text-primary">{invite.email}</div>
                            <div className="text-sm text-text-muted flex gap-2">
                                <span>Ruolo: {invite.role}</span>
                                <span>•</span>
                                <span>Inviato il: {new Date(invite.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => copyLink(invite.token)}
                            className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Copy size={14} /> Copia Link
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
