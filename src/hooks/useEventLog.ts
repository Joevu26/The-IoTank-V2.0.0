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

export function useEventLog(orgId: string) {
    const [events, setEvents] = useState<EventLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<EventLogFilters>(DEFAULT_FILTERS);
    const [currentPage, setCurrentPage] = useState(1);
    const [tanks, setTanks] = useState<{id: string, name: string}[]>([]);

    useEffect(() => {
        fetchTanks();
    }, [orgId]);

    useEffect(() => {
        fetchEvents();
    }, [orgId, filters, currentPage]);

    const fetchTanks = async () => {
        const { data } = await supabase.from('tanks').select('id, tank_name').eq('station_id', orgId);
        if (data) setTanks(data.map(t => ({ id: t.id, name: t.tank_name })));
    };

    const fetchEvents = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('audit_logs')
                .select('*', { count: 'exact' })
                .eq('station_id', orgId)
                .order('created_at', { ascending: false });

            // Apply time filters
            const now = new Date();
            if (filters.timeRange !== 'custom') {
                const ms = filters.timeRange === '24h' ? 86400000 : filters.timeRange === '7d' ? 604800000 : 2592000000;
                query = query.gte('created_at', new Date(now.getTime() - ms).toISOString());
            }

            // Apply Category (Map action types to categories)
            if (filters.category !== 'all') {
                // This logic depends on how actions are categorized. For now we use the type if it matches.
            }

            if (filters.severity !== 'all') {
                query = query.eq('severity', filters.severity);
            }

            if (filters.search) {
                query = query.or(`action.ilike.%${filters.search}%,details.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%`);
            }

            const { data, count, error } = await query
                .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

            if (error) throw error;

            const mapped: EventLogEntry[] = (data || []).map(log => ({
                id: log.id,
                category: 'operational', // Default for now
                type: log.action,
                title: log.action.replace(/_/g, ' '),
                description: log.details,
                timestamp: new Date(log.created_at).getTime(),
                triggeredBy: 'user', // Audit logs are usually user or system
                triggeredByName: log.user_name || 'System',
                severity: log.severity as EventSeverity,
                integrity: 'verified',
                beforeValue: log.before_values ? JSON.stringify(log.before_values, null, 2) : undefined,
                afterValue: log.after_values ? JSON.stringify(log.after_values, null, 2) : undefined,
                rawPayload: log.changes_made || {}
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
