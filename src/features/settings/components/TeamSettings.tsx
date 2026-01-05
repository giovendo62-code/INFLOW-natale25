import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Mail } from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../auth/AuthContext';
import type { User } from '../../../services/types';
// import clsx from 'clsx';

export const TeamSettings: React.FC = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');

    useEffect(() => {
        loadTeam();
    }, [user?.studio_id]);

    const loadTeam = async () => {
        if (!user?.studio_id) return;
        setLoading(true);
        try {
            const data = await api.settings.listTeamMembers(user.studio_id);
            setMembers(data);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail || !user?.studio_id) return;
        try {
            const newUser = await api.settings.inviteMember(inviteEmail, 'ARTIST', user.studio_id);
            setMembers([...members, newUser]);
            setInviteEmail('');
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-end gap-4 p-6 bg-bg-secondary rounded-lg border border-border">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-text-secondary mb-2">Invite New Member</label>
                    <div className="relative">
                        <input
                            type="email"
                            placeholder="colleague@inkflow.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                        />
                        <Mail className="absolute left-3 top-2.5 text-text-muted" size={18} />
                    </div>
                </div>
                <div className="w-48">
                    <label className="block text-sm font-medium text-text-secondary mb-2">Role</label>
                    <select className="w-full bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none appearance-none">
                        <option value="ARTIST">Artist</option>
                        <option value="MANAGER">Manager</option>
                        <option value="STUDENT">Student</option>
                    </select>
                </div>
                <button
                    onClick={handleInvite}
                    className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                    <Plus size={18} />
                    <span>Invite</span>
                </button>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-text-primary">Active Members</h3>
                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        <div className="text-text-muted text-center py-8">Loading team...</div>
                    ) : (
                        members.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-4 bg-bg-secondary border border-border rounded-lg hover:border-accent/50 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-text-primary font-bold">
                                        {member.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-medium text-text-primary">{member.full_name}</div>
                                        <div className="text-xs text-text-muted flex items-center gap-1">
                                            {member.email} • <span className="text-accent">{member.role}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { }} className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
