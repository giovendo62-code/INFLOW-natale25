import React from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Users, ArrowLeft } from 'lucide-react';
import type { CalendarView } from '../hooks/useCalendar';
import type { User } from '../../../services/types';
import clsx from 'clsx';

interface CalendarHeaderProps {
    currentDate: Date;
    view: CalendarView;
    onViewChange: (view: CalendarView) => void;
    onNext: () => void;
    onPrev: () => void;
    onToday: () => void;
    artists: User[];
    selectedArtistId: string | null;
    onArtistChange: (artistId: string | null) => void;
    onNewAppointment?: () => void;
    onSync?: () => void;
    userRole?: string;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
    currentDate,
    view,
    onViewChange,
    onNext,
    onPrev,
    onToday,
    artists,
    selectedArtistId,
    onArtistChange,
    onNewAppointment,
    onSync,
    userRole
}) => {
    return (
        <div className="flex flex-col gap-3 mb-4">
            {/* Top Row: Date, Nav, and Primary Actions (Mobile optimized) */}
            <div className="flex flex-wrap items-center justify-between gap-2">

                {/* Left: Title & Nav */}
                <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                    {(view === 'day' || view === 'week') && (
                        <button
                            onClick={() => onViewChange('month')}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                            title="Torna al Mese"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    {(view === 'month') && (
                        <button
                            onClick={() => onViewChange('year')}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                            title="Torna all'Anno"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h2 className="text-lg md:text-2xl font-bold text-white capitalize truncate whitespace-nowrap">
                        {format(currentDate, 'MMMM yyyy', { locale: it })}
                    </h2>
                    <div className="flex items-center bg-bg-secondary rounded-lg border border-border p-0.5 shrink-0">
                        <button onClick={onPrev} className="p-1 hover:text-accent transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={onToday} className="px-2 text-xs font-medium hover:text-accent transition-colors">Oggi</button>
                        <button onClick={onNext} className="p-1 hover:text-accent transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>

                {/* Right: Actions (Synced, New) */}
                <div className="flex items-center gap-2">
                    {/* Artist Filter (Condensed) */}
                    <div className="relative flex items-center justify-center bg-bg-secondary rounded-lg border border-border w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-2">
                        <Users size={16} className="text-text-muted md:mr-2" />
                        <select
                            className="absolute inset-0 opacity-0 md:static md:opacity-100 bg-transparent text-white text-sm outline-none w-full appearance-none cursor-pointer"
                            value={selectedArtistId || 'all'}
                            title="Filtra per artista"
                            onChange={(e) => onArtistChange(e.target.value === 'all' ? null : e.target.value)}
                        >
                            <option value="all" className="bg-bg-secondary text-white">Tutti</option>
                            {artists.map(artist => (
                                <option key={artist.id} value={artist.id} className="bg-bg-secondary text-white">
                                    {artist.full_name}
                                </option>
                            ))}
                        </select>
                        {/* Mobile Indicator if filtered */}
                        {selectedArtistId && <div className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full md:hidden"></div>}
                    </div>

                    {/* Sync Button (Owner only) */}
                    {userRole?.toLowerCase() === 'owner' && onSync && (
                        <button
                            onClick={onSync}
                            className="flex items-center justify-center bg-white text-black hover:bg-gray-100 w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-2 rounded-lg transition-all shadow-sm"
                            title="Google Calendar"
                        >
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="size-4 md:mr-2" />
                            <span className="hidden md:inline font-medium text-sm">Sync</span>
                        </button>
                    )}

                    <button
                        onClick={onNewAppointment}
                        className="flex items-center justify-center bg-accent hover:bg-accent-hover text-white w-8 h-8 md:w-auto md:h-auto md:px-4 md:py-2 rounded-lg transition-colors shadow-lg shadow-accent/20"
                        title="Nuovo Appuntamento"
                    >
                        <CalIcon size={16} className="md:mr-2" />
                        <span className="hidden md:inline font-bold">Nuovo</span>
                    </button>
                </div>
            </div>

            {/* Bottom Row: View Switch (Full Width) */}
            <div className="flex bg-bg-secondary rounded-lg border border-border p-0.5 w-full">
                {(['year', 'month', 'week', 'day'] as CalendarView[]).map((v) => (
                    <button
                        key={v}
                        onClick={() => onViewChange(v)}
                        className={clsx(
                            "py-1.5 rounded-md text-xs font-medium capitalize transition-all flex-1 text-center",
                            view === v ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                        )}
                    >
                        {v === 'year' && 'Anno'}
                        {v === 'month' && 'Mese'}
                        {v === 'week' && 'Sett.'}
                        {v === 'day' && 'Giorno'}
                    </button>
                ))}
            </div>
        </div>
    );
};
