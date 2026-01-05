import React from 'react';
import { X, BookOpen, Clock, DollarSign, RefreshCw as RefreshingCw } from 'lucide-react';
import clsx from 'clsx';
import type { User, Course, CourseEnrollment } from '../../../services/types';

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
                            <h2 className="text-2xl font-bold text-white">{student.full_name}</h2>
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
                    <button onClick={onClose} className="p-2 text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-bg-secondary">
                    {loading ? (
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
                                if (!enrollment) return null; // Should not happen if loading is false

                                const totalPaid = enrollment.deposits?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
                                const remaining = (enrollment.total_cost || 0) - totalPaid;
                                const attendancePercent = enrollment.allowed_days > 0
                                    ? Math.min((enrollment.attended_days / enrollment.allowed_days) * 100, 100)
                                    : 0;
                                const isLimitReached = enrollment.attended_days >= enrollment.allowed_days;

                                return (
                                    <div key={course.id} className="bg-bg-tertiary rounded-xl border border-border overflow-hidden">
                                        <div className="p-4 border-b border-border bg-white/5 flex justify-between items-center">
                                            <h3 className="font-bold text-white flex items-center gap-2">
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
                                                        <span className="text-2xl font-bold text-white">{enrollment.attended_days}</span>
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
                                                        <span className="text-white font-medium">€ {enrollment.total_cost?.toFixed(2) || '0.00'}</span>
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
                    )}
                </div>
                <div className="p-4 border-t border-border bg-bg-tertiary/20 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};
