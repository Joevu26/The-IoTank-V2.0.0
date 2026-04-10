import { useState, useEffect, useCallback } from 'react';

export type ShiftStatus = 'open' | 'closed';

export const useShiftStatus = () => {
    const [status, setStatus] = useState<ShiftStatus>(() => {
        return (localStorage.getItem('iotank_shift_status') as ShiftStatus) || 'closed';
    });

    const [openedAt, setOpenedAt] = useState<number | null>(() => {
        const val = localStorage.getItem('iotank_shift_start_time');
        return val ? new Date(val).getTime() : null;
    });

    const [closedAt, setClosedAt] = useState<number | null>(() => {
        const val = localStorage.getItem('iotank_shift_closed_at');
        return val ? new Date(val).getTime() : null;
    });

    const [uptime, setUptime] = useState<string>('--:--:--');

    const updateUptime = useCallback(() => {
        if (status === 'closed') {
            if (closedAt) {
                const diff = Date.now() - closedAt;
                const totalSecs = Math.floor(diff / 1000);
                const hrs = Math.floor(totalSecs / 3600);
                const mins = Math.floor((totalSecs % 3600) / 60);
                const secs = totalSecs % 60;
                setUptime(`${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
            } else {
                setUptime('--:--:--');
            }
            return;
        }

        if (!openedAt) {
            setUptime('00:00:00');
            return;
        }

        const diff = Date.now() - openedAt;
        const totalSecs = Math.floor(diff / 1000);
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

    // Listen for the custom event dispatched by Quick Actions Modals
    useEffect(() => {
        const handleShiftChange = () => {
            const newStatus = (localStorage.getItem('iotank_shift_status') as ShiftStatus) || 'closed';
            setStatus(newStatus);
            
            const startVal = localStorage.getItem('iotank_shift_start_time');
            setOpenedAt(startVal ? new Date(startVal).getTime() : null);

            const lastUp = localStorage.getItem('iotank_shift_closed_at');
            setClosedAt(lastUp ? new Date(lastUp).getTime() : null);
        };

        window.addEventListener('iotank_shift_changed', handleShiftChange);
        
        return () => {
            window.removeEventListener('iotank_shift_changed', handleShiftChange);
        };
    }, []);

    return {
        status,
        openedAt,
        closedAt,
        uptime,
        isViewOnly: status === 'closed'
    };
};
