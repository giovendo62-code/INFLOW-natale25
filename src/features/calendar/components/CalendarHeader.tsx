import React from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Users, Filter, Download } from 'lucide-react';
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
    const handleDownload = () => {
        alert('Simulazione Download Report Finanziario / Calendario...');
    };

    const handleQuickFilter = () => {
        alert('Filtri avanzati disponibili nella versione completa.');
    };

    return (
        <div className="flex flex-col gap-4 mb-6">
            {/* Top Row: Date and Navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                    <h2 className="text-xl md:text-2xl font-bold text-white capitalize truncate">
                        {format(currentDate, 'MMMM yyyy', { locale: it })}
                    </h2>
                    <div className="flex items-center bg-bg-secondary rounded-lg border border-border p-1">
                        <button onClick={onPrev} className="p-1.5 hover:text-accent transition-colors"><ChevronLeft size={18} /></button>
                        <button onClick={onToday} className="px-3 text-sm font-medium hover:text-accent transition-colors">Oggi</button>
                        <button onClick={onNext} className="p-1.5 hover:text-accent transition-colors"><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto min-w-0">
                    <button
                        onClick={handleQuickFilter}
                        className="flex items-center justify-center gap-2 bg-bg-secondary hover:bg-white/10 text-text-muted hover:text-white px-2 sm:px-3 py-2 rounded-lg border border-border transition-colors text-xs sm:text-sm min-w-0"
                        title="Filtri avanzati"
                    >
                        <Filter size={14} className="sm:size-4 shrink-0" />
                        <span className="truncate">Filtra</span>
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex items-center justify-center gap-2 bg-bg-secondary hover:bg-white/10 text-text-muted hover:text-white px-2 sm:px-3 py-2 rounded-lg border border-border transition-colors text-xs sm:text-sm min-w-0"
                        title="Scarica Report Finanze"
                    >
                        <Download size={14} className="sm:size-4 shrink-0" />
                        <span className="truncate">Finanze</span>
                    </button>
                </div>

                {/* Sync Button (Owner only) - Top Row */}
                {userRole?.toLowerCase() === 'owner' && onSync && (
                    <button
                        onClick={onSync}
                        className="flex items-center justify-center gap-2 bg-bg-secondary hover:bg-white/10 text-text-muted hover:text-white px-2 sm:px-3 py-2 rounded-lg border border-border transition-colors text-xs sm:text-sm min-w-0"
                        title="Sincronizza Google Calendar"
                    >
                        <img src="https://www.google.com/favicon.ico" alt="Google" className="size-3 sm:size-4 shrink-0" />
                        <span className="truncate hidden sm:inline">Sync</span>
                    </button>
                )}
            </div>


            {/* Bottom Row: Controls */}
            <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
                {/* Artist Filter */}
                <div className="flex items-center bg-bg-secondary rounded-lg border border-border px-3 py-2 w-full lg:flex-1">
                    <Users size={16} className="text-text-muted mr-3" />
                    <select
                        className="bg-transparent text-white text-sm outline-none w-full"
                        value={selectedArtistId || 'all'}
                        onChange={(e) => onArtistChange(e.target.value === 'all' ? null : e.target.value)}
                    >
                        <option value="all" className="bg-bg-secondary text-white">Tutti gli Artisti</option>
                        {artists.map(artist => (
                            <option key={artist.id} value={artist.id} className="bg-bg-secondary text-white">
                                {artist.full_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* View Switch */}
                <div className="flex bg-bg-secondary rounded-lg border border-border p-1 w-full lg:w-auto">
                    {(['year', 'month', 'week', 'day'] as CalendarView[]).map((v) => (
                        <button
                            key={v}
                            onClick={() => onViewChange(v)}
                            className={clsx(
                                "px-3 md:px-5 py-2 rounded-md text-xs md:text-sm font-medium capitalize transition-all flex-1 text-center",
                                view === v ? "bg-accent text-white shadow-md" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            {v === 'year' && 'Anno'}
                            {v === 'month' && 'Mese'}
                            {v === 'week' && 'Sett.'}
                            {v === 'day' && 'Giorno'}
                        </button>
                    ))}
                </div>

                <button
                    onClick={onNewAppointment}
                    className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-lg transition-colors font-bold whitespace-nowrap w-full lg:w-auto shadow-lg shadow-accent/20"
                >
                    <CalIcon size={18} />
                    <span>Nuovo</span>
                </button>
            </div>
        </div>
    );
};
