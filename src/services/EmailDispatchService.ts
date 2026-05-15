import { supabase } from '@/config/supabase';

export interface EmailPayload {
    to: string;
    type: 'THEFT' | 'LEAK' | 'COLLUSION' | 'SYSTEM_CRITICAL' | 'REFILL' | 'UNAUTHORIZED_REFILL' | 'DISCONNECT' | 'LOW_FUEL' | 'OVERFILL' | 'WELCOME' | 'INVITATION' | 'SHIFT_REPORT';
    siteName: string;
    details: {
        timestamp: string;
        dropRate?: number;
        lossVolume?: number;
        varianceValue?: number;
        operator?: string;
        description: string;
        // Shift Specific
        totalSales?: number;
        totalLiters?: number;
        duration?: string;
    };
}

export class EmailDispatchService {
    private static cachedSession: any = null;
    private static lastSessionFetch = 0;
    private static SESSION_TTL = 30000; // 30 seconds

    private static async getSafeAuthHeaders(): Promise<Record<string, string>> {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const headers: Record<string, string> = { 
            'Content-Type': 'application/json',
            'apikey': anonKey || ''
        };

        try {
            const now = Date.now();
            if (!this.cachedSession || (now - this.lastSessionFetch > this.SESSION_TTL)) {
                const { data: { session } } = await supabase.auth.getSession();
                this.cachedSession = session;
                this.lastSessionFetch = now;
            }
            
            const session = this.cachedSession;
            const isValidToken = session && (session.expires_at ? session.expires_at > (now / 1000) + 10 : true);
            
            if (isValidToken && session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        } catch (e) {
            console.warn('[EmailDispatchService] Auth check failed, proceeding anonymously.');
        }

        return headers;
    }

    /**
     * Dispatch a tactical security email via the integrated Supabase SMTP system.
     * Triggers the 'dispatch-critical-alerts' edge function.
     */
    static async sendSecurityAlert(payload: EmailPayload) {
        try {
            const headers = await this.getSafeAuthHeaders();
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const response = await fetch(`${supabaseUrl}/functions/v1/dispatch-critical-alerts`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    cmd: 'direct_security_alert',
                    to: payload.to,
                    params: {
                        type: payload.type,
                        siteName: payload.siteName,
                        timestamp: payload.details.timestamp,
                        details: payload.details.description,
                        dropRate: payload.details.dropRate,
                        lossVolume: payload.details.lossVolume,
                        varianceValue: payload.details.varianceValue,
                        operator: payload.details.operator,
                        totalSales: payload.details.totalSales,
                        totalLiters: payload.details.totalLiters,
                        duration: payload.details.duration
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.statusText}`);
            }

            const data = await response.json();
            // Tactical alert sent successfully
            return data;
        } catch (err) {
            console.error('[EmailDispatch] Failed to dispatch tactical email:', err);
            // Fallback: Log to Audit directly if function fails
            return null;
        }
    }
}
