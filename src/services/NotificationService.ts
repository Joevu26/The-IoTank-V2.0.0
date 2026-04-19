/**
 * Service to handle browser native notifications
 */
import { sanitizeIds } from '@/utils/formatUtils';

export class NotificationService {
    private static storageKey = 'iotank_notifications_enabled';

    /**
     * Check if browser supports notifications
     */
    static isSupported(): boolean {
        return 'Notification' in window;
    }

    /**
     * Check if notifications are enabled by user and permission granted
     */
    static isEnabled(): boolean {
        return (
            this.isSupported() &&
            Notification.permission === 'granted' &&
            localStorage.getItem(this.storageKey) === 'true'
        );
    }

    /**
     * Request permission for notifications
     */
    static async requestPermission(): Promise<boolean> {
        if (!this.isSupported()) return false;

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem(this.storageKey, 'true');
            return true;
        }
        return false;
    }

    /**
     * Disable notifications
     */
    static disable() {
        localStorage.setItem(this.storageKey, 'false');
    }

    /**
     * Get permission state
     */
    static getPermissionState(): NotificationPermission {
        if (!this.isSupported()) return 'denied';
        return Notification.permission;
    }

    /**
     * Show a notification
     */
    static show(title: string, options?: NotificationOptions) {
        if (!this.isEnabled()) return;

        try {
            const sanitizedTitle = sanitizeIds(title);
            const sanitizedOptions = {
                ...options,
                body: options?.body ? sanitizeIds(options.body) : undefined
            };

            const notification = new Notification(sanitizedTitle, {
                icon: '/favicon.ico', 
                badge: '/favicon.ico',
                ...sanitizedOptions
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (err) {
            console.error('Failed to show notification:', err);
        }
    }

    /**
     * Specialized notification for Security Breaches (Theft/Collusion/Leak)
     */
    static notifySecurity(type: 'THEFT' | 'LEAK' | 'COLLUSION', site: string, detail: string) {
        const title = `🚨 SECURITY ALERT: ${type}`;
        const body = `Terminal: ${site}\n${detail}\nClick to view forensics.`;
        
        this.show(title, {
            body,
            tag: `security-${type}-${site}`,
            requireInteraction: true,
            silent: false
        });
    }
}
