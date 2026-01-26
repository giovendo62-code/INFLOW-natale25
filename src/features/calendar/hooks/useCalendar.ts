import { useState, useEffect, useRef, useMemo } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import type { Appointment } from '../../../services/types';
import { useAuth } from '../../auth/AuthContext';
import { useRealtime } from '../../../hooks/useRealtime';

export type CalendarView = 'year' | 'month' | 'week' | 'day';

export const useCalendar = () => {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalendarView>('month');
    const [selectedArtistId, setSelectedArtistId] = useState<string | null>('all');
    const defaultSetRef = useRef(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (user && !defaultSetRef.current) {
            const role = (user.role || '').toUpperCase();
            if (role === 'ARTIST') {
                setView('day');
            }
            defaultSetRef.current = true;
        }
    }, [user]);

    // Calculate Date Range
    const { start, end } = useMemo(() => {
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
        return { start, end };
    }, [currentDate, view]);

    const artistFilter = useMemo(() => {
        if (user?.role === 'ARTIST') return user.id;
        return selectedArtistId === 'all' ? undefined : selectedArtistId;
    }, [user, selectedArtistId]);

    const { data: appointments = [], isLoading, refetch } = useQuery<Appointment[]>({
        queryKey: ['appointments', user?.studio_id, start.toISOString(), end.toISOString(), artistFilter],
        queryFn: () => api.appointments.list(start, end, artistFilter || undefined, user?.studio_id),
        enabled: !!user?.studio_id,
        staleTime: 1000 * 60 * 5, // 5 minutes
        placeholderData: (previousData) => previousData // Keep previous data while fetching new range
    });

    // Realtime Subscription
    useRealtime('appointments', () => {
        console.log('[useCalendar] Realtime update detected. Invalidating query...');
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
    });

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
        refresh: refetch,
        selectedArtistId,
        setSelectedArtistId
    };
};
