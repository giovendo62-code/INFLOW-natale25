import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, User as UserIcon, AlertCircle, MessageCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import type { User, ArtistContract } from '../../services/types';

export const ArtistsPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [artists, setArtists] = useState<User[]>([]);
    const [contracts, setContracts] = useState<Record<string, ArtistContract | null>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = async () => {
        if (!user?.studio_id) return;
        try {
            const artistsList = await api.artists.list(user.studio_id);
            // Filter only artists (exclude owners, managers, etc.)
            const onlyArtists = artistsList.filter(a => (a.role || '').toLowerCase() === 'artist');
            setArtists(onlyArtists);

            // Load contracts for all artists
            const contractsMap: Record<string, ArtistContract | null> = {};
            await Promise.all(onlyArtists.map(async (a) => {
                const c = await api.artists.getContract(a.id);
                contractsMap[a.id] = c;
            }));
            setContracts(contractsMap);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user?.studio_id]);

    // Enable Realtime Updates
    useRealtime('users', () => {
        console.log('Realtime update: users table changed');
        loadData();
    });

    useRealtime('artist_contracts', () => {
        console.log('Realtime update: contracts table changed');
        loadData();
    });
    if (!user?.studio_id) return;
    try {
        const artistsList = await api.artists.list(user.studio_id);
        // Filter only artists (exclude owners, managers, etc.)
        const onlyArtists = artistsList.filter(a => (a.role || '').toLowerCase() === 'artist');
        setArtists(onlyArtists);

        // Load contracts for all artists
        const contractsMap: Record<string, ArtistContract | null> = {};
        await Promise.all(onlyArtists.map(async (a) => {
            const c = await api.artists.getContract(a.id);
            contractsMap[a.id] = c;
        }));
        setContracts(contractsMap);
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
};


const filteredArtists = artists.filter(a =>
    (a.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(searchTerm.toLowerCase())
);

if (loading) return <div className="p-8 text-center text-text-muted">Loading artists...</div>;

return (
    <div className="w-full p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">Artisti</h1>
                    <p className="text-text-muted">Gestisci gli artisti del tuo studio e i loro contratti.</p>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-bg-secondary p-4 rounded-xl border border-border">
                <Search className="text-text-muted" size={20} />
                <input
                    type="text"
                    placeholder="Cerca per nome o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-text-primary placeholder-text-muted flex-1"
                />
                <button className="p-2 hover:bg-white/5 rounded-lg text-text-muted transition-colors">
                    <Filter size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredArtists.map(artist => {
                    const contract = contracts[artist.id];
                    return (
                        <div
                            key={artist.id}
                            onClick={() => navigate(`/artists/${artist.id}`)}
                            className="bg-bg-secondary p-4 rounded-xl border border-border hover:border-accent/50 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center overflow-hidden">
                                        {artist.avatar_url ? (
                                            <img src={artist.avatar_url} alt={artist.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="text-text-muted" size={24} />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-text-primary group-hover:text-accent transition-colors">
                                            {artist.full_name}
                                        </h3>
                                        <p className="text-sm text-text-muted">{artist.email}</p>
                                        {artist.phone && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(`https://wa.me/${artist.phone?.replace(/\s+/g, '') || ''}`, '_blank');
                                                }}
                                                className="mt-1 flex items-center gap-1 text-xs font-medium text-green-500 hover:text-green-400 transition-colors"
                                            >
                                                <MessageCircle size={14} />
                                                <span>WhatsApp</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Tipo Affitto</p>
                                        <div className="flex items-center gap-2 justify-end">
                                            {contract ? (
                                                <span className="bg-accent/10 text-accent px-2 py-1 rounded text-xs font-medium">
                                                    {contract.rent_type}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-yellow-500 text-xs">
                                                    <AlertCircle size={12} /> Nessun Contratto
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {contract && (
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Commissione</p>
                                            <span className="text-text-primary font-mono">{contract.commission_rate}%</span>
                                        </div>
                                    )}

                                    {contract?.rent_type === 'PRESENCES' && (
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Presences</p>
                                            <span className="text-text-primary font-mono">
                                                {contract.used_presences} / {contract.presence_package_limit || '∞'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredArtists.length === 0 && (
                    <div className="text-center py-12 text-text-muted">
                        No artists found matching your search.
                    </div>
                )}
            </div>
        </div>
    </div>
);
};
