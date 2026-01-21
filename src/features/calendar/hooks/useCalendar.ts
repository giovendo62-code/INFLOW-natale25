import { useState, useEffect, useRef } from 'react';
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    startOfDay,
    endOfDay,
    startOfYear,
    endOfYear,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    addYears,
    subYears,
} from 'date-fns';
import { api } from '../../../services/api';
import type { Appointment } from '../../../services/types';
import { useAuth } from '../../auth/AuthContext';
import { useRealtime } from '../../../hooks/useRealtime';

export type CalendarView = 'year' | 'month' | 'week' | 'day';

export const useCalendar = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalendarView>('month');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedArtistId, setSelectedArtistId] = useState<string | null>('all');
    const defaultSetRef = useRef(false);

    useEffect(() => {
        if (user && !defaultSetRef.current) {
            const role = (user.role || '').toUpperCase();
            if (role === 'ARTIST') {
                setView('day');
            }
            defaultSetRef.current = true;
        }
    }, [user]);

    useEffect(() => {
        fetchAppointments();
    }, [currentDate, view, selectedArtistId]);

    // Realtime Subscription
    useRealtime('appointments', () => {
        console.log('[useCalendar] Realtime update detected. Refreshing appointments...');
        fetchAppointments();
    });

    const fetchAppointments = async () => {
        setIsLoading(true);
        let start: Date, end: Date;

        if (view === 'year') {
            start = startOfYear(currentDate);
            end = endOfYear(currentDate);
        } else if (view === 'month') {
            start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
            end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
        } else if (view === 'week') {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = endOfWeek(currentDate, { weekStartsOn: 1 });
        } else {
            start = startOfDay(currentDate);
            end = endOfDay(currentDate);
        }

        try {
            // Logic: 
            // - If user is ARTIST => can only see own (override filter) OR see all if allowed? 
            //   Usually artists only see theirs. Let's assume strict RBAC for now.
            // - If user is ADMIN/MANAGER => can see all or filter by specific artist.

            let artistFilter = selectedArtistId === 'all' ? undefined : selectedArtistId;

            if (user?.role === 'ARTIST') {
                artistFilter = user.id;
            }

            const data = await api.appointments.list(start, end, artistFilter || undefined, user?.studio_id);
            setAppointments(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const next = () => {
        if (view === 'year') setCurrentDate(addYears(currentDate, 1));
        else if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
        else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
        else setCurrentDate(addDays(currentDate, 1));
    };

    const prev = () => {
        if (view === 'year') setCurrentDate(subYears(currentDate, 1));
        else if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
        else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
        else setCurrentDate(subDays(currentDate, 1));
    };

    const today = () => setCurrentDate(new Date());

    const goToDate = (date: Date) => setCurrentDate(date);

    return {
        currentDate,
        view,
        setView,
        appointments,
        isLoading,
        next,
        prev,
        today,
        goToDate,
        refresh: fetchAppointments,
        selectedArtistId,
        setSelectedArtistId
    };
};
