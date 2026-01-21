import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Calendar, TrendingUp,
    Clock, CheckCircle, ChevronRight,
    DollarSign, FileText, PlayCircle, BookOpen,
    Share2, Eye, EyeOff, X, UserCheck
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { StatsCard } from './components/StatsCard';
import { api } from '../../services/api';
import { useRealtime } from '../../hooks/useRealtime';
import type {
    Appointment,
    ArtistContract,
    Studio,
    Course,
    CourseEnrollment
} from '../../services/types';
import { format, parseISO, startOfDay, addWeeks, endOfWeek, isSameWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { useLayoutStore } from '../../stores/layoutStore';
import clsx from 'clsx';
import { AppointmentDrawer } from '../calendar/components/AppointmentDrawer'; // Import Drawer
import { Image as ImageIcon } from 'lucide-react'; // Import Icon

interface DashboardStats {
    revenue_today: number;
    revenue_month: number;
    waitlist_count: number;
    staff_present: number;
    staff_total: number;
}

export const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { isPrivacyMode, togglePrivacyMode } = useLayoutStore();

    // -- State Definitions --
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        revenue_today: 0,
        revenue_month: 0,
        waitlist_count: 0,
        staff_present: 0,
        staff_total: 0
    });

    // Artist/Owner State
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [contract, setContract] = useState<ArtistContract | null>(null);
    const [studio, setStudio] = useState<Studio | null>(null);

    // Student State
    const [studentCourse, setStudentCourse] = useState<Course | null>(null);
    const [studentEnrollment, setStudentEnrollment] = useState<CourseEnrollment | null>(null);

    // UI State
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [isTermsViewOpen, setIsTermsViewOpen] = useState(false);
    const [viewTermsContent, setViewTermsContent] = useState('');
    const [viewAllAppointments, setViewAllAppointments] = useState(false);

    // Appointment Drawer State
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const handleApptClick = (appt: Appointment) => {
        setSelectedAppointment(appt);
        setIsDrawerOpen(true);
    };

    const handleSaveAppointment = async (data: Partial<Appointment>) => {
        try {
            if (selectedAppointment) {
                await api.appointments.update(selectedAppointment.id, data);
            } else {
                await api.appointments.create(data as Omit<Appointment, 'id' | 'created_at' | 'updated_at'>);
            }
            setIsDrawerOpen(false);
            loadDashboardData(); // Refresh list
        } catch (error) {
            console.error('Error saving appointment:', error);
            alert('Errore durante il salvataggio.');
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        if (!window.confirm('Sei sicuro di voler eliminare questo appuntamento?')) return;
        try {
            await api.appointments.delete(id);
            setIsDrawerOpen(false);
            loadDashboardData(); // Refresh list
        } catch (error) {
            console.error('Error deleting appointment:', error);
            alert('Errore durante l\'eliminazione.');
        }
    };

    if (!user) return <div className="p-8 text-center text-white">Caricamento utente...</div>;

    // -- Data Loading Logic --
    const loadDashboardData = useCallback(async () => {
        try {
            // 1. Student Data
            if (user.role === 'STUDENT' || user.role === 'student') {
                const courses = await api.academy.listCourses();
                const enrolledCourse = courses.find(c => c.student_ids.includes(user.id));

                if (enrolledCourse) {
                    setStudentCourse(enrolledCourse);
                    const enroll = await api.academy.getEnrollment(enrolledCourse.id, user.id);
                    setStudentEnrollment(enroll);
                }
            }

            // 2. Studio Data & Terms
            if (user.studio_id) {
                const s = await api.settings.getStudio(user.studio_id);
                setStudio(s);
                if (s && (user.role === 'STUDENT' || user.role === 'student') && s.academy_terms) {
                    setViewTermsContent(s.academy_terms);
                }
            }

            // 3. Appointments & Contract
            const today = startOfDay(new Date());
            const endNextWeek = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });

            const isArtist = user.role === 'ARTIST' || user.role === 'artist';
            if (isArtist) {
                const c = await api.artists.getContract(user.id);
                setContract(c);
            }

            const artistIdFilter = (isArtist && !viewAllAppointments) ? user.id : undefined;
            const appts = await api.appointments.list(today, endNextWeek, artistIdFilter, user.studio_id);

            const enhancedAppts = await Promise.all(appts.map(async (appt) => {
                if (appt.client) return appt;
                const client = await api.clients.getById(appt.client_id);
                return { ...appt, client: client || undefined };
            }));

            enhancedAppts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            setAppointments(enhancedAppts);

            // 4. Stats (Owner/Manager)
            if (user.role === 'owner' || user.role === 'STUDIO_ADMIN' || user.role === 'MANAGER') {
                const fStats = await api.financials.getStats(new Date(), user.studio_id);

                let wCount = 0;
                if (user.studio_id) {
                    const wList = await api.waitlist.list(user.studio_id);
                    wCount = wList.filter(w => w.status === 'PENDING').length;
                }

                let sPresent = 0;
                let sTotal = 0;
                if (user.studio_id) {
                    const team = await api.settings.listTeamMembers(user.studio_id);
                    sTotal = team.length;
                    sPresent = team.length; // Mock
                }

                setStats({
                    revenue_today: fStats.revenue_today,
                    revenue_month: fStats.revenue_month,
                    waitlist_count: wCount,
                    staff_present: sPresent,
                    staff_total: sTotal
                });
            }

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [user.id, user.role, user.studio_id, viewAllAppointments]);

    // -- Effects --
    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    // -- Realtime Hooks --
    useRealtime('appointments', () => {
        console.log('Realtime: refreshing appointments');
        loadDashboardData();
    });

    useRealtime('waitlist_entries', () => {
        if (user.role === 'owner' || user.role === 'MANAGER') {
            loadDashboardData();
        }
    });

    useRealtime('transactions', () => {
        if (user.role === 'owner' || user.role === 'MANAGER') {
            loadDashboardData();
        }
    });


    // -- Helper Functions --
    const sendWhatsAppReminder = (appt: Appointment, type: 'WEEK_NOTICE' | 'CONFIRMATION') => {
        if (!appt.client?.phone) {
            alert('Numero di telefono non disponibile per questo cliente.');
            return;
        }

        const dateStr = format(parseISO(appt.start_time), "d MMMM", { locale: it });
        const timeStr = format(parseISO(appt.start_time), "HH:mm");
        const studioName = studio?.name || "InkFlow Studio";
        const location = studio ? `${studio.address}, ${studio.city}` : "Via Loreto Balatelle, 208, Acireale";

        let message = '';
        if (type === 'WEEK_NOTICE') {
            message = `Ciao ${appt.client.full_name}, \nti ricordiamo il tuo appuntamento per il ${dateStr} ${timeStr} presso ${studioName} (${location}).\nTi invitiamo a rispondere a questo messaggio per confermare, altrimenti il tuo appuntamento potrebbe subire variazioni o cancellazioni.\nA presto!`;
        } else {
            message = `Ciao ${appt.client.full_name}, \nti ricordiamo il tuo appuntamento per il ${dateStr} ${timeStr} presso ${studioName} (${location}).\nTi invitiamo a rispondere a questo messaggio per confermare, altrimenti il tuo appuntamento potrebbe subire variazioni o cancellazioni.\nA presto!`;
        }

        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/${appt.client.phone.replace(/[^0-9]/g, '')}?text=${encodedMessage}`, '_blank');
    };

    // -- Render Helpers --
    const renderAdminWidgets = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
                title="Incasso Oggi"
                value={isPrivacyMode ? '••••' : `€${stats.revenue_today.toLocaleString()}`}
                change={isPrivacyMode ? undefined : "0%"}
                isPositive={true}
                icon={DollarSign}
                color="bg-green-500"
            />
            <StatsCard
                title="Appuntamenti Validi"
                value={appointments.length.toString()}
                change="0"
                isPositive={true}
                icon={Calendar}
                color="bg-blue-500"
            />
            <StatsCard
                title="Richieste in Attesa"
                value={stats.waitlist_count.toString()}
                icon={Users}
                color="bg-orange-500"
            />
            <StatsCard
                title="Staff Presente"
                value={`${stats.staff_present}/${stats.staff_total}`}
                icon={UserCheck}
                color="bg-purple-500"
            />
        </div>
    );

    const renderArtistWidgets = () => {
        const commissionRate = contract?.commission_rate || 50;
        const netEarnings = isPrivacyMode ? '••••' : `€${((4200 * commissionRate) / 100).toLocaleString()}`; // TODO: Real calc

        const myApptsCount = appointments.length;
        const now = new Date();
        const nextAppt = appointments.find(a => new Date(a.start_time) > now);
        let nextApptText = 'Nessuno';

        if (nextAppt) {
            const diffMs = new Date(nextAppt.start_time).getTime() - now.getTime();
            const diffMins = Math.round(diffMs / 60000);
            if (diffMins < 60) nextApptText = `tra ${diffMins}m`;
            else {
                const diffHours = Math.floor(diffMins / 60);
                nextApptText = `tra ${diffHours}h`;
            }
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatsCard
                    title="I Miei Appuntamenti"
                    value={myApptsCount.toString()}
                    icon={Calendar}
                    color="bg-accent"
                />
                {contract?.rent_type === 'PRESENCES' && (
                    <StatsCard
                        title="Presenze Rimanenti"
                        value={isPrivacyMode ? '••••' : `${(contract.presence_package_limit || 0) - contract.used_presences}/${contract.presence_package_limit}`}
                        icon={Users}
                        color={(contract.presence_package_limit || 0) - contract.used_presences <= 2 ? "bg-red-500" : "bg-green-500"}
                    />
                )}
                <StatsCard
                    title="Prossimo Cliente"
                    value={nextApptText}
                    icon={Clock}
                    color="bg-blue-500"
                />
                <StatsCard
                    title="I Tuoi Guadagni (Netto)"
                    value={netEarnings}
                    change={isPrivacyMode ? undefined : "8%"}
                    isPositive={true}
                    icon={TrendingUp}
                    color="bg-green-500"
                />
            </div>
        );
    };

    const renderStudentWidgets = () => {
        if (!studentCourse) return (
            <div className="col-span-full text-center py-12 bg-bg-secondary rounded-lg border border-border text-text-muted">
                Non sei iscritto a nessun corso al momento.
            </div>
        );

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 col-span-full">
                <div className="bg-bg-secondary p-6 rounded-xl border border-border flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-text-primary">Il Tuo Corso</h3>
                                <p className="text-sm text-text-muted">{studentCourse.title}</p>
                            </div>
                        </div>
                        <p className="text-text-secondary text-sm line-clamp-2 mb-4">
                            {studentCourse.description}
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-text-muted pt-4 border-t border-border">
                        <span className="flex items-center gap-1"><Clock size={14} /> {studentCourse.duration}</span>
                        <span className="flex items-center gap-1"><FileText size={14} /> {studentCourse.materials?.length || 0} Moduli</span>
                    </div>
                </div>

                <div className="bg-bg-secondary p-6 rounded-xl border border-border">
                    <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                        <UserCheck size={20} className="text-green-400" /> Le Tue Presenze
                    </h3>

                    {studentEnrollment ? (
                        <>
                            <div className="mb-2 flex justify-between items-end">
                                <span className="text-3xl font-bold text-text-primary">{studentEnrollment.attended_days}</span>
                                <span className="text-sm text-text-muted mb-1">su {studentEnrollment.allowed_days} giorni totali</span>
                            </div>
                            <div className="w-full bg-bg-tertiary h-3 rounded-full overflow-hidden mb-4">
                                <div
                                    className={clsx("h-full transition-all duration-500",
                                        studentEnrollment.attended_days >= studentEnrollment.allowed_days ? "bg-red-500" : "bg-green-500")}
                                    style={{ width: `${Math.min((studentEnrollment.attended_days / studentEnrollment.allowed_days) * 100, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-text-muted text-center">
                                {studentEnrollment.attended_days >= studentEnrollment.allowed_days
                                    ? "Hai completato i giorni previsti!"
                                    : "Continua così!"}
                            </p>
                        </>
                    ) : (
                        <p className="text-text-muted italic">Dati presenze non disponibili.</p>
                    )}

                    <div className="mt-4 pt-4 border-t border-border flex justify-center">
                        <button
                            onClick={() => setIsTermsViewOpen(true)}
                            className="text-xs text-text-muted hover:text-text-primary underline flex items-center gap-1 transition-colors"
                        >
                            <FileText size={12} />
                            Vedi Termini e Condizioni Accettati
                        </button>
                    </div>
                </div>

                <div className="bg-bg-secondary p-6 rounded-xl border border-border flex flex-col justify-between">
                    <h3 className="text-lg font-bold text-text-primary mb-4">Materiale Didattico</h3>
                    <div className="space-y-3 mb-4 flex-1 overflow-y-auto max-h-[300px]">
                        {(studentCourse.materials || []).map((mat, i) => (
                            <div
                                key={i}
                                onClick={() => {
                                    if (mat.url && mat.url !== '#') window.open(mat.url, '_blank');
                                    else alert('Link non disponibile per questo materiale');
                                }}
                                className="flex items-center gap-3 p-3 rounded bg-bg-tertiary/30 hover:bg-bg-tertiary transition-colors cursor-pointer group border border-transparent hover:border-border"
                            >
                                <div className="text-accent group-hover:text-text-primary transition-colors p-2 bg-white/5 rounded-lg">
                                    {mat.type === 'VIDEO' ? <PlayCircle size={18} /> : <FileText size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-secondary group-hover:text-text-primary truncate transition-colors">{mat.title}</p>
                                    <p className="text-xs text-text-muted">{mat.type}</p>
                                </div>
                                <ChevronRight size={16} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                        {(studentCourse.materials || []).length === 0 && (
                            <div className="text-center py-8 text-text-muted italic flex flex-col items-center gap-2">
                                <BookOpen size={24} className="opacity-20" />
                                <p>Nessun materiale disponibile per il tuo corso.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div >
        );
    };

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden p-4 md:p-8 pt-20 md:pt-8 text-text-primary">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2 truncate">
                            {studio?.name || 'InkFlow CRM'}
                        </h1>
                        <p className="text-text-muted text-sm md:text-base">
                            Bentornato, <span className="text-text-primary font-medium">{user.full_name || user.email?.split('@')[0] || 'User'}</span>
                        </p>
                    </div>
                    <div className="flex gap-2 md:hidden">
                        <button
                            onClick={() => setIsShareOpen(true)}
                            className="p-2 bg-bg-secondary border border-border rounded-full text-text-muted hover:text-text-primary transition-colors"
                            title="Condividi App"
                        >
                            <Share2 size={20} />
                        </button>
                        <button
                            onClick={togglePrivacyMode}
                            className="p-2 bg-bg-secondary border border-border rounded-full text-text-muted hover:text-text-primary transition-colors"
                            title={isPrivacyMode ? 'Mostra Valori' : 'Nascondi Valori'}
                        >
                            {isPrivacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </header>

                {(user.role === 'owner' || user.role === 'STUDIO_ADMIN' || user.role === 'MANAGER') && renderAdminWidgets()}
                {user.role === 'ARTIST' && renderArtistWidgets()}
                {(user.role === 'STUDENT' || user.role === 'student') && renderStudentWidgets()}

                {user.role !== 'STUDENT' && user.role !== 'student' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-20">
                        <div className="lg:col-span-2 bg-bg-secondary border border-border rounded-lg p-6 min-h-[300px]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-text-primary">
                                    {user.role === 'ARTIST' ? 'Programma di Oggi' : 'Appuntamenti Recenti'}
                                </h3>
                                {(user.role === 'ARTIST' || user.role === 'artist') && (
                                    <button
                                        onClick={() => setViewAllAppointments(!viewAllAppointments)}
                                        className={clsx(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                                            viewAllAppointments
                                                ? "bg-accent text-white border-accent"
                                                : "bg-bg-primary text-text-muted hover:text-text-primary border-border"
                                        )}
                                    >
                                        <Users size={14} />
                                        <span>{viewAllAppointments ? 'Vedi Solo I Miei' : 'Vedi Tutti'}</span>
                                    </button>
                                )}
                            </div>

                            {loading ? (
                                <div className="flex justify-center items-center h-48 text-text-muted">
                                    Caricamento...
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Current Week */}
                                    <div>
                                        <h4 className="text-[10px] font-semibold text-text-muted mb-3 uppercase tracking-wider">Questa Settimana</h4>
                                        {appointments.filter(appt => isSameWeek(parseISO(appt.start_time), new Date(), { weekStartsOn: 1 })).length > 0 ? (
                                            <div className="space-y-3">
                                                {appointments
                                                    .filter(appt => isSameWeek(parseISO(appt.start_time), new Date(), { weekStartsOn: 1 }))
                                                    .map((appt) => (
                                                        <div
                                                            key={appt.id}
                                                            onClick={() => handleApptClick(appt)}
                                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-bg-primary rounded-lg border border-border/50 hover:border-accent/50 transition-colors gap-4 cursor-pointer active:scale-[0.99]"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className="h-10 w-10 shrink-0 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                                                                    <Calendar size={18} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-medium text-text-primary text-sm truncate flex items-center gap-2">
                                                                        {format(parseISO(appt.start_time), 'EEEE d MMMM', { locale: it })} - {format(parseISO(appt.start_time), 'HH:mm')}
                                                                    </p>
                                                                    <div className="flex items-center gap-1 text-xs text-text-muted truncate mt-1">
                                                                        <span>{appt.client?.full_name} • {appt.service_name}</span>
                                                                    </div>
                                                                </div>
                                                                {appt.images && appt.images.length > 0 && (
                                                                    <div className="shrink-0 relative self-center ml-2" onClick={(e) => { e.stopPropagation(); window.open(appt.images![0], '_blank'); }}>
                                                                        <img
                                                                            src={appt.images[0]}
                                                                            alt="Anteprima"
                                                                            className="w-14 h-14 rounded-lg object-cover border border-border shadow-sm bg-bg-secondary hover:scale-105 transition-transform"
                                                                        />
                                                                        {appt.images.length > 1 && (
                                                                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[8px] text-white border border-bg-primary shadow-sm z-10">
                                                                                +{appt.images.length - 1}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                                                                {user.role !== 'ARTIST' && user.role !== 'artist' && (
                                                                    <button
                                                                        onClick={() => sendWhatsAppReminder(appt, 'CONFIRMATION')}
                                                                        className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                                                                        title="Richiedi Conferma"
                                                                    >
                                                                        <CheckCircle size={18} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-text-muted italic">Nessun appuntamento.</p>
                                        )}
                                    </div>

                                    {/* Next Week */}
                                    <div>
                                        <h4 className="text-[10px] font-semibold text-text-muted mb-3 uppercase tracking-wider">Prossima Settimana</h4>
                                        {appointments.filter(appt => !isSameWeek(parseISO(appt.start_time), new Date(), { weekStartsOn: 1 })).length > 0 ? (
                                            <div className="space-y-3">
                                                {appointments
                                                    .filter(appt => !isSameWeek(parseISO(appt.start_time), new Date(), { weekStartsOn: 1 }))
                                                    .map((appt) => (
                                                        <div
                                                            key={appt.id}
                                                            onClick={() => handleApptClick(appt)}
                                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-bg-primary rounded-lg border border-border/50 hover:border-accent/50 transition-colors gap-4 cursor-pointer active:scale-[0.99]"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className="h-10 w-10 shrink-0 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                                                    <Calendar size={18} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-medium text-text-primary text-sm truncate flex items-center gap-2">
                                                                        {format(parseISO(appt.start_time), 'EEEE d MMMM', { locale: it })} - {format(parseISO(appt.start_time), 'HH:mm')}
                                                                    </p>
                                                                    <div className="flex items-center gap-1 text-xs text-text-muted truncate mt-1">
                                                                        <span>{appt.client?.full_name} • {appt.service_name}</span>
                                                                    </div>
                                                                </div>
                                                                {appt.images && appt.images.length > 0 && (
                                                                    <div className="shrink-0 relative self-center ml-2" onClick={(e) => { e.stopPropagation(); window.open(appt.images![0], '_blank'); }}>
                                                                        <img
                                                                            src={appt.images[0]}
                                                                            alt="Anteprima"
                                                                            className="w-14 h-14 rounded-lg object-cover border border-border shadow-sm bg-bg-secondary hover:scale-105 transition-transform"
                                                                        />
                                                                        {appt.images.length > 1 && (
                                                                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[8px] text-white border border-bg-primary shadow-sm z-10">
                                                                                +{appt.images.length - 1}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                                                                {user.role !== 'ARTIST' && user.role !== 'artist' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => sendWhatsAppReminder(appt, 'WEEK_NOTICE')}
                                                                            className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                                            title="Promemoria 1 Settimana"
                                                                        >
                                                                            <Clock size={18} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => sendWhatsAppReminder(appt, 'CONFIRMATION')}
                                                                            className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                                                                            title="Richiedi Conferma"
                                                                        >
                                                                            <CheckCircle size={18} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-text-muted italic">Nessun appuntamento.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div className="bg-bg-secondary border border-border rounded-lg p-6">
                                <h3 className="text-lg font-bold text-text-primary mb-4">Azioni Rapide</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => navigate('/calendar')}
                                        className="w-full py-3 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors text-sm"
                                    >
                                        + Nuovo Appuntamento
                                    </button>
                                    <button
                                        onClick={() => navigate('/communications')}
                                        className="w-full py-3 px-4 bg-bg-tertiary hover:bg-white/10 text-text-primary rounded-lg font-medium transition-colors border border-border text-sm"
                                    >
                                        Controlla Messaggi
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Share App QR Modal */}
            {isShareOpen && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center relative shadow-2xl transform transition-all scale-100">
                        <button
                            onClick={() => setIsShareOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2"
                        >
                            <X size={24} />
                        </button>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Condividi InkFlow</h2>
                        <p className="text-gray-500 mb-6">Fai scansionare questo codice per accedere all'applicazione</p>

                        <div className="bg-gray-100 p-4 rounded-xl inline-block mb-6">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}`}
                                alt="App QR Code"
                                className="w-64 h-64 mix-blend-multiply"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-gray-400 break-all bg-gray-50 p-2 rounded">{window.location.origin}</p>
                            <button
                                onClick={() => setIsShareOpen(false)}
                                className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-colors"
                            >
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Read-Only Terms Modal */}
            {isTermsViewOpen && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-bg-primary border border-border rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                                <FileText className="text-accent" />
                                Termini e Condizioni
                            </h2>
                            <button
                                onClick={() => setIsTermsViewOpen(false)}
                                className="text-text-muted hover:text-text-primary transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto bg-bg-tertiary/30">
                            <div className="prose prose-invert max-w-none text-text-secondary text-sm whitespace-pre-wrap font-mono bg-bg-primary p-4 rounded-lg border border-border">
                                {viewTermsContent || "Nessun termine disponibile."}
                            </div>
                        </div>

                        <div className="p-6 border-t border-border flex justify-end">
                            <button
                                onClick={() => setIsTermsViewOpen(false)}
                                className="px-4 py-2 rounded-lg font-bold bg-bg-tertiary text-text-primary hover:bg-white/10 border border-border transition-colors"
                            >
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Appointment Drawer */}
            <AppointmentDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                selectedDate={null}
                selectedAppointment={selectedAppointment}
                onSave={handleSaveAppointment}
                onDelete={handleDeleteAppointment}
            />
        </div>
    );
};

export default Dashboard;
