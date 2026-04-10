/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/config/supabase';

export type AuditAction =
    | 'LOGIN'
    | 'LOGOUT'
    | 'CREATE_TANK'
    | 'UPDATE_TANK'
    | 'DELETE_TANK'
    | 'RESOLVE_ALERT'
    | 'ACKNOWLEDGE_ALERT'
    | 'UPDATE_SETTINGS'
    | 'MFA_ENABLED'
    | 'UPDATE_PROFILE'
    | 'UPDATE_COMPANY'
    | 'MANUAL_ADJUSTMENT'
    | 'SHIFT_CLOSED'
    | 'INVITE_SENT'
    | 'ROLE_UPDATED'
    | 'INVITE_CANCELLED'
    | 'MEMBER_REMOVED'
    | 'SHIFT_STARTED'
    | 'SECURITY_COLLUSION_ALERT'
    | 'UPLOAD_LOGO'
    | 'UPLOAD_AVATAR';

export interface AuditLog {
    action: AuditAction;
    userId: string;
    userName?: string;
    stationId: string;
    details: string;
    timestamp: any;
    severity: 'info' | 'warning' | 'critical';
    changes_made?: any;
    before_values?: any;
    after_values?: any;
}

export class AuditService {
    static async log(
        action: AuditAction,
        stationId: string,
        details: string,
        severity: AuditLog['severity'] = 'info',
        payload?: { before?: any; after?: any; changes?: any }
    ) {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) return;

        try {
            await supabase.from('audit_logs').insert({
                action,
                user_id: user.id,
                user_name: user.user_metadata?.full_name || user.email,
                user_email: user.email,
                station_id: stationId,
                details,
                severity,
                before_values: payload?.before,
                after_values: payload?.after,
                changes_made: payload?.changes,
                created_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to write audit log:', error);
        }
    }
}
