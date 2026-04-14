/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface TelemetryEvent {
    id: string;
    type: 'critical' | 'watch' | 'due' | 'suggested' | 'system_error';
    message: string;
    timestamp: number;
    actionLabel?: string;
    onAction?: () => void;
    metadata?: any;
}

interface TelemetryQueueContextType {
    events: TelemetryEvent[];
    pushEvent: (event: Omit<TelemetryEvent, 'id' | 'timestamp'>) => void;
    clearEvent: (id: string) => void;
    clearAll: () => void;
}

const TelemetryQueueContext = createContext<TelemetryQueueContextType | undefined>(undefined);

export const TelemetryQueueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [events, setEvents] = useState<TelemetryEvent[]>(() => {
        const saved = localStorage.getItem('iotank_telemetry_queue');
        return saved ? JSON.parse(saved) : [];
    });

    React.useEffect(() => {
        localStorage.setItem('iotank_telemetry_queue', JSON.stringify(events));
    }, [events]);

    const pushEvent = useCallback((event: Omit<TelemetryEvent, 'id' | 'timestamp'>) => {
        const newEvent: TelemetryEvent = {
            ...event,
            id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        };
        setEvents(prev => [newEvent, ...prev].slice(0, 50)); // Keep last 50
    }, []);

    const clearEvent = useCallback((id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setEvents([]);
    }, []);

    return (
        <TelemetryQueueContext.Provider value={{ events, pushEvent, clearEvent, clearAll }}>
            {children}
        </TelemetryQueueContext.Provider>
    );
};

export const useTelemetryQueue = () => {
    const context = useContext(TelemetryQueueContext);
    if (context === undefined) {
        throw new Error('useTelemetryQueue must be used within a TelemetryQueueProvider');
    }
    return context;
};
