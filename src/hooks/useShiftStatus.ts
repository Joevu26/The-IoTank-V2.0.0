import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import { useAuth } from './useAuth';

export type ShiftStatus = 'OPEN' | 'CLOSED';

export const useShiftStatus = () => {
    const { currentUser } = useAuth();
    const stationId = currentUser?.stationId;

    const [status, setStatus] = useState<ShiftStatus>('CLOSED');
    const [openedAt, setOpenedAt] = useState<number | null>(null);
    const [closedAt, setClosedAt] = useState<number | null>(null);
    const [uptime, setUptime] = useState<string>('--:--:--');
    const [isLoading, setIsLoading] = useState(true);

    const fetchCurrentShift = useCallback(async () => {
        if (!stationId) return;

        const { data, error } = await supabase
            .from('current_station_shifts')
            .select('*')
            .eq('station_id', stationId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching shift status:', error);
            return;
        }

        if (data) {
            setStatus(data.status as ShiftStatus);
            const time = data.updated_at ? new Date(data.updated_at).getTime() : null;
            if (data.status === 'OPEN') {
                setOpenedAt(time);
                setClosedAt(null);
            } else {
                setClosedAt(time);
                setOpenedAt(null);
            }
        } else {
            // Default to CLOSED if no record exists for the station
            setStatus('CLOSED');
            setOpenedAt(null);
            setClosedAt(null);
        }
        setIsLoading(false);
    }, [stationId]);

    useEffect(() => {
        if (!stationId) return;
        
        fetchCurrentShift();

        // Subscribe to changes
        const channel = supabase
            .channel(`shift_sync_${stationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'current_station_shifts',
                    filter: `station_id=eq.${stationId}`
                },
                (payload) => {
                    const newData = payload.new as any;
                    if (newData) {
                        setStatus(newData.status as ShiftStatus);
                        const time = newData.updated_at ? new Date(newData.updated_at).getTime() : null;
                        if (newData.status === 'OPEN') {
                            setOpenedAt(time);
                            setClosedAt(null);
                        } else {
                            setClosedAt(time);
                            setOpenedAt(null);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [stationId, fetchCurrentShift]);

    const updateUptime = useCallback(() => {
        const activeTime = status === 'OPEN' ? openedAt : closedAt;
        
        if (!activeTime) {
            setUptime('--:--:--');
            return;
        }

        const diff = Date.now() - activeTime;
        const totalSecs = Math.floor(Math.max(0, diff) / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        setUptime(
            `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
    }, [status, openedAt, closedAt]);

    useEffect(() => {
        const timer = setInterval(updateUptime, 1000);
        updateUptime();
        return () => clearInterval(timer);
    }, [updateUptime]);

    return {
        status: status.toLowerCase() as 'open' | 'closed',
        openedAt,
        closedAt,
        uptime,
        isLoading,
        isViewOnly: status === 'CLOSED'
    };
};
