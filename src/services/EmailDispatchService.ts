import { supabase } from '@/config/supabase';

export interface EmailPayload {
    to: string;
    type: 'THEFT' | 'LEAK' | 'COLLUSION' | 'SYSTEM_CRITICAL';
    siteName: string;
    details: {
        timestamp: string;
        dropRate?: number;
        lossVolume?: number;
        varianceValue?: number;
        operator?: string;
        description: string;
    };
}

export class EmailDispatchService {
    private static async getSafeAuthHeaders(): Promise<Record<string, string>> {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const headers: Record<string, string> = { 
            'Content-Type': 'application/json',
            'apikey': anonKey || ''
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const isValidToken = session && (session.expires_at ? session.expires_at > (Date.now() / 1000) + 10 : true);
            
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
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/dispatch-critical-alerts', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'direct_security_alert',
                    to: payload.to,
                    params: {
                        type: payload.type,
                        siteName: payload.siteName,
                        timestamp: payload.details.timestamp,
                        details: payload.details.description,
                        dropRate: payload.details.dropRate,
                        lossVolume: payload.details.lossVolume,
                        varianceValue: payload.details.varianceValue,
                        operator: payload.details.operator
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[EmailDispatch] Tactical alert sent successfully:', data);
            return data;
        } catch (err) {
            console.error('[EmailDispatch] Failed to dispatch tactical email:', err);
            // Fallback: Log to Audit directly if function fails
            return null;
        }
    }
}
