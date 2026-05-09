/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/config/supabase';

export type EventCategory = 'SHIFT' | 'DELIVERY' | 'TEAM' | 'SECURITY' | 'SYSTEM' | 'FINANCE' | 'AI' | 'CALIBRATION';

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
    | 'UNAUTHORIZED_ACCESS_ATTEMPT'
    | 'DEVICE_COMMAND'
    | 'ORDER_REQUESTED'
    | 'ORDER_CANCELLED'
    | 'THEFT_DETECTED'
    | 'LEAK_DETECTED'
    | 'HARDWARE_PROVISIONED'
    | 'ALERTS_BULK_RESOLVED'
    | 'ALERTS_BULK_DISMISSED'
    | 'MANUAL_OVERRIDE'
    | 'CALIBRATION_APPLIED';


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
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                console.warn('[AuditService] No active session found, skipping log.');
                return;
            }

            // 🟢 Forensic Intelligence Sanitization: Ensure stationId is a valid UUID or null
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const validStationId = uuidRegex.test(stationId) ? stationId : null;

            const { error } = await supabase.from('unified_events').insert({
                station_id: validStationId,
                actor_id: user.id,
                actor_email: user.email,
                event_category: category,
                event_type: type,
                description,
                metadata: {
                    ...metadata,
                    severity,
                    actor_name: user.user_metadata?.full_name || user.email
                },
                created_at: new Date().toISOString()
            });

            if (error) {
                console.error('[AuditService] Database rejected log:', error.message);
            }
        } catch (error) {
            console.error('[AuditService] Critical failure during logging:', error);
        }
    }
    // CRIT-003: deleteEvent() removed — unified_events entries are immutable.
    // Deletion is blocked at DB level by the prevent_unified_events_mutation trigger.
    // Use the Supabase service_role console for GDPR purge operations only.
}
