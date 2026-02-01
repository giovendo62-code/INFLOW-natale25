
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../features/auth/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Course } from '../services/types';
import { BookOpen, Check } from 'lucide-react';

export const CheckInPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState<Course[]>([]);
    const [_selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
    const [checkInStatus, setCheckInStatus] = useState<{ [courseId: string]: boolean }>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        loadData();
    }, [user]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Get my courses (filtered by studio/student logic in API or manually)
            // api.academy.listCourses returns courses for the studio.
            // We need to filter where student_ids includes me.
            const allCourses = await api.academy.listCourses(user?.studio_id);
            const myCourses = allCourses.filter(c => c.student_ids?.includes(user!.id));

            setCourses(myCourses);

            if (myCourses.length === 0) {
                setError("Non risulti iscritto a nessun corso abilitato al check-in.");
            } else if (myCourses.length === 1) {
                setSelectedCourseId(myCourses[0].id);
            }

            // 2. Check today's status for these courses
            const statusMap: { [key: string]: boolean } = {};
            const today = new Date().toISOString().split('T')[0];

            await Promise.all(myCourses.map(async (course) => {
                const { data } = await supabase
                    .from('academy_daily_attendance')
                    .select('id')
                    .eq('course_id', course.id)
                    .eq('student_id', user!.id)
                    .eq('date', today)
                    .maybeSingle();
                statusMap[course.id] = !!data;
            }));

            setCheckInStatus(statusMap);

        } catch (err: any) {
            console.error('Error loading check-in data:', err);
            setError("Impossibile caricare i corsi. Riprova più tardi.");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (courseId: string) => {
        setLoading(true);
        try {
            const result = await api.academy.performCheckIn(courseId, user!.id);
            if (result.success) {
                setCheckInStatus(prev => ({ ...prev, [courseId]: true }));
                // alert(result.message);
            } else {
                alert(result.message);
            }
        } catch (err: any) {
            console.error('Check-in error:', err);
            alert("Errore durante il check-in: " + (err.message || "Errore sconosciuto"));
        } finally {
            setLoading(false);
        }
    };

    if (loading && courses.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                    <p className="text-gray-500 animate-pulse font-medium">Caricamento corsi...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 text-center border-b border-gray-100 bg-gray-50/50">
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">Check-in Academy</h1>
                    <p className="text-sm text-gray-500 capitalize">
                        {format(new Date(), 'EEEE d MMMM yyyy', { locale: it })}
                    </p>
                </div>

                <div className="p-6">
                    {error ? (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center border border-red-100 mb-4">
                            <p className="font-bold mb-1">Attenzione</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {courses.map(course => {
                                const isDone = checkInStatus[course.id];
                                return (
                                    <div
                                        key={course.id}
                                        className={`relative border-2 rounded-xl p-5 transition-all ${isDone
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-white border-blue-100 hover:border-blue-300 shadow-sm hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${isDone ? 'bg-green-200 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
                                                    <BookOpen size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{course.title}</h3>
                                                    <p className="text-xs text-gray-500">{course.duration}</p>
                                                </div>
                                            </div>
                                            {isDone && (
                                                <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                    <Check size={12} /> FATTO
                                                </div>
                                            )}
                                        </div>

                                        {isDone ? (
                                            <div className="text-center py-2 text-green-700 text-sm font-medium">
                                                Presenza registrata per oggi.
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleCheckIn(course.id)}
                                                disabled={loading}
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                {loading ? (
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    "Registra Presenza"
                                                )}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-8 text-center">
                        <p className="text-xs text-gray-400">
                            Scansione valida per: {user?.full_name || user?.email}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
