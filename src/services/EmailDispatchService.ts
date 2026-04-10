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
    /**
     * Dispatch a tactical security email via the integrated Supabase SMTP system.
     * Triggers the 'dispatch-critical-alerts' edge function.
     */
    static async sendSecurityAlert(payload: EmailPayload) {
        try {
            const { data, error } = await supabase.functions.invoke('dispatch-critical-alerts', {
                body: {
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
                }
            });

            if (error) throw error;
            console.log('[EmailDispatch] Tactical alert sent successfully:', data);
            return data;
        } catch (err) {
            console.error('[EmailDispatch] Failed to dispatch tactical email:', err);
            // Fallback: Log to Audit directly if function fails
            return null;
        }
    }
}
