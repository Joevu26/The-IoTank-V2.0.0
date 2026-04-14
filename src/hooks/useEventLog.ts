import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type EventCategory = 'telemetry' | 'operational' | 'system' | 'ai';
export type EventSeverity = 'info' | 'warning' | 'critical';
export type EventIntegrity = 'verified' | 'system_generated' | 'manual_override';
export type EventTriggeredBy = 'system' | 'user' | 'ai';
export type EventSource = 'ESP32' | 'Manual' | 'AI' | 'System';

export interface EventLogEntry {
    id: string;
    category: EventCategory;
    type: string;            // Maps to audit_logs.action
    title: string;
    description: string;
    tankId?: string;
    tankName?: string;
    timestamp: number;       // epoch ms
    triggeredBy: EventTriggeredBy;
    triggeredByName: string;
    severity: EventSeverity;
    integrity: EventIntegrity;
    // Expandable detail
    beforeValue?: string;
    afterValue?: string;
    delta?: string;
    nodeId?: string;
    source?: EventSource;
    rawPayload?: Record<string, unknown>;
}

export interface EventLogFilters {
    timeRange: '24h' | '7d' | '30d' | 'custom';
    customStart?: number;
    customEnd?: number;
    category: EventCategory | 'all';
    tankId: string;          // '' = all
    severity: EventSeverity | 'all';
    triggeredBy: EventTriggeredBy | 'all';
    search: string;
}

const DEFAULT_FILTERS: EventLogFilters = {
    timeRange: '7d',
    category: 'all',
    tankId: '',
    severity: 'all',
    triggeredBy: 'all',
    search: '',
};

export const PAGE_SIZE = 25;

export function useEventLog(stationId: string) {
    const [events, setEvents] = useState<EventLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<EventLogFilters>(DEFAULT_FILTERS);
    const [currentPage, setCurrentPage] = useState(1);
    const [tanks, setTanks] = useState<{id: string, name: string}[]>([]);

    useEffect(() => {
        fetchTanks();
    }, [stationId]);

    useEffect(() => {
        fetchEvents();
    }, [stationId, filters, currentPage]);

    const fetchTanks = async () => {
        const { data } = await supabase.from('tanks').select('id, tank_name').eq('station_id', stationId);
        if (data) setTanks(data.map(t => ({ id: t.id, name: t.tank_name })));
    };

    const fetchEvents = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('unified_events')
                .select('*', { count: 'exact' })
                .eq('station_id', stationId)
                .order('created_at', { ascending: false });

            // Apply time filters
            const now = new Date();
            if (filters.timeRange !== 'custom') {
                const ms = filters.timeRange === '24h' ? 86400000 : filters.timeRange === '7d' ? 604800000 : 2592000000;
                query = query.gte('created_at', new Date(now.getTime() - ms).toISOString());
            }

            // Apply Category filter
            if (filters.category !== 'all') {
                query = query.eq('event_category', filters.category.toUpperCase());
            }

            if (filters.severity !== 'all') {
                query = query.eq('severity', filters.severity.toUpperCase());
            }

            if (filters.search) {
                query = query.or(`event_type.ilike.%${filters.search}%,description.ilike.%${filters.search}%,actor_email.ilike.%${filters.search}%`);
            }

            const { data, count, error } = await query
                .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

            if (error) throw error;

            const mapped: EventLogEntry[] = (data || []).map(log => ({
                id: log.id,
                category: log.event_category.toLowerCase() as EventCategory,
                type: log.event_type,
                title: log.event_type.replace(/_/g, ' '),
                description: log.description,
                timestamp: new Date(log.created_at).getTime(),
                triggeredBy: (log.metadata?.actor_name || '').toLowerCase().includes('system') ? 'system' : 'user',
                triggeredByName: log.metadata?.actor_name || log.actor_email || 'System',
                severity: (log.severity || 'info').toLowerCase() as EventSeverity,
                integrity: 'verified',
                beforeValue: log.metadata?.before ? JSON.stringify(log.metadata.before, null, 2) : undefined,
                afterValue: log.metadata?.after ? JSON.stringify(log.metadata.after, null, 2) : undefined,
                rawPayload: log.metadata || {}
            }));

            setEvents(mapped);
            setTotal(count || 0);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
        } finally {
            setLoading(false);
        }
    };

    function updateFilter<K extends keyof EventLogFilters>(key: K, value: EventLogFilters[K]) {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    }

    function resetFilters() {
        setFilters(DEFAULT_FILTERS);
        setCurrentPage(1);
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    function exportCSV() {
        const headers = ['EventID', 'Type', 'Severity', 'Description', 'Timestamp', 'TriggeredBy', 'Before', 'After'];
        const rows = events.map(ev => [
            ev.id,
            ev.type,
            ev.severity,
            `"${ev.description}"`,
            new Date(ev.timestamp).toISOString(),
            ev.triggeredByName,
            `"${ev.beforeValue || ''}"`,
            `"${ev.afterValue || ''}"`
        ].join(','));

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `event-log-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return {
        events,
        total,
        totalPages,
        currentPage,
        setCurrentPage,
        loading,
        filters,
        updateFilter,
        resetFilters,
        categoryCounts: { telemetry: 0, operational: total, system: 0, ai: 0 }, // Simplified
        tanks,
        exportCSV,
    };
}
