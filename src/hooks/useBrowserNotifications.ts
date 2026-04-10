import { useEffect, useRef } from 'react';
import { useAlerts } from './useSupabase';
import { NotificationService } from '@/services/NotificationService';

/**
 * Hook to automatically trigger browser notifications for new alerts
 */
export function useBrowserNotifications(orgId: string) {
    const { alerts } = useAlerts(orgId, false);
    const prevAlertIds = useRef<Set<string>>(new Set());
    const isFirstRun = useRef(true);

    useEffect(() => {
        if (!NotificationService.isEnabled()) return;

        // On first run, we just populate the existing alert IDs so we don't spam the user
        if (isFirstRun.current) {
            alerts.forEach(alert => prevAlertIds.current.add(alert.id));
            isFirstRun.current = false;
            return;
        }

        // Check for new alerts
        alerts.forEach(alert => {
            if (!prevAlertIds.current.has(alert.id)) {
                // This is a new alert!
                NotificationService.show(`IoTank Alert: ${alert.severity.toUpperCase()}`, {
                    body: alert.message,
                    tag: alert.id, // Prevent duplicate notifications for same ID
                    requireInteraction: alert.severity === 'critical'
                });
                prevAlertIds.current.add(alert.id);
            }
        });

        // Optional: Clean up removed alerts from the tracker if needed, 
        // but keeping them in Set prevents re-notifying if they reappear
    }, [alerts]);
}
