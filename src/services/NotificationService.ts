/**
 * Service to handle browser native notifications
 */
import { sanitizeIds } from '@/utils/formatUtils';
import { supabase } from '@/config/supabase';
import { logger } from '@/utils/logger';

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

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                localStorage.setItem(this.storageKey, 'true');
                return true;
            }
            // If denied or dismissed, ensure storage reflects it
            localStorage.setItem(this.storageKey, 'false');
            return false;
        } catch (err) {
            console.error('Permission request failed:', err);
            return false;
        }
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
        // Double check permissions before showing, just in case
        if (!this.isEnabled()) {
            logger.warn('[NotificationService] Blocked: Notifications disabled or permission denied.', null, 'NOTIFICATIONS');
            return;
        }

        try {
            const sanitizedTitle = sanitizeIds(title);
            const sanitizedOptions = {
                ...options,
                body: options?.body ? sanitizeIds(options.body) : undefined,
                icon: '/favicon.ico', 
                badge: '/favicon.ico',
                timestamp: Date.now()
            };

            const notification = new Notification(sanitizedTitle, sanitizedOptions);

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (err) {
            logger.error('Failed to show notification:', err, 'NOTIFICATIONS');
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

    /**
     * Subscribe to Web Push and save to database
     */
    static async subscribeToPush(userId: string): Promise<boolean> {
        if (!this.isSupported()) return false;

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Check for existing subscription
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Subscribe if not present
                // NOTE: In production, you need a VAPID public key
                const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                if (!vapidPublicKey) {
                    logger.warn('[NotificationService] VITE_VAPID_PUBLIC_KEY is not set. Web Push subscriptions are disabled. Add the key to .env to enable push notifications.', null, 'NOTIFICATIONS');
                    return false;
                }

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: vapidPublicKey
                });
            }

            // Save token/subscription to Supabase
            if (subscription) {
                const { error } = await supabase
                    .from('user_push_tokens')
                    .upsert({
                        auth_user_id: userId,
                        token: JSON.stringify(subscription),
                        device_type: 'web',
                        last_seen_at: new Date().toISOString()
                    }, { onConflict: 'auth_user_id, token' });

                if (error) throw error;
                return true;
            }
            return false;
        } catch (err) {
            logger.error('[NotificationService] Push subscription failed:', err, 'NOTIFICATIONS');
            return false;
        }
    }
}
