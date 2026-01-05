import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../services/api';
import type { Communication } from '../../services/types';
import { MessageCircle, Send, Trash2, ShieldAlert, Reply } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export const CommunicationsPage: React.FC = () => {
    const { user } = useAuth();
    const [communications, setCommunications] = useState<Communication[]>([]);
    const [loading, setLoading] = useState(true);

    // New Post State
    const [newContent, setNewContent] = useState('');
    const [isImportant, setIsImportant] = useState(false);

    // Reply State
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        if (!user?.studio_id) return;
        setLoading(true);
        try {
            const data = await api.communications.list(user.studio_id);
            setCommunications(data);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newContent.trim() || !user) return;

        try {
            await api.communications.create({
                studio_id: user.studio_id!,
                author_id: user.id,
                author_name: user.full_name,
                content: newContent,
                is_important: isImportant
            });
            setNewContent('');
            setIsImportant(false);
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeletePost = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo messaggio?')) return;
        try {
            await api.communications.delete(id);
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleReply = async (commId: string) => {
        if (!replyContent.trim() || !user) return;
        try {
            await api.communications.addReply(commId, {
                author_id: user.id,
                author_name: user.full_name,
                content: replyContent
            });
            setReplyContent('');
            setReplyingTo(null);
            loadData();
        } catch (error) {
            console.error(error);
        }
    };

    const normalizedRole = user?.role?.toLowerCase();
    const canCreate = ['owner', 'studio_admin', 'manager', 'artist'].includes(normalizedRole || '');
    const canDelete = ['owner', 'studio_admin'].includes(normalizedRole || '');

    if (loading) return <div className="text-center text-text-muted py-12">Caricamento comunicazioni...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 h-full flex flex-col">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/20 rounded-xl text-accent">
                    <MessageCircle size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Bacheca Team</h1>
                    <p className="text-text-muted">Chat e aggiornamenti per tutto il team.</p>
                </div>
            </div>

            {/* Create Post Section (Admin/Manager only) */}
            {canCreate && (
                <div className="bg-bg-secondary p-6 rounded-xl border border-border shadow-lg">
                    <h3 className="text-lg font-bold text-white mb-4">Nuova Comunicazione</h3>
                    <form onSubmit={handleCreatePost} className="space-y-4">
                        <textarea
                            className="w-full bg-bg-tertiary border border-border rounded-lg p-4 text-white focus:ring-2 focus:ring-accent outline-none resize-none h-32"
                            placeholder="Scrivi un messaggio per il team..."
                            value={newContent}
                            onChange={e => setNewContent(e.target.value)}
                        />
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-text-secondary cursor-pointer hover:text-white transition-colors">
                                <input
                                    type="checkbox"
                                    checked={isImportant}
                                    onChange={e => setIsImportant(e.target.checked)}
                                    className="accent-accent w-4 h-4 rounded"
                                />
                                <span className={clsx("font-medium", isImportant && "text-red-400")}>Segna come Importante</span>
                                {isImportant && <ShieldAlert size={16} className="text-red-400" />}
                            </label>
                            <button
                                type="submit"
                                disabled={!newContent.trim()}
                                className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2"
                            >
                                <Send size={18} /> Pubblica
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Feed */}
            <div className="space-y-6 pb-8">
                {communications.map(comm => (
                    <div key={comm.id} className={clsx(
                        "bg-bg-secondary rounded-xl border shadow-lg overflow-hidden transition-all",
                        comm.is_important ? "border-red-500/50 shadow-red-500/10" : "border-border"
                    )}>
                        {/* Post Header */}
                        <div className={clsx(
                            "p-4 flex justify-between items-start border-b",
                            comm.is_important ? "bg-red-500/10 border-red-500/20" : "bg-bg-tertiary/30 border-border"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                                    {comm.author_name.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-white flex items-center gap-2">
                                        {comm.author_name}
                                        {comm.is_important && (
                                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider">
                                                <ShieldAlert size={10} /> Importante
                                            </span>
                                        )}
                                    </h4>
                                    <span className="text-xs text-text-muted">
                                        {format(new Date(comm.created_at), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                                    </span>
                                </div>
                            </div>
                            {canDelete && (
                                <button
                                    onClick={() => handleDeletePost(comm.id)}
                                    className="text-text-muted hover:text-red-500 p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
                                    title="Elimina messaggio"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>

                        {/* Post Content */}
                        <div className="p-6">
                            <p className="text-text-primary whitespace-pre-wrap leading-relaxed text-lg">{comm.content}</p>
                        </div>

                        {/* Replies Section */}
                        <div className="bg-bg-tertiary/20 p-4 border-t border-border">
                            {comm.replies.length > 0 && (
                                <div className="space-y-4 mb-6 pl-4 border-l-2 border-border/50">
                                    {comm.replies.map(reply => (
                                        <div key={reply.id} className="bg-bg-tertiary p-3 rounded-lg rounded-tl-none relative group">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-sm font-bold text-white">{reply.author_name}</span>
                                                <span className="text-[10px] text-text-muted">
                                                    {format(new Date(reply.created_at), "d MMM HH:mm", { locale: it })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-text-secondary">{reply.content}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reply Input */}
                            {replyingTo === comm.id ? (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                                    <input
                                        type="text"
                                        autoFocus
                                        className="flex-1 bg-bg-tertiary border border-border rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-accent outline-none text-sm"
                                        placeholder="Scrivi una risposta..."
                                        value={replyContent}
                                        onChange={e => setReplyContent(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleReply(comm.id);
                                            }
                                        }}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleReply(comm.id)}
                                            disabled={!replyContent.trim()}
                                            className="bg-accent hover:bg-accent-hover text-white p-2 rounded-lg transition-colors"
                                        >
                                            <Send size={18} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setReplyingTo(null);
                                                setReplyContent('');
                                            }}
                                            className="bg-bg-tertiary hover:bg-white/10 text-white p-2 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setReplyingTo(comm.id)}
                                    className="text-sm text-text-muted hover:text-white flex items-center gap-2 transition-colors px-2 py-1 rounded hover:bg-bg-tertiary w-fit"
                                >
                                    <Reply size={16} /> Rispondi
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {communications.length === 0 && (
                    <div className="text-center py-12 bg-bg-secondary rounded-xl border border-border border-dashed">
                        <MessageCircle size={48} className="mx-auto text-text-muted mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-white">Nessuna comunicazione</h3>
                        <p className="text-text-muted">Non ci sono ancora messaggi nella bacheca.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
