import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useActiveShift } from './useShifts';

export type ShiftStatus = 'OPEN' | 'CLOSED';

export const useShiftStatus = () => {
    const { currentUser } = useAuth();
    const stationId = currentUser?.stationId;

    const { activeShift, loading: isLoading } = useActiveShift(stationId);
    const [uptime, setUptime] = useState<string>('--:--:--');

    const status = useMemo(() => 
        (activeShift?.status as ShiftStatus) || 'CLOSED'
    , [activeShift]);

    const openedAt = useMemo(() => {
        if (!activeShift) return null;
        const time = activeShift.updated_at ? new Date(activeShift.updated_at).getTime() : null;
        
        if (status === 'OPEN') {
            return time;
        } else {
            // Preserve the last opening time from metadata for historical display
            const metadata = activeShift.metadata || {};
            let lastOpened = metadata.last_opened_at ? new Date(metadata.last_opened_at).getTime() : null;
            
            // [FALLBACK]: Check localStorage if metadata is missing (current session context)
            if (!lastOpened) {
                const localStart = localStorage.getItem('iotank_shift_start_time');
                if (localStart) lastOpened = new Date(localStart).getTime();
            }
            return lastOpened;
        }
    }, [activeShift, status]);

    const closedAt = useMemo(() => {
        if (!activeShift || status === 'OPEN') return null;
        return activeShift.updated_at ? new Date(activeShift.updated_at).getTime() : null;
    }, [activeShift, status]);

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

