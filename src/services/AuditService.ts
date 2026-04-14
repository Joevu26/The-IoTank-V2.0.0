/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/config/supabase';

export type EventCategory = 'SHIFT' | 'DELIVERY' | 'TEAM' | 'AUTH' | 'SYSTEM' | 'CALIBRATION' | 'SECURITY';

export type EventType =
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
    | 'UPLOAD_AVATAR'
    | 'MFA_DISABLED'
    | 'DELIVERY_RECORDED'
    | 'SETTINGS_CHANGED'
    | 'ALERT_RESOLVED'
    | 'THRESHOLD_UPDATED'
    | 'IDENTITY_MUTATION_ATTEMPT'
    | 'DEVICE_COMMAND';

export interface UnifiedEvent {
    category: EventCategory;
    type: EventType;
    stationId: string;
    description: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    metadata?: any;
}

export class AuditService {
    /**
     * Records a high-fidelity event to the Unified Event Timeline.
     */
    static async log(
        category: EventCategory,
        type: EventType,
        stationId: string,
        description: string,
        severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO',
        metadata: any = {}
    ) {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) return;

        try {
            await supabase.from('unified_events').insert({
                station_id: stationId || null,
                actor_id: user.id,
                actor_email: user.email,
                event_category: category,
                event_type: type,
                description,
                severity,
                metadata: {
                    ...metadata,
                    actor_name: user.user_metadata?.full_name || user.email
                },
                created_at: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to write unified event log:', error);
        }
    }

    /**
     * Deletes a specific event (Station Admin only - enforced by RLS)
     */
    static async deleteEvent(eventId: string) {
        try {
            const { error } = await supabase
                .from('unified_events')
                .delete()
                .eq('id', eventId);
            
            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Failed to delete event:', err);
            return false;
        }
    }
}
