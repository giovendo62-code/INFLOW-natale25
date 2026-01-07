import React, { useEffect, useState } from 'react';
import { useCalendar } from './hooks/useCalendar';
import { CalendarHeader } from './components/CalendarHeader';
import { MonthView } from './components/MonthView';
import { AppointmentDrawer } from './components/AppointmentDrawer';
import { GoogleCalendarDrawer } from './components/GoogleCalendarDrawer';
import { ReviewRequestModal } from '../../components/ReviewRequestModal';
import type { Appointment, User } from '../../services/types';
import { api } from '../../services/api';
import { useAuth } from '../auth/AuthContext';
import { useLayoutStore } from '../../stores/layoutStore';

import { Maximize2, Minimize2, ChevronRight } from 'lucide-react';
import { format, startOfWeek, addDays, startOfYear, addMonths, isSameDay, isSameMonth, differenceInMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import clsx from 'clsx';

export const Calendar: React.FC = () => {
    const { user } = useAuth();
    // Global layout store handles sidebar visibility and mobile fullscreen
    const { toggleSidebar, isMobileFullscreen, toggleMobileFullscreen } = useLayoutStore();

    const {
        currentDate,
        view,
        setView,
        appointments,
        next,
        prev,
        today,
        selectedArtistId,
        setSelectedArtistId,
        refresh,
        goToDate
    } = useCalendar();

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isGoogleDrawerOpen, setIsGoogleDrawerOpen] = useState(false);

    // Review Modal State
    const [reviewModalData, setReviewModalData] = useState<{ isOpen: boolean; clientName: string; clientPhone?: string }>({ isOpen: false, clientName: '' });

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [artists, setArtists] = useState<User[]>([]);

    useEffect(() => {
        const fetchArtists = async () => {
            if (user?.studio_id) {
                const members = await api.settings.listTeamMembers(user.studio_id);
                setArtists(members.filter(m => m.role === 'ARTIST' || m.role === 'artist'));
            }
        };
        fetchArtists();
    }, [user?.studio_id]);

    const handleDateClick = (date: Date) => {
        goToDate(date);
        setView('day');
    };

    const handleAppointmentClick = (apt: Appointment) => {
        setSelectedAppointment(apt);
        setSelectedDate(new Date(apt.start_time));
        setIsDrawerOpen(true);
    };

    const handleSave = async (data: Partial<Appointment>) => {
        try {
            if (selectedAppointment) {
                // Update
                if (!selectedAppointment.id) return;
                await api.appointments.update(selectedAppointment.id, data);

                // Check for completion to trigger Review Request
                if (data.status === 'COMPLETED' && selectedAppointment.status !== 'COMPLETED') {
                    const clientName = selectedAppointment.client?.full_name || 'Cliente';
                    const clientPhone = selectedAppointment.client?.phone;
                    setReviewModalData({ isOpen: true, clientName, clientPhone });
                }
            } else {
                // Create
                await api.appointments.create(data as Appointment);
            }
            await refresh(); // Refresh calendar data
            setIsDrawerOpen(false);
            setSelectedAppointment(null);
            setSelectedDate(null);
        } catch (error) {
            console.error('Failed to save appointment:', error);
            alert('Errore durante il salvataggio dell\'appuntamento');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.appointments.delete(id);
            await refresh();
            setIsDrawerOpen(false);
            setSelectedAppointment(null);
            setSelectedDate(null);
        } catch (error) {
            console.error('Failed to delete appointment:', error);
            alert('Errore durante l\'eliminazione dell\'appuntamento');
        }
    };

    const toggleFullscreen = () => {
        // Toggle both for broad compatibility, but focused on mobile experience
        toggleMobileFullscreen();
        if (window.innerWidth >= 768) {
            toggleSidebar();
        }
    };



    const WeekView = () => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

        return (
            <div className="flex-1 bg-bg-secondary border border-border rounded-lg overflow-y-auto overflow-x-hidden p-4">
                <div className="space-y-4">
                    {weekDays.map((day) => {
                        const dayApts = appointments.filter(a => isSameDay(new Date(a.start_time), day)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div key={day.toString()} className={clsx("p-4 rounded-lg border border-border", isToday ? "bg-accent/5 border-accent/20" : "bg-bg-tertiary")}>
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className={clsx("font-bold capitalize", isToday ? "text-accent" : "text-white")}>{format(day, 'EEEE d MMMM', { locale: it })}</h4>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedDate(day);
                                            setIsDrawerOpen(true);
                                        }}
                                        className="text-xs bg-bg-primary hover:bg-white/10 text-text-muted hover:text-white px-2 py-1 rounded border border-border transition-colors"
                                    >
                                        + Aggiungi
                                    </button>
                                </div>

                                {dayApts.length > 0 ? (
                                    <div className="space-y-2">
                                        {dayApts.map(apt => {
                                            const artist = artists.find(a => a.id === apt.artist_id);
                                            const color = artist?.calendar_color || '#eab308'; // Default accent (yellow-500 equivalent)
                                            return (
                                                <div
                                                    key={apt.id}
                                                    onClick={() => handleAppointmentClick(apt)}
                                                    className="flex items-center gap-3 p-2 rounded border border-border border-l-4 cursor-pointer hover:brightness-110 transition-all"
                                                    style={{
                                                        borderLeftColor: color,
                                                        backgroundColor: `${color}15`
                                                    }}
                                                >
                                                    <div className="text-xs font-bold w-12 text-center" style={{ color: color }}>{format(new Date(apt.start_time), 'HH:mm')}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-white truncate">{apt.client?.full_name || 'Cliente Occasionale'}</div>
                                                        <div className="text-xs text-text-muted truncate">
                                                            {artist ? (
                                                                <span className="opacity-75 mr-1" style={{ color: color }}>[{artist.full_name.split(' ')[0]}]</span>
                                                            ) : null}
                                                            {apt.service_name}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-text-muted italic py-2">Nessun appuntamento</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const DayView = () => {
        const dayApts = appointments.filter(a => isSameDay(new Date(a.start_time), currentDate)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        return (
            <div className="flex-1 bg-bg-secondary border border-border rounded-lg overflow-y-auto p-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            <button onClick={prev} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <ChevronRight className="rotate-180" size={24} />
                            </button>
                            <h3 className="text-xl font-bold text-white capitalize">{format(currentDate, 'EEEE d MMMM yyyy', { locale: it })}</h3>
                            <button onClick={next} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <ChevronRight size={24} />
                            </button>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedDate(currentDate);
                                setIsDrawerOpen(true);
                            }}
                            className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            + Nuovo Appuntamento
                        </button>
                    </div>

                    <div className="space-y-3">
                        {dayApts.length > 0 ? (
                            dayApts.map(apt => {
                                const duration = differenceInMinutes(new Date(apt.end_time), new Date(apt.start_time));
                                const artist = artists.find(a => a.id === apt.artist_id);
                                const color = artist?.calendar_color || '#eab308';

                                return (
                                    <div
                                        key={apt.id}
                                        onClick={() => handleAppointmentClick(apt)}
                                        className="flex gap-4 p-4 rounded-xl border-l-4 hover:brightness-110 transition-all cursor-pointer group"
                                        style={{
                                            borderLeftColor: color,
                                            backgroundColor: `${color}15` // 15% opacity background
                                        }}
                                    >
                                        <div className="flex flex-col items-center justify-center min-w-[60px] border-r border-border/50 pr-4">
                                            <span className="text-lg font-bold" style={{ color: color }}>{format(new Date(apt.start_time), 'HH:mm')}</span>
                                            <span className="text-xs text-text-muted">-</span>
                                            <span className="text-lg font-bold text-white">{format(new Date(apt.end_time), 'HH:mm')}</span>
                                            <span className="text-xs text-text-muted mt-1">{duration} min</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-white text-lg">{apt.client?.full_name || 'Cliente'}</h4>
                                                {artist && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: color, borderColor: color, backgroundColor: `${color}20` }}>
                                                        {artist.full_name}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm mb-1" style={{ color: color }}>{apt.service_name}</p>
                                            <p className="text-text-muted text-sm line-clamp-2">{apt.notes || 'Nessuna nota'}</p>
                                        </div>
                                        <div className="self-center flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: color }}>
                                            <span className="text-sm font-medium">Apri</span>
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-20">
                                <p className="text-text-muted text-lg">Nessun appuntamento per oggi</p>
                                <button onClick={() => { setSelectedDate(currentDate); setIsDrawerOpen(true); }} className="mt-4 text-accent hover:underline">Aggiungine uno ora</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const YearView = () => (
        <div className="flex-1 bg-bg-secondary border border-border rounded-lg overflow-y-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => {
                    const monthStart = addMonths(startOfYear(currentDate), i);
                    const isCurrentMonth = isSameMonth(monthStart, new Date());

                    return (
                        <div key={i}
                            onClick={() => {
                                goToDate(monthStart);
                                setView('month');
                            }}
                            className={clsx(
                                "bg-bg-tertiary p-4 rounded-lg border transition-colors cursor-pointer relative",
                                isCurrentMonth ? "border-accent" : "border-border hover:border-text-muted"
                            )}
                        >
                            <h4 className={clsx("font-bold mb-4 capitalize text-center", isCurrentMonth ? "text-accent" : "text-white")}>
                                {format(monthStart, 'MMMM', { locale: it })}
                            </h4>
                            {/* Mini Grid Placeholder - purely visual for now */}
                            <div className="grid grid-cols-7 gap-1 text-[8px] text-center opacity-50">
                                {Array.from({ length: 35 }).map((_, idx) => (
                                    <div key={idx} className={clsx("aspect-square rounded-sm", idx % 7 === 0 || idx % 7 === 6 ? "bg-red-500/20" : "bg-white/10")}></div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className={clsx(
            "flex flex-col relative transition-all duration-300 h-full overflow-hidden",
            isMobileFullscreen
                ? "fixed inset-0 z-[100] bg-bg-primary p-2 pt-safe pb-safe"
                : "p-4 pt-20 md:pt-8"
        )}>
            <div className="flex justify-end mb-2">
                <button
                    onClick={toggleFullscreen}
                    className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm"
                >
                    {isMobileFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    {isMobileFullscreen ? 'Riduci' : 'Schermo Intero'}
                </button>
            </div>

            <CalendarHeader
                currentDate={currentDate}
                view={view}
                onViewChange={setView}
                onNext={next}
                onPrev={prev}
                onToday={today}
                artists={artists}
                selectedArtistId={selectedArtistId}
                onArtistChange={setSelectedArtistId}
                onNewAppointment={() => {
                    setSelectedDate(new Date());
                    setSelectedAppointment(null);
                    setIsDrawerOpen(true);
                }}
                onSync={() => setIsGoogleDrawerOpen(true)}
                userRole={user?.role}
            />



            {view === 'month' && (
                <MonthView
                    currentDate={currentDate}
                    appointments={appointments}
                    artists={artists}
                    onDateClick={handleDateClick}
                    onAppointmentClick={handleAppointmentClick}
                />
            )}
            {view === 'week' && <WeekView />}
            {view === 'day' && <DayView />}
            {view === 'year' && <YearView />}

            <AppointmentDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                selectedDate={selectedDate}
                selectedAppointment={selectedAppointment}
                onSave={handleSave}
                onDelete={selectedAppointment ? handleDelete : undefined}
            />

            <GoogleCalendarDrawer
                isOpen={isGoogleDrawerOpen}
                onClose={() => setIsGoogleDrawerOpen(false)}
                artists={artists}
            />

            <ReviewRequestModal
                isOpen={reviewModalData.isOpen}
                onClose={() => setReviewModalData({ ...reviewModalData, isOpen: false })}
                clientName={reviewModalData.clientName}
                clientPhone={reviewModalData.clientPhone}
            />
        </div>
    );
};
