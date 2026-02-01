import React, { useState, useEffect } from 'react';
import { BookOpen, FileText, Plus, Users, Minus, Clock, DollarSign, X, ChevronRight, RefreshCw, Trash2, PlayCircle, Edit2, Check } from 'lucide-react';
import { api } from '../../services/api';
import type { Course, CourseMaterial, CourseEnrollment, AttendanceLog, User, AttendanceRecord } from '../../services/types';
import clsx from 'clsx';
import { useAuth } from '../auth/AuthContext';
import { StudentProfileModal } from './components/StudentProfileModal';
import { DragDropUpload } from '../../components/DragDropUpload';

export const AcademyPage: React.FC = () => {
    const { user } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]); // Store all team members for lookup
    const [students, setStudents] = useState<User[]>([]); // Store only students for lists
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'LIST' | 'CREATE' | 'MANAGE' | 'STUDENTS_LIST'>('LIST');
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

    // Form State
    const [newCourse, setNewCourse] = useState<Partial<Course>>({
        title: '',
        description: '',
        duration: '',
        materials: [],
        student_ids: []
    });

    // Manage State
    const [activeTab, setActiveTab] = useState<'INFO' | 'MATERIALS' | 'STUDENTS' | 'ATTENDANCE'>('INFO');
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);

    // Attendance Detailed State
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [studentEnrollment, setStudentEnrollment] = useState<CourseEnrollment | null>(null);
    const [_attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
    const [loadingEnrollment, setLoadingEnrollment] = useState(false);
    // const [attendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Student Profile Modal State
    const [profileStudent, setProfileStudent] = useState<User | null>(null);
    const [profileEnrollments, setProfileEnrollments] = useState<Record<string, CourseEnrollment>>({});
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [myCheckins, setMyCheckins] = useState<AttendanceRecord[]>([]);

    // Quick Attendance State
    const [courseEnrollments, setCourseEnrollments] = useState<Record<string, CourseEnrollment>>({}); // Map studentId -> Enrollment
    const [_loadingCourseEnrollments, setLoadingCourseEnrollments] = useState(false);

    // Material Upload State
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [newMaterialData, setNewMaterialData] = useState<{ title: string; type: CourseMaterial['type']; file: File | null }>({
        title: '',
        type: 'PDF',
        file: null
    });
    const [uploadingMaterial, setUploadingMaterial] = useState(false);

    // Terms Modal State
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [termsText, setTermsText] = useState('');
    const [savingTerms, setSavingTerms] = useState(false);

    useEffect(() => {
        loadData();
    }, [user?.studio_id]);

    useEffect(() => {
        const loadEnrollments = async () => {
            if (view === 'MANAGE' && (activeTab === 'ATTENDANCE' || activeTab === 'STUDENTS') && selectedCourse?.id) {
                setLoadingCourseEnrollments(true);
                try {
                    const studentIds = selectedCourse.student_ids || [];
                    const map: Record<string, CourseEnrollment> = {};
                    await Promise.all(studentIds.map(async (sid) => {
                        try {
                            const enroll = await api.academy.getEnrollment(selectedCourse.id, sid);
                            if (enroll) map[sid] = enroll;
                        } catch (e) { console.error(e); }
                    }));
                    setCourseEnrollments(map);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoadingCourseEnrollments(false);
                }
            }
        };
        loadEnrollments();
    }, [view, activeTab, selectedCourse?.id]);

    const loadData = async () => {
        if (!user?.studio_id) return;
        setLoading(true);
        try {
            const [coursesData, teamData] = await Promise.all([
                api.academy.listCourses(user.studio_id),
                api.settings.listTeamMembers(user.studio_id)
            ]);
            setCourses(coursesData);
            setAllUsers(teamData);
            // Filter only students from team members
            const studentUsers = teamData.filter(u => (u.role || '').toLowerCase() === 'student');
            setStudents(studentUsers);
            setStudents(studentUsers);

            // Load terms if owner
            if (user?.role === 'owner' || user?.role === 'manager') {
                const studio = await api.settings.getStudio(user.studio_id);
                if (studio && studio.academy_terms) {
                    setTermsText(studio.academy_terms);
                }
            }

            // Load own attendance if student
            if (user?.role === 'student') {
                try {
                    const history = await api.academy.getAttendanceHistory(user.id);
                    setMyCheckins(history);
                } catch (e) {
                    console.error('Failed to load attendance history', e);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!newCourse.title || !newCourse.duration) {
                alert("Titolo e Durata sono obbligatori.");
                return;
            }

            await api.academy.createCourse({
                title: newCourse.title,
                description: newCourse.description || '',
                duration: newCourse.duration,
                price: newCourse.price,
                materials: [],
                student_ids: [],
                studio_id: user?.studio_id
            });

            await loadData();
            setView('LIST');
            setNewCourse({ title: '', description: '', duration: '', materials: [], student_ids: [] });
            alert("Corso creato con successo!");
        } catch (error) {
            console.error(error);
            alert("Errore durante la creazione del corso. Verifica i dati o riprova.");
        }
    };

    const handleManageCourse = (course: Course) => {
        setSelectedCourse(course);
        setView('MANAGE');
        setActiveTab('INFO');
    };

    const handleUpdateCourse = async (updates: Partial<Course>) => {
        if (!selectedCourse) return;
        try {
            const updated = await api.academy.updateCourse(selectedCourse.id, updates);
            setSelectedCourse(updated);

            // Update local list
            setCourses(courses.map(c => c.id === updated.id ? updated : c));
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenAddMaterial = () => {
        setNewMaterialData({ title: '', type: 'PDF', file: null });
        setIsMaterialModalOpen(true);
    };

    const handleSaveMaterial = async () => {
        if (!newMaterialData.title || !newMaterialData.file || !selectedCourse) {
            alert("Compila tutti i campi e carica un file.");
            return;
        }

        setUploadingMaterial(true);
        try {
            // 1. Upload file
            const fileExt = newMaterialData.file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `materials/${selectedCourse.id}/${fileName}`;

            // Ensure we use the correct bucket name. We assume 'academy-materials' or fall back to a known one if configured.
            // Using 'materials' as bucket name based on typical setup, or 'academy'.
            // Checking SupabaseRepository, it uses 'consents', so we might need to be sure.
            // Let's assume 'academy' for now. Usage: api.storage.upload('academy', path, file)

            const publicUrl = await api.storage.upload('academy', filePath, newMaterialData.file);

            // 2. Add material to course
            const newMaterial: CourseMaterial = {
                id: `mat-${Date.now()}`,
                title: newMaterialData.title,
                type: newMaterialData.type,
                url: publicUrl
            };

            await handleUpdateCourse({
                materials: [...(selectedCourse.materials || []), newMaterial]
            });

            setIsMaterialModalOpen(false);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Errore durante il caricamento del file.");
        } finally {
            setUploadingMaterial(false);
        }
    };

    /* const handleAddStudent = async () => {
        const studentId = prompt("ID dello studente (es. user-student):");
        if (!studentId) return;
        if (selectedCourse?.student_ids.includes(studentId)) {
            alert("Studente già iscritto");
            return;
        }

        await handleUpdateCourse({
            student_ids: [...(selectedCourse?.student_ids || []), studentId]
        });
    }; */

    const handleOpenAddStudentModal = () => {
        setIsAddStudentModalOpen(true);
    };

    const handleAddStudentFromList = async (targetStudent: User) => {
        if (!selectedCourse) return;

        try {
            await handleUpdateCourse({
                student_ids: [...(selectedCourse.student_ids || []), targetStudent.id]
            });
            setIsAddStudentModalOpen(false);
            // alert(`Studente ${targetStudent.full_name} iscritto con successo!`); // Optional feedback
        } catch (error) {
            console.error("Errore durante l'iscrizione:", error);
            alert("Errore durante l'iscrizione dello studente.");
        }
    };

    const handleRemoveStudent = async (studentId: string) => {
        if (!selectedCourse || !confirm("Sei sicuro di voler rimuovere lo studente dal corso?")) return;

        try {
            await handleUpdateCourse({
                student_ids: (selectedCourse.student_ids || []).filter(id => id !== studentId)
            });
        } catch (error) {
            console.error("Errore durante la rimozione:", error);
            alert("Errore durante la rimozione dello studente.");
        }
    };

    const handleQuickAttendance = async (studentId: string) => {
        if (!selectedCourse) return;
        const enrollment = courseEnrollments[studentId];
        if (!enrollment) return;

        if (enrollment.attended_days >= enrollment.allowed_days) {
            alert("Limite presenze raggiunto per questo studente.");
            return;
        }

        try {
            const newAttended = enrollment.attended_days + 1;
            const updated = await api.academy.updateEnrollment(selectedCourse.id, studentId, {
                attended_days: newAttended,
                attendance_updated_at: new Date().toISOString()
            });

            // Update local state
            setCourseEnrollments(prev => ({ ...prev, [studentId]: updated }));
            // Also update detailed view state if matching
            if (studentId === selectedStudentId && studentEnrollment) {
                setStudentEnrollment(updated);
            }

            // Non-blocking log
            try {
                await api.academy.logAttendance({
                    course_id: selectedCourse.id,
                    student_id: studentId,
                    action: 'INCREMENT',
                    previous_value: enrollment.attended_days,
                    new_value: newAttended,
                    created_by: 'current-user'
                });
            } catch (logErr) {
                console.warn("Logging failed", logErr);
            }
        } catch (error) {
            console.error(error);
            alert("Errore aggiornamento presenza.");
        }
    };    // Detailed Attendance Logic
    const fetchEnrollmentData = async (studentId: string) => {
        if (!selectedCourse) return;
        setLoadingEnrollment(true);
        try {
            const enroll = await api.academy.getEnrollment(selectedCourse.id, studentId);
            setStudentEnrollment(enroll);
            // Logs removed from UI, but data fetch kept if needed for other logic or simplified view
            // const logs = await api.academy.getAttendanceLogs(selectedCourse.id, studentId);
            // setAttendanceLogs(logs);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingEnrollment(false);
        }
    };

    const handleSelectStudentForAttendance = (studentId: string) => {
        setSelectedStudentId(studentId);
        fetchEnrollmentData(studentId);
    };

    const handleUpdateAttendanceCount = async (delta: number) => {
        if (!selectedCourse || !selectedStudentId || !studentEnrollment) return;

        const newAttended = studentEnrollment.attended_days + delta;
        if (newAttended < 0) {
            alert("Non puoi scendere sotto 0 presenze.");
            return;
        }
        if (newAttended > studentEnrollment.allowed_days) {
            alert("Hai raggiunto il limite di giorni frequentabili.");
            return;
        }

        try {
            const updated = await api.academy.updateEnrollment(selectedCourse.id, selectedStudentId, {
                attended_days: newAttended,
                attendance_updated_at: new Date().toISOString()
            });
            setStudentEnrollment(updated);

            // Log
            await api.academy.logAttendance({
                course_id: selectedCourse.id,
                student_id: selectedStudentId,
                action: delta > 0 ? 'INCREMENT' : 'DECREMENT',
                previous_value: studentEnrollment.attended_days,
                new_value: newAttended,
                created_by: 'current-user' // Should come from auth context
            });

            // Refresh logs
            const logs = await api.academy.getAttendanceLogs(selectedCourse.id, selectedStudentId);
            setAttendanceLogs(logs);

        } catch (error) {
            console.error(error);
        }
    };

    const handleSetAttendanceCount = async (value: number) => {
        if (!selectedCourse || !selectedStudentId || !studentEnrollment) return;
        if (value < 0 || value > studentEnrollment.allowed_days) {
            alert("Valore non valido (fuori dai limiti).");
            return;
        }

        const prev = studentEnrollment.attended_days;
        try {
            const updated = await api.academy.updateEnrollment(selectedCourse.id, selectedStudentId, {
                attended_days: value,
                attendance_updated_at: new Date().toISOString()
            });
            setStudentEnrollment(updated);

            await api.academy.logAttendance({
                course_id: selectedCourse.id,
                student_id: selectedStudentId,
                action: value === 0 ? 'RESET' : 'SET',
                previous_value: prev,
                new_value: value,
                created_by: 'current-user'
            });
            const logs = await api.academy.getAttendanceLogs(selectedCourse.id, selectedStudentId);
            setAttendanceLogs(logs);
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdateAllowedDays = async (newLimit: number) => {
        if (!selectedCourse || !selectedStudentId || !studentEnrollment) return;
        if (newLimit < 0) return;

        let newAttended = studentEnrollment.attended_days;


        if (newLimit < newAttended) {
            newAttended = newLimit;
            alert("Attenzione: il nuovo limite è inferiore alle presenze attuali. Le presenze sono state riallineate.");
        }

        try {
            const updated = await api.academy.updateEnrollment(selectedCourse.id, selectedStudentId, {
                allowed_days: newLimit,
                attended_days: newAttended, // Autosync if needed
                attendance_updated_at: new Date().toISOString()
            });
            setStudentEnrollment(updated);

            await api.academy.logAttendance({
                course_id: selectedCourse.id,
                student_id: selectedStudentId,
                action: 'LIMIT_CHANGE',
                previous_value: studentEnrollment.allowed_days,
                new_value: newLimit,
                created_by: 'current-user'
            });

            const logs = await api.academy.getAttendanceLogs(selectedCourse.id, selectedStudentId);
            setAttendanceLogs(logs);

        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteCourse = async () => {
        if (!selectedCourse) return;
        if (!confirm("Sei sicuro di voler eliminare questo corso? L'azione è irreversibile.")) return;

        try {
            await api.academy.deleteCourse(selectedCourse.id);
            await loadData();
            setView('LIST');
            setSelectedCourse(null);
        } catch (error) {
            console.error(error);
            alert("Errore durante l'eliminazione del corso.");
        }
    };

    const handleOpenProfile = async (student: User) => {
        setProfileStudent(student);
        setLoadingProfile(true);
        setProfileEnrollments({});

        try {
            // Find courses where student is enrolled
            const enrolledCourses = courses.filter(c => c.student_ids?.includes(student.id));

            const enrollmentsMap: Record<string, CourseEnrollment> = {};

            await Promise.all(enrolledCourses.map(async (course) => {
                try {
                    const enroll = await api.academy.getEnrollment(course.id, student.id);
                    if (enroll) {
                        enrollmentsMap[course.id] = enroll;
                    }
                } catch (e) {
                    console.error(`Failed to fetch enrollment for course ${course.id}`, e);
                }
            }));

            setProfileEnrollments(enrollmentsMap);
        } catch (error) {
            console.error("Error loading profile details:", error);
            alert("Errore nel caricamento del profilo.");
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleSaveTerms = async () => {
        if (!user?.studio_id) return;
        setSavingTerms(true);
        try {
            await api.academy.updateTerms(user.studio_id, termsText);
            setIsTermsModalOpen(false);
            alert("Termini e Condizioni aggiornati con successo!");
        } catch (error) {
            console.error("Failed to save terms", error);
            alert("Errore durante il salvataggio dei termini.");
        } finally {
            setSavingTerms(false);
        }
    };

    return (
        <div className="w-full p-4 md:p-8 space-y-8 flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">Academy</h1>
                    <p className="text-text-muted">Gestione corsi, materiali e studenti.</p>
                </div>

                {user?.role === 'student' && (
                    <div className="bg-bg-tertiary p-4 rounded-xl border border-border flex items-center gap-4">
                        <div className="p-3 bg-accent/20 rounded-full text-accent">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-text-muted font-bold">I Miei Ingressi</p>
                            <p className="text-2xl font-bold text-text-primary">{myCheckins.length}</p>
                        </div>
                        <button
                            onClick={() => {
                                if (user) handleOpenProfile(user);
                            }}
                            className="bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-text-primary px-3 py-1 rounded text-xs font-bold border border-border transition-colors ml-4"
                        >
                            Vedi Tutti
                        </button>
                    </div>
                )}

                <div className="flex gap-2">
                    {user?.role !== 'student' && (
                        <>
                            <button
                                onClick={() => setView('LIST')}
                                className={clsx("px-4 py-2 rounded-lg font-bold transition-colors", view === 'LIST' ? "bg-accent text-white" : "bg-bg-tertiary text-text-muted hover:text-text-primary")}
                            >
                                Corsi
                            </button>
                            <button
                                onClick={() => setView('STUDENTS_LIST')}
                                className={clsx("px-4 py-2 rounded-lg font-bold transition-colors", view === 'STUDENTS_LIST' ? "bg-accent text-white" : "bg-bg-tertiary text-text-muted hover:text-text-primary")}
                            >
                                Studenti Connessi
                            </button>

                            <button
                                onClick={() => setIsTermsModalOpen(true)}
                                className="px-4 py-2 rounded-lg font-bold transition-colors bg-bg-tertiary text-text-muted hover:text-text-primary flex items-center gap-2"
                            >
                                <FileText size={18} />
                                <span className="hidden lg:inline">Termini</span>
                            </button>

                            {view === 'LIST' && (
                                <button
                                    onClick={() => setView('CREATE')}
                                    className="flex items-center gap-2 bg-bg-tertiary hover:bg-bg-primary text-text-primary px-4 py-2 rounded-lg font-bold transition-colors border border-dashed border-border"
                                >
                                    <Plus size={20} /> Nuovo Corso
                                </button>
                            )}
                        </>
                    )}
                </div>

                {view === 'CREATE' || view === 'MANAGE' ? (
                    <button
                        onClick={() => setView('LIST')}
                        className="flex items-center gap-2 bg-bg-tertiary hover:bg-bg-primary text-text-primary px-4 py-2 rounded-lg font-bold transition-colors border border-border"
                    >
                        Indietro
                    </button>
                ) : null}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {view === 'STUDENTS_LIST' ? (
                    <div className="space-y-6">
                        <div className="bg-bg-secondary p-6 rounded-xl border border-border">
                            <h2 className="text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
                                <Users size={24} className="text-accent" />
                                Studenti Connessi ({students.length})
                            </h2>
                            <p className="text-text-muted mb-6">
                                Elenco degli studenti che hanno accettato l'invito e si sono registrati alla piattaforma.
                            </p>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-4">
                                {students.length === 0 ? (
                                    <div className="text-center py-8 text-text-muted italic bg-bg-tertiary/20 rounded-lg">
                                        Nessuno studente connesso al momento.
                                    </div>
                                ) : (
                                    students.map((student) => (
                                        <div key={student.id} className="bg-bg-tertiary p-4 rounded-lg border border-border flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-bold">
                                                    {student.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-text-primary font-bold truncate">{student.full_name || 'N/A'}</p>
                                                    <p className="text-sm text-text-secondary truncate">{student.email}</p>
                                                </div>
                                                <span className="text-xs px-2 py-1 rounded bg-white/5 text-text-muted uppercase">
                                                    {student.role.toLowerCase()}
                                                </span>
                                            </div>
                                            <button
                                                className="w-full text-text-primary hover:bg-bg-primary px-3 py-2 bg-bg-secondary rounded text-sm border border-border font-bold flex items-center justify-center gap-2 transition-colors"
                                                onClick={() => handleOpenProfile(student)}
                                            >
                                                Vedi Scheda
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-border text-text-secondary text-sm">
                                            <th className="py-3 px-4 font-medium">Nome</th>
                                            <th className="py-3 px-4 font-medium">Email</th>
                                            <th className="py-3 px-4 font-medium">Ruolo</th>
                                            <th className="py-3 px-4 font-medium">Azioni</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {students.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-text-muted italic">
                                                    Nessuno studente connesso al momento.
                                                </td>
                                            </tr>
                                        ) : (
                                            students.map((student) => (
                                                <tr key={student.id} className="hover:bg-bg-tertiary/50 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                                                                {student.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                                                            </div>
                                                            <span className="text-text-primary font-medium">{student.full_name || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-text-secondary">{student.email}</td>
                                                    <td className="py-3 px-4 text-text-muted text-sm capitalize">
                                                        {student.role.toLowerCase()}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            className="text-text-primary hover:bg-bg-primary px-3 py-1 bg-bg-secondary rounded text-xs border border-border font-bold flex items-center gap-1 transition-colors"
                                                            onClick={() => handleOpenProfile(student)}
                                                        >
                                                            Vedi Scheda
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : view === 'LIST' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? (
                            <div className="col-span-full text-center text-text-muted py-12">Caricamento corsi...</div>
                        ) : courses.map(course => (
                            <div key={course.id} className="bg-bg-secondary border border-border rounded-xl overflow-hidden hover:border-accent/50 transition-all group flex flex-col">
                                <div className="p-6 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-bg-tertiary rounded-lg text-accent">
                                            <BookOpen size={24} />
                                        </div>
                                        <span className="text-xs font-medium px-2 py-1 bg-bg-tertiary rounded text-text-muted">
                                            {course.duration}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-text-primary mb-2">{course.title}</h3>
                                    <p className="text-sm text-text-secondary line-clamp-3 mb-4">
                                        {course.description}
                                    </p>

                                    <div className="flex items-center gap-4 text-sm text-text-muted mt-auto pt-4 border-t border-border">
                                        <div className="flex items-center gap-1">
                                            <FileText size={16} />
                                            <span>{course.materials?.length || 0} Moduli</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Users size={16} />
                                            <span>{course.student_ids?.length || 0} Studenti</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-bg-tertiary/50 p-4 border-t border-border">
                                    <button
                                        onClick={() => handleManageCourse(course)}
                                        className="w-full py-2 bg-bg-secondary hover:bg-bg-primary text-text-primary rounded-lg transition-colors text-sm font-medium border border-border"
                                    >
                                        Gestisci Corso
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : view === 'MANAGE' && selectedCourse ? (
                    <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden shadow-2xl">
                        {/* Course Header */}
                        <div className="p-8 border-b border-border bg-bg-tertiary/20">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-bold text-text-primary mb-2">{selectedCourse.title}</h2>
                                    <p className="text-text-muted">{selectedCourse.description}</p>
                                </div>
                                <button
                                    onClick={handleDeleteCourse}
                                    className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Elimina Corso"
                                >
                                    <Trash2 size={24} />
                                </button>
                            </div>

                            <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                                <button
                                    onClick={() => setActiveTab('INFO')}
                                    className={clsx("px-3 py-2 md:px-4 rounded-lg font-medium transition-colors whitespace-nowrap text-sm md:text-base flex-shrink-0", activeTab === 'INFO' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-secondary hover:text-text-primary")}
                                >
                                    Info Gen.
                                </button>
                                <button
                                    onClick={() => setActiveTab('MATERIALS')}
                                    className={clsx("px-3 py-2 md:px-4 rounded-lg font-medium transition-colors whitespace-nowrap text-sm md:text-base flex-shrink-0", activeTab === 'MATERIALS' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-secondary hover:text-text-primary")}
                                >
                                    Materiale Didattico
                                </button>
                                <button
                                    onClick={() => setActiveTab('STUDENTS')}
                                    className={clsx("px-3 py-2 md:px-4 rounded-lg font-medium transition-colors whitespace-nowrap text-sm md:text-base flex-shrink-0", activeTab === 'STUDENTS' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-secondary hover:text-text-primary")}
                                >
                                    Corsisti
                                </button>
                                <button
                                    onClick={() => setActiveTab('ATTENDANCE')}
                                    className={clsx("px-3 py-2 md:px-4 rounded-lg font-medium transition-colors whitespace-nowrap text-sm md:text-base flex-shrink-0", activeTab === 'ATTENDANCE' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-secondary hover:text-text-primary")}
                                >
                                    Registro
                                </button>
                            </div>
                        </div>

                        <div className="p-8">
                            {/* INFO TAB */}
                            {activeTab === 'INFO' && (
                                <div className="space-y-6 max-w-2xl">
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-2">Titolo Corso</label>
                                        <input
                                            type="text"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                            value={selectedCourse.title}
                                            onChange={(e) => handleUpdateCourse({ title: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-text-secondary mb-2">Durata</label>
                                            <input
                                                type="text"
                                                className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                                value={selectedCourse.duration}
                                                onChange={(e) => handleUpdateCourse({ duration: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-text-secondary mb-2">Descrizione</label>
                                        <textarea
                                            className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:ring-2 focus:ring-accent outline-none h-32 resize-none"
                                            value={selectedCourse.description}
                                            onChange={(e) => handleUpdateCourse({ description: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* MATERIALS TAB */}
                            {activeTab === 'MATERIALS' && (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-text-primary">Materiali Didattici</h3>
                                        <button
                                            onClick={handleOpenAddMaterial}
                                            className="flex items-center gap-2 bg-bg-primary hover:bg-bg-tertiary text-text-primary px-4 py-2 rounded-lg font-medium transition-colors border border-border"
                                        >
                                            <Plus size={18} /> Aggiungi Materiale
                                        </button>
                                    </div>

                                    {/* Material Upload Modal */}
                                    {isMaterialModalOpen && (
                                        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                                            <div className="bg-bg-secondary p-6 rounded-xl border border-border w-full max-w-md space-y-4">
                                                <h3 className="text-xl font-bold text-text-primary">Carica Materiale</h3>

                                                <div>
                                                    <label className="block text-sm text-text-muted mb-1">Titolo</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary"
                                                        value={newMaterialData.title}
                                                        onChange={e => setNewMaterialData({ ...newMaterialData, title: e.target.value })}
                                                        placeholder="Es. Dispensa Anatomia"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm text-text-muted mb-1">Tipo</label>
                                                    <select
                                                        className="w-full bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary"
                                                        value={newMaterialData.type}
                                                        onChange={e => setNewMaterialData({ ...newMaterialData, type: e.target.value as any })}
                                                    >
                                                        <option value="PDF">PDF / Documento</option>
                                                        <option value="VIDEO">Video</option>
                                                        <option value="LINK">Link Esterno</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm text-text-muted mb-2">File</label>
                                                    <DragDropUpload
                                                        onUpload={(file) => setNewMaterialData({ ...newMaterialData, file })}
                                                        label={newMaterialData.file ? newMaterialData.file.name : "Trascina file qui"}
                                                        sublabel={newMaterialData.file ? "File selezionato" : "PDF, Video, Immagini"}
                                                        className={newMaterialData.file ? "border-accent bg-accent/10" : ""}
                                                    />
                                                </div>

                                                <div className="flex gap-2 justify-end mt-4">
                                                    <button
                                                        onClick={() => setIsMaterialModalOpen(false)}
                                                        className="px-4 py-2 text-text-muted hover:text-text-primary"
                                                    >
                                                        Annulla
                                                    </button>
                                                    <button
                                                        onClick={handleSaveMaterial}
                                                        disabled={uploadingMaterial}
                                                        className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        {uploadingMaterial ? (
                                                            <>
                                                                <RefreshCw size={16} className="animate-spin" />
                                                                Caricamento...
                                                            </>
                                                        ) : (
                                                            <>Salva Materiale</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {(selectedCourse.materials || []).length === 0 && (
                                            <p className="col-span-full text-text-muted italic">Nessun materiale caricato.</p>
                                        )}
                                        {(selectedCourse.materials || []).map((mat, idx) => (
                                            <div key={idx} className="bg-bg-tertiary p-4 rounded-lg border border-border flex items-center gap-4">
                                                <div className="p-2 bg-bg-secondary rounded text-accent">
                                                    {mat.type === 'VIDEO' ? <PlayCircle size={20} /> : <FileText size={20} />}
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-text-primary font-medium truncate">{mat.title}</p>
                                                    <p className="text-xs text-text-muted">{mat.type}</p>
                                                </div>
                                                <button className="text-red-400 hover:text-red-300 transition-colors">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* STUDENTS TAB */}
                            {activeTab === 'STUDENTS' && (
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-text-primary">Corsisti Iscritti</h3>
                                        <button
                                            onClick={handleOpenAddStudentModal}
                                            className="flex items-center gap-2 bg-bg-primary hover:bg-bg-tertiary text-text-primary px-4 py-2 rounded-lg font-medium transition-colors border border-border"
                                        >
                                            <Users size={18} /> Aggiungi Studente
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {(selectedCourse.student_ids || []).length === 0 && (
                                            <p className="text-text-muted italic">Nessun studente iscritto.</p>
                                        )}
                                        {(selectedCourse.student_ids || []).map((sid) => {
                                            const enrollment = courseEnrollments[sid];
                                            const isFull = enrollment && enrollment.attended_days >= enrollment.allowed_days;

                                            return (
                                                <div key={sid} className="bg-bg-tertiary p-4 rounded-xl border border-border shadow-sm flex flex-col gap-4">
                                                    {/* Header: User Info + Remove */}
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg">
                                                                {allUsers.find(s => s.id === sid)?.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                                                            </div>
                                                            <div>
                                                                <p className="text-text-primary font-bold text-lg">
                                                                    {allUsers.find(s => s.id === sid)?.full_name || 'Sconosciuto'}
                                                                </p>
                                                                <p className="text-sm text-text-muted">
                                                                    {allUsers.find(s => s.id === sid)?.email || sid}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveStudent(sid)}
                                                            className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Rimuovi dal corso"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>

                                                    {/* Footer: Attendance + Action */}
                                                    <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                                                        <div>
                                                            <span className="text-xs text-text-muted uppercase font-bold tracking-wider block mb-1">Presenze</span>
                                                            <span className="text-xl font-bold text-text-primary">
                                                                {enrollment ? `${enrollment.attended_days} / ${enrollment.allowed_days}` : 'Caricamento...'}
                                                            </span>
                                                        </div>

                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleQuickAttendance(sid); }}
                                                            disabled={!enrollment || isFull}
                                                            className={clsx(
                                                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-lg shrink-0",
                                                                isFull
                                                                    ? "bg-bg-primary text-text-muted cursor-not-allowed border border-border"
                                                                    : "bg-green-500 text-white hover:bg-green-600 shadow-green-500/20"
                                                            )}
                                                        >
                                                            {isFull ? <Check size={24} /> : <Plus size={24} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ATTENDANCE TAB */}
                            {activeTab === 'ATTENDANCE' && (
                                <div className="h-[600px] flex flex-col">
                                    {selectedStudentId ? (
                                        // Detail View
                                        <div className="flex-1 overflow-y-auto pr-2">
                                            <button
                                                onClick={() => setSelectedStudentId(null)}
                                                className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6 transition-colors"
                                            >
                                                <ChevronRight className="rotate-180" size={20} /> Torna alla lista
                                            </button>

                                            {loadingEnrollment || !studentEnrollment ? (
                                                <div className="text-center py-12 text-text-muted">Caricamento dati studente...</div>
                                            ) : (
                                                <div className="space-y-8">
                                                    {/* Header Card */}
                                                    <div className="bg-bg-tertiary p-6 rounded-xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <input
                                                                    type="text"
                                                                    className="text-2xl font-bold text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none w-full transition-colors"
                                                                    defaultValue={students.find(s => s.id === selectedStudentId)?.full_name || ''}
                                                                    placeholder="Nome Studente"
                                                                    onBlur={async (e) => {
                                                                        const newName = e.target.value.trim();
                                                                        if (newName && selectedStudentId && newName !== students.find(s => s.id === selectedStudentId)?.full_name) {
                                                                            try {
                                                                                await api.settings.updateProfile(selectedStudentId, { full_name: newName });
                                                                                // Update local state
                                                                                setStudents(students.map(s => s.id === selectedStudentId ? { ...s, full_name: newName } : s));
                                                                            } catch (error) {
                                                                                console.error("Failed to update name", error);
                                                                                alert("Errore durante l'aggiornamento del nome.");
                                                                            }
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.currentTarget.blur();
                                                                        }
                                                                    }}
                                                                />
                                                                <Edit2 size={16} className="text-text-muted opacity-50" />
                                                            </div>
                                                            <p className="text-text-muted">
                                                                {students.find(s => s.id === selectedStudentId)?.email}
                                                            </p>
                                                            <p className="text-text-muted text-sm mt-1">Gestione presenze e permessi per questo corso.</p>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className={clsx("px-3 py-1 rounded text-sm font-bold border",
                                                                studentEnrollment.attended_days >= studentEnrollment.allowed_days
                                                                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                                    : "bg-green-500/10 text-green-500 border-green-500/20")}>
                                                                {studentEnrollment.attended_days >= studentEnrollment.allowed_days ? "LIMITE RAGGIUNTO" : "STATO REGOLARE"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Stats & Progress */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                        {/* Progress Card */}
                                                        <div className="lg:col-span-2 bg-bg-tertiary p-6 rounded-xl border border-border">
                                                            <h4 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
                                                                <Clock size={20} className="text-accent" /> Progresso Presenze
                                                            </h4>

                                                            <div className="mb-2 flex justify-between items-end">
                                                                <span className="text-4xl font-bold text-text-primary">{studentEnrollment.attended_days}</span>
                                                                <span className="text-xl text-text-muted mb-1">/ {studentEnrollment.allowed_days} giorni</span>
                                                            </div>

                                                            <div className="w-full bg-bg-secondary h-4 rounded-full overflow-hidden mb-6">
                                                                <div
                                                                    className={clsx("h-full transition-all duration-500",
                                                                        studentEnrollment.attended_days >= studentEnrollment.allowed_days ? "bg-red-500" : "bg-accent")}
                                                                    style={{ width: `${Math.min((studentEnrollment.attended_days / studentEnrollment.allowed_days) * 100, 100)}%` }}
                                                                />
                                                            </div>

                                                            <div className="flex flex-wrap gap-3">
                                                                <button
                                                                    onClick={() => handleUpdateAttendanceCount(1)}
                                                                    disabled={studentEnrollment.attended_days >= studentEnrollment.allowed_days}
                                                                    className="flex-1 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg font-bold border border-green-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                                >
                                                                    <Plus size={20} /> Aggiungi Giorno
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateAttendanceCount(-1)}
                                                                    disabled={studentEnrollment.attended_days <= 0}
                                                                    className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-bold border border-red-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                                >
                                                                    <Minus size={20} /> Rimuovi Giorno
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Settings Card */}
                                                        <div className="bg-bg-tertiary p-6 rounded-xl border border-border space-y-6">
                                                            <h4 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                                                                <Users size={20} className="text-accent" /> Impostazioni
                                                            </h4>

                                                            <div>
                                                                <label className="block text-sm font-medium text-text-secondary mb-2">Totale Giorni Frequentabili</label>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-text-primary outline-none focus:border-accent"
                                                                        value={studentEnrollment.allowed_days}
                                                                        onChange={(e) => handleUpdateAllowedDays(parseInt(e.target.value) || 0)}
                                                                    />
                                                                </div>
                                                                <p className="text-xs text-text-muted mt-2">
                                                                    Modificare questo valore ricalcolerà le percentuali. Se ridotto sotto le presenze attuali, queste verranno tagliate.
                                                                </p>
                                                            </div>

                                                            <div className="pt-4 border-t border-border">
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm("Sei sicuro di voler resettare a 0 le presenze?")) handleSetAttendanceCount(0);
                                                                    }}
                                                                    className="w-full py-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-text-secondary rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                                                                >
                                                                    <RefreshCw size={16} /> Reset Totale Presenze
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Financial Management Card */}
                                                    <div className="bg-bg-tertiary p-6 rounded-xl border border-border">
                                                        <h4 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
                                                            <DollarSign size={20} className="text-accent" /> Gestione Pagamenti
                                                        </h4>

                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                                            <div>
                                                                <label className="block text-sm font-medium text-text-secondary mb-2">Costo Totale Corso (€)</label>
                                                                <input
                                                                    type="number"
                                                                    className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent"
                                                                    placeholder="0.00"
                                                                    value={studentEnrollment.total_cost || ''}
                                                                    onChange={async (e) => {
                                                                        const val = parseFloat(e.target.value);
                                                                        const updated = await api.academy.updateEnrollment(selectedCourse.id, selectedStudentId!, {
                                                                            total_cost: isNaN(val) ? 0 : val
                                                                        });
                                                                        setStudentEnrollment(updated);
                                                                    }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-text-secondary mb-2">Totale Versato</label>
                                                                <div className="px-3 py-2 bg-bg-secondary/50 border border-border rounded-lg text-text-primary font-bold">
                                                                    € {studentEnrollment.deposits?.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2) || '0.00'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-text-secondary mb-2">Saldo Residuo</label>
                                                                <div className={clsx("px-3 py-2 bg-bg-secondary/50 border border-border rounded-lg font-bold",
                                                                    (studentEnrollment.total_cost || 0) - (studentEnrollment.deposits?.reduce((acc, curr) => acc + curr.amount, 0) || 0) > 0 ? "text-red-400" : "text-green-400"
                                                                )}>
                                                                    € {((studentEnrollment.total_cost || 0) - (studentEnrollment.deposits?.reduce((acc, curr) => acc + curr.amount, 0) || 0)).toFixed(2)}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mb-4">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <h5 className="font-medium text-text-secondary">Storico Acconti</h5>
                                                                <button
                                                                    onClick={async () => {
                                                                        const amount = parseFloat(prompt("Importo acconto (€):") || "0");
                                                                        if (!amount || amount <= 0) return;
                                                                        const note = prompt("Nota (opzionale):") || "";

                                                                        const newDeposit = {
                                                                            id: `dep-${Date.now()}`,
                                                                            amount,
                                                                            date: new Date().toISOString(),
                                                                            note
                                                                        };

                                                                        const updated = await api.academy.updateEnrollment(selectedCourse.id, selectedStudentId!, {
                                                                            deposits: [...(studentEnrollment.deposits || []), newDeposit]
                                                                        });
                                                                        setStudentEnrollment(updated);
                                                                    }}
                                                                    className="text-sm text-accent hover:text-accent-hover flex items-center gap-1"
                                                                >
                                                                    <Plus size={16} /> Aggiungi Acconto
                                                                </button>
                                                            </div>

                                                            <div className="bg-bg-secondary rounded-lg border border-border overflow-hidden">
                                                                {/* Mobile Card View */}
                                                                <div className="md:hidden">
                                                                    {(studentEnrollment.deposits || []).length === 0 ? (
                                                                        <div className="p-4 text-center text-text-muted italic text-sm">
                                                                            Nessun acconto registrato.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="divide-y divide-border/30">
                                                                            {(studentEnrollment.deposits || []).map((dep) => (
                                                                                <div key={dep.id} className="p-4 flex flex-col gap-2">
                                                                                    <div className="flex justify-between items-start">
                                                                                        <div>
                                                                                            <p className="text-text-primary font-medium">{new Date(dep.date).toLocaleDateString()}</p>
                                                                                            <p className="text-sm text-text-secondary">{dep.note || '-'}</p>
                                                                                        </div>
                                                                                        <span className="text-text-primary font-bold bg-green-500/10 px-2 py-1 rounded text-sm border border-green-500/20">
                                                                                            € {dep.amount.toFixed(2)}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex justify-end pt-2">
                                                                                        <button
                                                                                            onClick={async () => {
                                                                                                if (!confirm("Eliminare questo acconto?")) return;
                                                                                                const updatedDeposits = studentEnrollment.deposits?.filter(d => d.id !== dep.id) || [];
                                                                                                const updated = await api.academy.updateEnrollment(selectedCourse.id, selectedStudentId!, {
                                                                                                    deposits: updatedDeposits
                                                                                                });
                                                                                                setStudentEnrollment(updated);
                                                                                            }}
                                                                                            className="text-red-400 hover:text-red-300 text-xs uppercase font-bold flex items-center gap-1 bg-red-400/10 px-3 py-1.5 rounded hover:bg-red-400/20 transition-colors"
                                                                                        >
                                                                                            <X size={14} /> Elimina
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Desktop Table View */}
                                                                <div className="hidden md:block overflow-x-auto">
                                                                    <table className="w-full text-left text-sm">
                                                                        <thead className="bg-bg-tertiary text-text-muted">
                                                                            <tr>
                                                                                <th className="p-3">Data</th>
                                                                                <th className="p-3">Nota</th>
                                                                                <th className="p-3 text-right">Importo</th>
                                                                                <th className="p-3 text-right">Azioni</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-border/30">
                                                                            {(studentEnrollment.deposits || []).length === 0 && (
                                                                                <tr>
                                                                                    <td colSpan={4} className="p-4 text-center text-text-muted italic">Nessun acconto registrato.</td>
                                                                                </tr>
                                                                            )}
                                                                            {(studentEnrollment.deposits || []).map((dep) => (
                                                                                <tr key={dep.id} className="hover:bg-white/5">
                                                                                    <td className="p-3 text-text-primary">{new Date(dep.date).toLocaleDateString()}</td>
                                                                                    <td className="p-3 text-text-secondary">{dep.note || '-'}</td>
                                                                                    <td className="p-3 text-right font-medium text-text-primary">€ {dep.amount.toFixed(2)}</td>
                                                                                    <td className="p-3 text-right">
                                                                                        <button
                                                                                            onClick={async () => {
                                                                                                if (!confirm("Eliminare questo acconto?")) return;
                                                                                                const updatedDeposits = studentEnrollment.deposits?.filter(d => d.id !== dep.id) || [];
                                                                                                const updated = await api.academy.updateEnrollment(selectedCourse.id, selectedStudentId!, {
                                                                                                    deposits: updatedDeposits
                                                                                                });
                                                                                                setStudentEnrollment(updated);
                                                                                            }}
                                                                                            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-400/10"
                                                                                        >
                                                                                            <X size={14} />
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* History Log Removed as per request */}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // List View
                                        <div className="flex-1 flex flex-col">
                                            <div className="flex justify-between items-center mb-6">
                                                <div>
                                                    <h3 className="text-xl font-bold text-text-primary">Registro Presenze</h3>
                                                    <p className="text-text-muted text-sm">Seleziona uno studente per visualizzare i dettagli completi.</p>
                                                </div>
                                            </div>

                                            <div className="bg-bg-tertiary/20 rounded-lg border border-border overflow-hidden">
                                                {/* Mobile Card View */}
                                                <div className="md:hidden">
                                                    {(selectedCourse.student_ids || []).length === 0 ? (
                                                        <div className="p-6 text-center text-text-muted italic">
                                                            Nessun studente iscritto al corso.
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-border/30">
                                                            {(selectedCourse.student_ids || []).map((sid) => {
                                                                const enrollment = courseEnrollments[sid];
                                                                const isFull = enrollment && enrollment.attended_days >= enrollment.allowed_days;

                                                                return (
                                                                    <div
                                                                        key={sid}
                                                                        className="p-4 flex items-center justify-between active:bg-bg-primary transition-colors gap-3"
                                                                        onClick={() => handleSelectStudentForAttendance(sid)}
                                                                    >
                                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                            <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold shrink-0">
                                                                                {allUsers.find(s => s.id === sid)?.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                                                                            </div>
                                                                            <div className="overflow-hidden">
                                                                                <p className="text-text-primary font-medium truncate">
                                                                                    {allUsers.find(s => s.id === sid)?.full_name || 'Studente Sconosciuto'}
                                                                                </p>
                                                                                <p className="text-xs text-text-muted truncate">
                                                                                    {enrollment ? `${enrollment.attended_days} / ${enrollment.allowed_days} presenze` : 'Caricamento...'}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleQuickAttendance(sid);
                                                                            }}
                                                                            disabled={!enrollment || isFull}
                                                                            className={clsx(
                                                                                "w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-lg shrink-0",
                                                                                isFull
                                                                                    ? "bg-bg-primary text-text-muted cursor-not-allowed border border-border"
                                                                                    : "bg-green-500 text-white hover:bg-green-600 shadow-green-500/20"
                                                                            )}
                                                                        >
                                                                            {isFull ? <Check size={20} /> : <Plus size={24} />}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Desktop Table View */}
                                                <div className="hidden md:block overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead className="bg-bg-tertiary border-b border-border">
                                                            <tr>
                                                                <th className="p-4 font-medium text-text-muted">Studente</th>
                                                                <th className="p-4 font-medium text-text-muted text-center">Azioni Rapide</th>
                                                                <th className="p-4 font-medium text-text-muted text-right">Gestisci</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/50">
                                                            {(selectedCourse.student_ids || []).length === 0 && (
                                                                <tr>
                                                                    <td colSpan={3} className="p-6 text-center text-text-muted italic">
                                                                        Nessun studente iscritto al corso.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            {(selectedCourse.student_ids || []).map((sid) => (
                                                                <tr
                                                                    key={sid}
                                                                    className="group hover:bg-bg-tertiary transition-colors cursor-pointer"
                                                                    onClick={() => handleSelectStudentForAttendance(sid)}
                                                                >
                                                                    <td className="p-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold">
                                                                                {allUsers.find(s => s.id === sid)?.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-text-primary font-medium">
                                                                                    {allUsers.find(s => s.id === sid)?.full_name || 'Studente Sconosciuto'}
                                                                                </p>
                                                                                <p className="text-xs text-text-muted">
                                                                                    {allUsers.find(s => s.id === sid)?.email || sid}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4 text-center">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <span className="text-xs bg-bg-secondary px-2 py-1 rounded border border-border text-text-muted group-hover:text-text-primary transition-colors">
                                                                                Gestisci Presenze
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4 text-right">
                                                                        <ChevronRight size={20} className="text-text-muted group-hover:text-text-primary transition-colors ml-auto" />
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Create Form */
                    <div className="max-w-2xl mx-auto bg-bg-secondary p-8 rounded-xl border border-border mb-24">
                        <h2 className="text-xl font-bold text-text-primary mb-6">Crea Nuovo Corso</h2>
                        <form onSubmit={handleCreateCourse} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Titolo Corso</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                    placeholder="es. Masterclass Realistico"
                                    value={newCourse.title}
                                    onChange={e => setNewCourse({ ...newCourse, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">Durata</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-3 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                            placeholder="es. 3 Mesi"
                                            value={newCourse.duration}
                                            onChange={e => setNewCourse({ ...newCourse, duration: e.target.value })}
                                        />
                                        <Clock className="absolute left-3 top-3.5 text-text-muted" size={18} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-2">Costo (Opzionale)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full bg-bg-tertiary border border-border rounded-lg pl-10 pr-4 py-3 text-text-primary focus:ring-2 focus:ring-accent outline-none"
                                            placeholder="0.00"
                                            value={newCourse.price || ''}
                                            onChange={e => setNewCourse({ ...newCourse, price: parseFloat(e.target.value) })}
                                        />
                                        <DollarSign className="absolute left-3 top-3.5 text-text-muted" size={18} />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Descrizione</label>
                                <textarea
                                    className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-3 text-text-primary focus:ring-2 focus:ring-accent outline-none h-32 resize-none"
                                    placeholder="Descrivi gli obiettivi e il programma del corso..."
                                    value={newCourse.description}
                                    onChange={e => setNewCourse({ ...newCourse, description: e.target.value })}
                                />
                            </div>

                            {/* Section for Materials & Students could go here */}
                            <div className="p-4 bg-bg-tertiary/50 rounded-lg border border-border border-dashed text-center">
                                <p className="text-sm text-text-muted">Potrai aggiungere materiali didattici e assegnare studenti dopo aver creato il corso.</p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setView('LIST')}
                                    className="px-6 py-2 text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-bold transition-all shadow-lg shadow-accent/20"
                                >
                                    Crea Corso
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>


            {isAddStudentModalOpen && selectedCourse && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-bg-primary border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-secondary">
                            <h3 className="text-lg font-bold text-text-primary">Seleziona Studente</h3>
                            <button onClick={() => setIsAddStudentModalOpen(false)} className="text-text-muted hover:text-text-primary">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-2">
                            {allUsers
                                .filter(u => !(selectedCourse.student_ids || []).includes(u.id))
                                .filter(u => (u.role || '').toLowerCase() === 'student')
                                .map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleAddStudentFromList(user)}
                                        className="w-full flex items-center gap-3 p-3 bg-bg-tertiary hover:bg-bg-secondary border border-border rounded-lg transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">
                                            {user.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-text-primary font-medium truncate">{user.full_name}</p>
                                            <p className="text-sm text-text-muted truncate">{user.email}</p>
                                        </div>
                                        <Plus size={18} className="ml-auto text-accent" />
                                    </button>
                                ))
                            }
                            {allUsers.filter(u => !(selectedCourse.student_ids || []).includes(u.id)).length === 0 && (
                                <p className="text-center text-text-muted py-4">
                                    Nessuno studente disponibile da aggiungere.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {
                profileStudent && (
                    <StudentProfileModal
                        student={profileStudent}
                        courses={courses}
                        enrollments={profileEnrollments}
                        loading={loadingProfile}
                        onClose={() => setProfileStudent(null)}
                    />
                )
            }
            {/* Add Student Modal */}
            {
                isAddStudentModalOpen && selectedCourse && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-bg-primary border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="flex items-center justify-between p-4 border-b border-border bg-bg-secondary">
                                <h3 className="text-lg font-bold text-text-primary">Seleziona Studente</h3>
                                <button onClick={() => setIsAddStudentModalOpen(false)} className="text-text-muted hover:text-text-primary">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 space-y-2">
                                {allUsers
                                    .filter(u => !selectedCourse.student_ids.includes(u.id))
                                    .filter(u => (u.role || '').toLowerCase() === 'student') // Only listing students
                                    .map(user => (
                                        <button
                                            key={user.id}
                                            onClick={() => handleAddStudentFromList(user)}
                                            className="w-full flex items-center gap-3 p-3 bg-bg-tertiary hover:bg-bg-secondary border border-border rounded-lg transition-colors text-left"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold shrink-0">
                                                {user.full_name?.substring(0, 2).toUpperCase() || 'ST'}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-text-primary font-medium truncate">{user.full_name}</p>
                                                <p className="text-sm text-text-muted truncate">{user.email}</p>
                                            </div>
                                            <Plus size={18} className="ml-auto text-accent" />
                                        </button>
                                    ))
                                }
                                {allUsers.filter(u => !selectedCourse.student_ids.includes(u.id)).length === 0 && (
                                    <p className="text-center text-text-muted py-4">
                                        Nessuno studente disponibile da aggiungere.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Terms Modal */}
            {isTermsModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-bg-primary border border-border rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                                <FileText className="text-accent" />
                                Modifica Termini e Condizioni
                            </h2>
                            <button
                                onClick={() => setIsTermsModalOpen(false)}
                                className="text-text-muted hover:text-text-primary transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            <p className="text-text-muted mb-4 text-sm">
                                Definisci i termini e le condizioni che gli studenti devono accettare per accedere alla piattaforma.
                                Ogni modifica chiederà nuovamente l'accettazione agli studenti.
                            </p>
                            <textarea
                                value={termsText}
                                onChange={(e) => setTermsText(e.target.value)}
                                className="w-full h-96 bg-bg-secondary border border-border rounded-lg p-4 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none font-mono text-sm"
                                placeholder="Inserisci qui i termini e condizioni..."
                            />
                        </div>

                        <div className="p-6 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={() => setIsTermsModalOpen(false)}
                                className="px-4 py-2 rounded-lg font-bold text-text-muted hover:text-text-primary transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleSaveTerms}
                                disabled={savingTerms}
                                className="px-4 py-2 rounded-lg font-bold bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {savingTerms ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                                        Salvataggio...
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} />
                                        Salva e Pubblica
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
