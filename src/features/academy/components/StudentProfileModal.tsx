import React from 'react';
import { X, BookOpen, Clock, DollarSign, RefreshCw as RefreshingCw, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { User, Course, CourseEnrollment, AttendanceRecord } from '../../../services/types';
import { api } from '../../../services/api';
import { supabase } from '../../../lib/supabase';

interface StudentProfileModalProps {
    student: User;
    enrollments: Record<string, CourseEnrollment>;
    courses: Course[];
    loading: boolean;
    onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ student, enrollments, courses, loading, onClose }) => {
    // Filter courses where student is enrolled
    const enrolledCourses = courses.filter(c => c.student_ids?.includes(student.id));

    // State for Profile Tab
    const [activeTab, setActiveTab] = React.useState<'COURSES' | 'PROFILE' | 'CHECKINS'>('COURSES');
    const [checkins, setCheckins] = React.useState<AttendanceRecord[]>([]);
    const [editForm, setEditForm] = React.useState<Partial<User>>({});
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (student) {
            setEditForm({
                full_name: student.full_name,
                phone: student.phone,
                fiscal_code: student.fiscal_code,
                address: student.address,
                city: student.city,
                zip_code: student.zip_code,
                country: student.country,
                vat_number: student.vat_number,
                billing_name: student.billing_name,
                sdi_code: student.sdi_code,
                pec: student.pec
            });

            // Load Checkins
            api.academy.getStudentAttendanceHistory(student.id)
                .then(setCheckins)
                .catch(e => console.error(e));
        }
    }, [student]);

    const handleSaveProfile = async () => {
        if (!student.id) return;
        setSaving(true);
        try {
            await api.settings.updateProfile(student.id, editForm);
            alert('Profilo aggiornato con successo!');
            // In a real app we'd update the parent state, but reload is a quick fix or we assume parent re-fetches
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Errore durante il salvataggio.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-bg-secondary rounded-xl border border-border w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-start bg-bg-tertiary/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent text-lg font-bold">
                            {student.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-text-primary">{student.full_name}</h2>
                            <p className="text-text-muted">{student.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-text-secondary border border-white/10 capitalize">
                                    {student.role}
                                </span>
                                <span className="text-xs text-text-muted">
                                    Iscritto a {enrolledCourses.length} corsi
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-secondary rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setActiveTab('COURSES')}
                        className={clsx("flex-1 py-3 text-sm font-bold transition-colors border-b-2", activeTab === 'COURSES' ? "border-accent text-accent bg-accent/5" : "border-transparent text-text-muted hover:text-text-primary")}
                    >
                        Corsi & Frequenza
                    </button>
                    <button
                        onClick={() => setActiveTab('PROFILE')}
                        className={clsx("flex-1 py-3 text-sm font-bold transition-colors border-b-2", activeTab === 'PROFILE' ? "border-accent text-accent bg-accent/5" : "border-transparent text-text-muted hover:text-text-primary")}
                    >
                        Anagrafica & Fatturazione
                    </button>
                    <button
                        onClick={() => setActiveTab('CHECKINS')}
                        className={clsx("flex-1 py-3 text-sm font-bold transition-colors border-b-2", activeTab === 'CHECKINS' ? "border-accent text-accent bg-accent/5" : "border-transparent text-text-muted hover:text-text-primary")}
                    >
                        Storico Ingressi
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-bg-secondary flex-1">
                    {activeTab === 'CHECKINS' ? (
                        <div className="space-y-4 animate-in fade-in">
                            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-accent" /> Storico Ingressi Check-in
                            </h3>
                            {checkins.length === 0 ? (
                                <div className="text-center py-8 text-text-muted italic bg-bg-tertiary/20 rounded-lg flex flex-col items-center gap-4">
                                    <p>Nessun ingresso registrato.</p>
                                    <button
                                        onClick={async () => {
                                            if (!confirm('ATTENZIONE: Questo forzerà l\'eliminazione di eventuali "presenze fantasma" di oggi che bloccano il check-in. Continuare?')) return;
                                            try {
                                                const { data, error } = await supabase.rpc('force_delete_today_attendance', { p_student_id: student.id });
                                                if (error) throw error;
                                                alert('Operazione completata: ' + (data.message || 'Successo'));
                                                // Reload
                                                const history = await api.academy.getStudentAttendanceHistory(student.id);
                                                setCheckins(history);
                                            } catch (e: any) {
                                                console.error(e);
                                                alert('Errore: ' + e.message);
                                            }
                                        }}
                                        className="text-xs text-red-400 hover:text-red-300 underline"
                                    >
                                        Sblocca Check-in (Forza Eliminazione Oggi)
                                    </button>
                                </div>
                            ) : (
                                checkins.map((record, idx) => {
                                    if (!record.id) console.error('[DEBUG] Rendering checkin without ID:', record);
                                    return (
                                        <div key={record.id || idx} className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg border border-border">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
                                                    <RefreshingCw size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-text-primary">Ingresso Registrato</p>
                                                    <p className="text-xs text-text-muted">Metodo: {record.method}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <p className="text-sm font-bold text-text-primary">
                                                        {new Date(record.check_in_time).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-xs text-text-muted">
                                                        {new Date(record.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Eliminare questo ingresso?')) return;
                                                        try {
                                                            await api.academy.deleteStudentAttendance(record.id);
                                                            setCheckins(prev => prev.filter(c => c.id !== record.id));
                                                        } catch (e) {
                                                            console.error(e);
                                                            alert('Errore eliminazione');
                                                        }
                                                    }}
                                                    className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Elimina Ingresso"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : activeTab === 'COURSES' ? (
                        loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                                <RefreshingCw size={32} className="animate-spin mb-4 opacity-50" />
                                <p>Caricamento profilo...</p>
                            </div>
                        ) : enrolledCourses.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-border rounded-xl bg-bg-tertiary/20">
                                <p className="text-text-muted">Lo studente non è iscritto a nessun corso.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {enrolledCourses.map(course => {
                                    const enrollment = enrollments[course.id];
                                    if (!enrollment) return null;

                                    const totalPaid = enrollment.deposits?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
                                    const remaining = (enrollment.total_cost || 0) - totalPaid;
                                    const attendancePercent = enrollment.allowed_days > 0
                                        ? Math.min((enrollment.attended_days / enrollment.allowed_days) * 100, 100)
                                        : 0;
                                    const isLimitReached = enrollment.attended_days >= enrollment.allowed_days;

                                    return (
                                        <div key={course.id} className="bg-bg-tertiary rounded-xl border border-border overflow-hidden">
                                            <div className="p-4 border-b border-border bg-white/5 flex justify-between items-center">
                                                <h3 className="font-bold text-text-primary flex items-center gap-2">
                                                    <BookOpen size={18} className="text-accent" />
                                                    {course.title}
                                                </h3>
                                                <span className="text-xs text-text-muted bg-black/20 px-2 py-1 rounded">
                                                    {course.duration}
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
                                                            <span className="text-2xl font-bold text-text-primary">{enrollment.attended_days}</span>
                                                            <span className="text-sm text-text-muted">/ {enrollment.allowed_days} giorni</span>
                                                        </div>
                                                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden mb-2">
                                                            <div
                                                                className={clsx("h-full transition-all", isLimitReached ? "bg-red-500" : "bg-accent")}
                                                                style={{ width: `${attendancePercent}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className={isLimitReached ? "text-red-400 font-bold" : "text-text-muted"}>
                                                                {isLimitReached ? "Limite Raggiunto" : "In corso"}
                                                            </span>
                                                            <span className="text-text-muted">Ultimo agg: {enrollment.attendance_updated_at ? new Date(enrollment.attendance_updated_at).toLocaleDateString() : 'Mai'}</span>
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
                                                            <span className="text-text-primary font-medium">€ {enrollment.total_cost?.toFixed(2) || '0.00'}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-text-muted">Versato:</span>
                                                            <span className="text-green-400 font-medium">€ {totalPaid.toFixed(2)}</span>
                                                        </div>
                                                        <div className="h-px bg-border/50 my-1"></div>
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-text-muted">Residuo:</span>
                                                            <span className={clsx("font-bold", remaining > 0 ? "text-red-400" : "text-green-500")}>
                                                                € {remaining.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    ) : (
                        <div className="space-y-6 animate-in fade-in">
                            {/* Personal Info */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-text-primary border-b border-border pb-2">Dati Anagrafici</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Nome Completo</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.full_name || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Telefono</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.phone || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Codice Fiscale</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.fiscal_code || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, fiscal_code: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Città</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.city || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-text-muted mb-1">Indirizzo</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.address || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">CAP</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.zip_code || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, zip_code: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Nazione</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.country || 'Italia'}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Billing Info */}
                            <div className="space-y-4 pt-4">
                                <h3 className="text-lg font-bold text-text-primary border-b border-border pb-2">Dati di Fatturazione</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Intestazione Fattura / Ragione Sociale</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.billing_name || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, billing_name: e.target.value }))}
                                            placeholder="Se diverso dal nome"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Partita IVA</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.vat_number || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, vat_number: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">Codice SDI</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.sdi_code || '0000000'}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, sdi_code: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-muted mb-1">PEC</label>
                                        <input
                                            type="email"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-text-primary"
                                            value={editForm.pec || ''}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, pec: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 flex justify-end">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {saving ? 'Salvataggio...' : 'Salva Modifiche'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-border bg-bg-tertiary/20 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-bg-secondary hover:bg-bg-primary text-text-primary border border-border rounded-lg font-medium transition-colors"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};
