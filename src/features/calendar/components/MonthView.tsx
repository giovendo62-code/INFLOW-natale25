import React from 'react';
import {
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
    isSameMonth,
    isSameDay
} from 'date-fns';
import clsx from 'clsx';
import type { Appointment, User } from '../../../services/types';

interface MonthViewProps {
    currentDate: Date;
    appointments: Appointment[];
    artists: User[];
    onDateClick: (date: Date) => void;
    onAppointmentClick: (apt: Appointment) => void;
}

const WEEKDAYS_SHORT = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const WEEKDAYS_LONG = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];


export const MonthView: React.FC<MonthViewProps> = ({
    currentDate,
    appointments,
    artists,
    onDateClick,
    onAppointmentClick
}) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const getAppointmentsForDay = (date: Date) => {
        return appointments.filter(apt => isSameDay(new Date(apt.start_time), date));
    };

    return (
        <div className="flex-1 flex flex-col bg-bg-secondary rounded-lg border border-border overflow-hidden">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-border bg-bg-tertiary">
                {WEEKDAYS_LONG.map((day, idx) => (
                    <div key={idx} className="py-2 text-center font-medium text-text-muted">
                        <span className="hidden md:inline text-sm">{day}</span>
                        <span className="md:hidden text-[10px]">{WEEKDAYS_SHORT[idx]}</span>
                    </div>
                ))}
            </div>


            {/* Calendar Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 overflow-hidden">
                {days.map((day) => {
                    const dayApts = getAppointmentsForDay(day);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div
                            key={day.toString()}
                            onClick={() => onDateClick(day)}
                            className={clsx(
                                "p-1 md:p-2 border-b border-r border-border cursor-pointer transition-colors hover:bg-white/5 overflow-hidden flex flex-col",
                                !isCurrentMonth && "bg-bg-primary/30 text-text-muted",
                                isToday && "bg-accent/5"
                            )}
                        >
                            <div className="flex items-center justify-between mb-0.5 md:mb-1">
                                <span className={clsx(
                                    "text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full",
                                    isToday ? "bg-accent text-white" : "text-text-secondary"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {dayApts.length > 0 && (
                                    <span className="text-[10px] text-text-muted hidden md:inline">{dayApts.length} apts</span>
                                )}
                            </div>

                            <div className="space-y-1 flex-1 overflow-y-auto scrollbar-hide">
                                {dayApts.map(apt => {
                                    const artist = artists.find(a => a.id === apt.artist_id);
                                    const color = artist?.calendar_color;

                                    return (
                                        <div
                                            key={apt.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAppointmentClick(apt);
                                            }}
                                            className={clsx(
                                                "text-xs px-2 py-1 rounded truncate border-l-2 mb-1 transition-opacity hover:opacity-80",
                                                !color && (
                                                    apt.status === 'CONFIRMED' ? "bg-green-500/10 border-green-500 text-green-200" :
                                                        apt.status === 'PENDING' ? "bg-orange-500/10 border-orange-500 text-orange-200" :
                                                            "bg-gray-700/50 border-gray-500 text-gray-300"
                                                )
                                            )}
                                            style={color ? {
                                                backgroundColor: `${color}33`, // ~20% opacity
                                                borderColor: color,
                                                color: '#fff' // White text usually readable on dark with colored bg, or maybe color? Let's try white text with colored bg/border. 
                                                // Wait, previous design was text-colored. Let's try to match.
                                                // "bg-[color]/10 text-[color]"
                                            } : undefined}
                                        >
                                            <span style={color ? { color: color } : undefined}>
                                                {format(new Date(apt.start_time), 'HH:mm')} {apt.service_name}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
