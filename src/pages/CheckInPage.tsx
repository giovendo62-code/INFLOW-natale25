import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface AttendanceRecord {
    id: string;
    checkin_time: string;
    checkin_date: string;
}

export const CheckInPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [hasCheckedIn, setHasCheckedIn] = useState(false);
    const [recentCheckins, setRecentCheckins] = useState<AttendanceRecord[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        fetchAttendance();
    }, [user]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            // Check for today's check-in
            const today = new Date().toISOString().split('T')[0];
            const { data: todayCheckin, error: todayError } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', user!.id)
                .eq('checkin_date', today)
                .maybeSingle();

            if (todayError) throw todayError;
            setHasCheckedIn(!!todayCheckin);

            // Fetch recent check-ins
            const { data: recent, error: recentError } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', user!.id)
                .order('checkin_time', { ascending: false })
                .limit(5);

            if (recentError) throw recentError;
            setRecentCheckins(recent || []);
        } catch (err: any) {
            console.error('Error fetching attendance:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        setLoading(true);
        setError(null);
        try {
            await api.attendance.checkIn(user!.id);
            await fetchAttendance();
            // Refetch to see if it immediately shows up or we just rely on fetchAttendance
            // (fetchAttendance might need a small delay or just works if DB is fast)
            // But we also need to set hasCheckedIn to true manually if we want instant feedback?
            // fetchAttendance does it.
        } catch (err: any) {
            console.error('Error checking in:', err);
            // Check message for "Presenza già registrata"
            if (err.message === 'Presenza già registrata oggi') {
                setHasCheckedIn(true);
            }
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !hasCheckedIn && recentCheckins.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                    <p className="text-gray-500 animate-pulse font-medium">Caricamento...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 text-center border-b border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Check-in Presenze</h1>
                    <p className="text-sm text-gray-500">
                        {format(new Date(), 'EEEE d MMMM yyyy', { locale: it })}
                    </p>
                </div>

                <div className="p-8 flex flex-col items-center">
                    {error && (
                        <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center border border-red-100">
                            {error}
                        </div>
                    )}

                    {hasCheckedIn ? (
                        <div className="text-center animate-fade-in">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-green-700">Presenza registrata</h2>
                            <p className="text-gray-500 mt-2">Hai già effettuato il check-in per oggi.</p>
                        </div>
                    ) : (
                        <button
                            onClick={handleCheckIn}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    Registrazione...
                                </>
                            ) : (
                                'Segna Presenza'
                            )}
                        </button>
                    )}
                </div>

                <div className="mt-8 pt-4 border-t border-gray-100 w-full flex justify-center">
                    <button
                        onClick={async () => {
                            await supabase.rpc('debug_reset_attendance_today');
                            window.location.reload();
                        }}
                        className="text-xs text-gray-300 hover:text-red-400 underline transition-colors"
                    >
                        [DEBUG] Reset Presenza Oggi
                    </button>
                </div>

                {recentCheckins.length > 0 && (
                    <div className="bg-gray-50 p-6 border-t border-gray-100">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Ultime Presenze</h3>
                        <div className="space-y-3">
                            {recentCheckins.map((record) => (
                                <div key={record.id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                    <span className="text-gray-900 font-medium">
                                        {format(new Date(record.checkin_date), 'd MMM yyyy', { locale: it })}
                                    </span>
                                    <span className="text-gray-500 font-mono">
                                        {format(new Date(record.checkin_time), 'HH:mm', { locale: it })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
