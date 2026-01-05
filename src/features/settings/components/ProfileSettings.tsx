import React, { useState } from 'react';
import type { Course, CourseEnrollment } from '../../../services/types';
import { User, Mail, Shield, Save, Trash2, LogOut, BookOpen, Clock, DollarSign } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../../services/api';

export const ProfileSettings: React.FC = () => {
    const { user, signOut } = useAuth();
    const [name, setName] = useState(user?.full_name || '');
    const [email] = useState(user?.email || '');
    const [loading, setLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [studentCourse, setStudentCourse] = useState<Course | null>(null);
    const [studentEnrollment, setStudentEnrollment] = useState<CourseEnrollment | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const fetchStudentCourse = async () => {
            // Cast to string to avoid TS literal comparison error
            const role = user?.role as string;
            if (role === 'student' || role === 'STUDENT') {
                try {
                    const courses = await api.academy.listCourses();
                    const enrolled = courses.find(c => c.student_ids.includes(user!.id));

                    if (enrolled) {
                        setStudentCourse(enrolled);
                        const details = await api.academy.getEnrollment(enrolled.id, user!.id);
                        setStudentEnrollment(details);
                    }
                } catch (err) {
                    console.error('Error fetching student course:', err);
                }
            }
        };
        fetchStudentCourse();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await api.settings.updateProfile(user.id, {
                full_name: name
            });
            alert('Profilo aggiornato con successo!');
            // Reload to refresh context
            window.location.reload();
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('Errore durante l\'aggiornamento del profilo.');
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !e.target.files || !e.target.files[0]) return;

        setIsUploading(true);
        const file = e.target.files[0];
        const path = `avatars/${user.id}/${Date.now()}_${file.name}`;

        try {
            // Upload to storage
            const publicUrl = await api.storage.upload('avatars', path, file);

            // Update user profile
            await api.settings.updateProfile(user.id, {
                avatar_url: publicUrl
            });

            // Reload to show changes
            window.location.reload();
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            alert('Errore durante il caricamento della foto.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user || !user.avatar_url) return;
        if (!window.confirm('Sei sicuro di voler rimuovere la foto profilo?')) return;

        setLoading(true);
        try {
            // We usually don't delete from storage to avoid broken links if used elsewhere, or we can.
            // For now just clear the URL in profile.
            await api.settings.updateProfile(user.id, {
                avatar_url: ''
            }); // Passing empty string to clear, might need null handling in backend or type
            // casting to any if strict. But types say string | undefined. 
            // In DB it might be nullable.

            window.location.reload();
        } catch (error) {
            console.error('Failed to remove avatar:', error);
            alert('Errore durante la rimozione della foto.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-full bg-gradient-to-br from-bg-tertiary to-bg-secondary flex items-center justify-center border-2 border-border relative group cursor-pointer overflow-hidden transition-all hover:border-accent"
                    >
                        {isUploading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                        ) : user?.avatar_url ? (
                            <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User size={40} className="text-text-muted" />
                        )}

                        {!isUploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-white font-medium">Cambia</span>
                            </div>
                        )}
                    </div>
                    {user?.avatar_url && (
                        <button
                            onClick={handleRemoveAvatar}
                            className="absolute -bottom-2 -right-2 p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full border border-red-500/20 transition-colors"
                            title="Rimuovi foto"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                    />
                </div>

                <div>
                    <h3 className="text-xl font-bold text-text-primary">{user?.full_name}</h3>
                    <p className="text-text-muted flex items-center gap-2 text-sm mt-1">
                        <Shield size={14} className="text-accent" />
                        {user?.role.replace('_', ' ')}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Nome Completo</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                            />
                            <User className="absolute left-3 top-2.5 text-text-muted" size={18} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
                        <div className="relative">
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-2.5 text-text-muted cursor-not-allowed"
                            />
                            <Mail className="absolute left-3 top-2.5 text-text-muted" size={18} />
                        </div>
                    </div>
                    {/* Student Course Display */}
                    {((user?.role as string) === 'student' || (user?.role as string) === 'STUDENT') && studentCourse && studentEnrollment && (
                        <div className="md:col-span-2 mt-4">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen size={18} className="text-accent" />
                                <h4 className="text-lg font-bold text-white">Il Tuo Corso</h4>
                            </div>

                            <div className="bg-bg-tertiary rounded-xl border border-border overflow-hidden">
                                <div className="p-4 border-b border-border bg-white/5 flex justify-between items-center">
                                    <h3 className="font-bold text-white max-w-[70%] truncate">
                                        {studentCourse.title}
                                    </h3>
                                    <span className="text-xs text-text-muted bg-black/20 px-2 py-1 rounded">
                                        {studentCourse.duration}
                                    </span>
                                </div>

                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Attendance Section */}
                                    <div>
                                        <h4 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                                            <Clock size={16} /> Presenze
                                        </h4>
                                        <div className="bg-bg-secondary p-3 rounded-lg border border-border">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-2xl font-bold text-white">{studentEnrollment.attended_days}</span>
                                                <span className="text-sm text-text-muted">/ {studentEnrollment.allowed_days} giorni</span>
                                            </div>
                                            <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden mb-2">
                                                <div
                                                    className={clsx("h-full transition-all",
                                                        studentEnrollment.attended_days >= studentEnrollment.allowed_days ? "bg-red-500" : "bg-accent"
                                                    )}
                                                    style={{ width: `${Math.min((studentEnrollment.attended_days / Math.max(studentEnrollment.allowed_days, 1)) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className={studentEnrollment.attended_days >= studentEnrollment.allowed_days ? "text-red-400 font-bold" : "text-text-muted"}>
                                                    {studentEnrollment.attended_days >= studentEnrollment.allowed_days ? "Limite Raggiunto" : "In corso"}
                                                </span>
                                                <span className="text-text-muted">
                                                    Agg: {studentEnrollment.attendance_updated_at ? new Date(studentEnrollment.attendance_updated_at).toLocaleDateString() : 'Mai'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payments Section */}
                                    <div>
                                        <h4 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                                            <DollarSign size={16} /> Pagamenti
                                        </h4>
                                        <div className="bg-bg-secondary p-3 rounded-lg border border-border space-y-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-text-muted">Costo Totale:</span>
                                                <span className="text-white font-medium">€ {studentEnrollment.total_cost?.toFixed(2) || '0.00'}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-text-muted">Versato:</span>
                                                <span className="text-green-400 font-medium">
                                                    € {(studentEnrollment.deposits?.reduce((acc, curr) => acc + curr.amount, 0) || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="h-px bg-border/50 my-1"></div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-text-muted">Residuo:</span>
                                                <span className={clsx("font-bold", ((studentEnrollment.total_cost || 0) - (studentEnrollment.deposits?.reduce((acc, curr) => acc + curr.amount, 0) || 0)) > 0 ? "text-red-400" : "text-green-500")}>
                                                    € {((studentEnrollment.total_cost || 0) - (studentEnrollment.deposits?.reduce((acc, curr) => acc + curr.amount, 0) || 0)).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                    >
                        <Save size={18} />
                        <span>{loading ? 'Salvataggio...' : 'Salva Modifiche'}</span>
                    </button>
                </div>

                <div className="pt-6 border-t border-border mt-8">
                    <h4 className="text-sm font-medium text-text-primary mb-4">Account</h4>
                    <button
                        onClick={() => signOut()}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition-colors font-medium"
                    >
                        <LogOut size={18} />
                        <span>Disconnetti Account</span>
                    </button>

                </div>
            </div>
        </div>
    );
};
