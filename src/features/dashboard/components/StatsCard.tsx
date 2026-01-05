import React from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string | number;
    change?: string;
    isPositive?: boolean;
    icon: LucideIcon;
    color?: string; // Hex or tailwind class for icon bg
}

export const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    change,
    isPositive,
    icon: Icon,
    color = 'bg-accent'
}) => {
    return (
        <div className="bg-bg-secondary p-6 rounded-lg border border-border hover:border-border-hover transition-all duration-200 shadow-sm group">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-text-muted text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-text-primary">{value}</h3>
                </div>
                <div className={clsx("p-3 rounded-lg bg-opacity-10 text-white", color)}>
                    <Icon size={24} className="opacity-90" />
                </div>
            </div>

            {change && (
                <div className="flex items-center gap-2 text-xs">
                    <span className={clsx(
                        "font-medium",
                        isPositive ? "text-green-500" : "text-red-500"
                    )}>
                        {isPositive ? '+' : ''}{change}
                    </span>
                    <span className="text-text-muted">from last month</span>
                </div>
            )}
        </div>
    );
};
