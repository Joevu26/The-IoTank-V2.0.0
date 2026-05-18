/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/config/supabase';
import { TankReading, Tank, Alert, User, ShiftDocument, Site } from '@/types';
import { downsampleLTTB } from '@/utils/performance';
import { AuditService } from '@/services/AuditService';
import { logger } from '@/utils/logger';
import { validateUUID } from '@/utils/sanitization';


/**
 * Helper to safely cast to number with a default
 */
const safeNum = (val: any, fallback = 0) => {
    const num = Number(val);
    return isNaN(num) ? fallback : num;
};

/**
 * CACHE AGENT: TTL-enabled localStorage persistence
 */
const STORAGE_PREFIX = 'iotank_telemetry_';
const CACHE_TTL = 3600 * 1000; // 1 Hour

const cacheHelper = {
    set: (key: string, data: any) => {
        try {
            const payload = {
                timestamp: Date.now(),
                data
            };
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload));
        } catch (e) {
            logger.warn('[StorageAgent] Cache write failed:', e);
        }
    },
    get: (key: string) => {
        try {
            const raw = localStorage.getItem(STORAGE_PREFIX + key);
            if (!raw) return null;
            const payload = JSON.parse(raw);
            if (Date.now() - payload.timestamp > CACHE_TTL) {
                localStorage.removeItem(STORAGE_PREFIX + key);
                return null;
            }
            return payload.data;
        } catch (e) {
            return null;
        }
    }
};

/**
 * Utility to map Supabase Tank row to legacy Tank interface
 */
const mapTank = (row: any): Tank => ({
    id: row.id,
    stationId: row.station_id,
    siteId: row.site_id,
    name: row.tank_name || 'Unnamed Tank',
    location: row.physical_location || row.location || '',
    capacity: safeNum(row.tank_capacity),
    fuelType: row.fuel_type || 'Unknown',
    shape: row.tank_shape === 'capsule' ? 'capsule' : (row.tank_shape === 'vertical_cylinder' ? 'cylinder' : 'rectangular'),
    height: safeNum(row.tank_height),
    diameter: safeNum(row.tank_radius ? row.tank_radius * 2 : 0),
    length: safeNum(row.tank_length),
    lowLevelThreshold: safeNum(row.low_level_threshold),
    highLevelThreshold: safeNum(row.high_level_threshold || 90),
    criticalLevelThreshold: safeNum(row.critical_level_threshold || 10),
    rapidDefillThreshold: safeNum(row.rapid_defill_threshold || 0),
    leakageThreshold: safeNum(row.leakage_threshold || 0),
    temperatureAlertThreshold: safeNum(row.high_temperature_threshold || 60),
    leakDetectionSensitivity: safeNum(row.leak_sensitivity || 0.1),
    thermalCoefficient: safeNum(row.thermal_coefficient || 0.00084),
    density: safeNum(row.fuel_density || row.density || 0.832),
    sensorOffset: safeNum(row.sensor_offset || 0),
    sensorHeight: safeNum(row.sensor_height),
    sensorEmptyDistance: row.sensor_empty_distance !== null ? safeNum(row.sensor_empty_distance) : undefined,
    sensorFullDistance: row.sensor_full_distance !== null ? safeNum(row.sensor_full_distance) : undefined,
    currentVolume: safeNum(row.current_volume || 0),
    lastReading: row.last_reading_at ? new Date(row.last_reading_at).getTime() : undefined,
    isActive: row.status === 'active' || row.is_active === true,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    sensorId: row.sensor_id,
    sensorChannel: row.sensor_channel,
    metadata: row.metadata || {}
});

const parseTimestamp = (ts: any) => {
    if (!ts) return 0;
    if (typeof ts === 'string') {
        return new Date(ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z').getTime();
    }
    if (typeof ts === 'object' && typeof ts.toISOString === 'function') {
        return new Date(ts.toISOString()).getTime();
    }
    return new Date(ts).getTime();
};

/**
 * Utility to map Supabase Reading row to legacy TankReading interface
 */
const mapReading = (row: any): TankReading => ({
    id: row.id?.toString() || Math.random().toString(),
    tankId: row.tank_id,
    timestamp: parseTimestamp(row.captured_at || row.timestamp),
    temperature: safeNum(row.temperature),
    volume: safeNum(row.volume || row.ambient_volume),
    fuelLevel: safeNum(row.fill_percentage),
    volumeCorrected: safeNum(row.volume_corrected || row.standard_volume || row.volume || row.ambient_volume),
    signalQuality: (() => {
        const rssiVal = Math.abs(row.rssi || row.signal_strength || (row.metadata?.rssi) || 0);
        if (rssiVal === 0) return 'Offline';
        if (rssiVal >= 30 && rssiVal <= 50) return 'Excellent';
        if (rssiVal >= 51 && rssiVal <= 65) return 'Good';
        if (rssiVal >= 66 && rssiVal <= 75) return 'Fair';
        if (rssiVal >= 76 && rssiVal <= 85) return 'Weak';
        if (rssiVal > 90) return 'Unusable';
        return 'Connected';
    })(),
    rssi: safeNum(Math.abs(row.rssi || row.signal_strength || (row.metadata?.rssi))),
    deviceId: row.device_id || '',
    processingLocation: (row.processing_location || 'cloud') as 'edge' | 'cloud',
    metadata: row.metadata || {}
});

/**
 * Utility to map Supabase Alert row to legacy Alert interface
 */
const mapAlert = (row: any): Alert => ({
    id: row.id?.toString() || Math.random().toString(),
    tankId: row.tank_id,
    type: row.alert_type === 'low_fuel' ? 'low_level' : (row.alert_type === 'high_temperature' ? 'high_temperature' : row.alert_type),
    severity: (row.severity === 'warning' || row.severity === 'critical') ? row.severity : 'info',
    message: row.message || '',
    title: row.title || 'Alert',
    timestamp: parseTimestamp(row.timestamp),
    resolved: !!row.is_resolved,
    detectionMethod: 'deterministic',
    metadata: row.metadata || {}
});
import { useQuery } from '@tanstack/react-query';

/**
 * Professional Supabase-based Hook for Real-time Tank list
 */
export function useTanks(stationId: string) {
    const [isOffline, setIsOffline] = useState(false);

    const query = useQuery({
        queryKey: ['tanks', stationId],
        initialData: () => {
            if (!stationId) return undefined;
            return cacheHelper.get(`tanks_${stationId}`) || undefined;
        },
        queryFn: async () => {
            try {
                let sbQuery = supabase.from('tanks').select('*');
                if (stationId && stationId !== 'SYSTEM_GOVERNANCE') {
                    sbQuery = sbQuery.eq('station_id', stationId);
                }
                const { data, error } = await sbQuery.order('tank_name');
                if (error) throw error;
                const mapped = (data || []).map(mapTank);
                cacheHelper.set(`tanks_${stationId}`, mapped);
                setIsOffline(false);
                return mapped;
            } catch (err) {
                logger.warn('[GhostMode] Tanks fetch failed, falling back to cache:', err);
                const cached = cacheHelper.get(`tanks_${stationId}`);
                if (cached) {
                    setIsOffline(true);
                    return cached;
                }
                throw err;
            }
        },
        enabled: true,
        staleTime: 5 * 60 * 1000,
        refetchInterval: 30000, // Realtime channel handles instant updates; 30s is the safety fallback
        retry: 1,
        retryDelay: 10000, // Back off 10s before retry to avoid hammering a paused DB
    });

    return { 
        tanks: query.data || [], 
        loading: query.isLoading, 
        error: query.error as Error | null,
        isOffline 
    };
}

/**
 * Professional Supabase-based Hook for Latest Reading
 */
export function useLatestReading(_stationId: string, tankId: string, enabled: boolean = true) {
    const query = useQuery({
        queryKey: ['latest_reading', tankId],
        queryFn: async () => {
            if (!validateUUID(tankId)) return null;

            const { data, error } = await supabase
                .from('sensor_readings')
                .select('*')
                .eq('tank_id', tankId)
                .order('captured_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data ? mapReading(data) : null;
        },
        enabled: !!tankId && enabled,
        staleTime: 0, // Telemetry is always moving
        refetchInterval: enabled ? 2000 : false, // 2-second real-time polling
    });

    const reading = query.data || null;
    let freshness: 'fresh' | 'stale' | 'offline' = 'offline';
    if (reading) {
        const age = Date.now() - reading.timestamp;
        freshness = age < 30000 ? 'fresh' : age < 300000 ? 'stale' : 'offline';
    }

    return { reading, freshness, loading: query.isLoading, error: query.error as Error | null };
}

/**
 * Professional Supabase-based Hook for multiple tank readings
 * Optimized for "Live SaaS" requirements with 1s update frequency support
 */
export function useAllLatestReadings(stationId: string | undefined, tankIds: string[], enabled: boolean = true) {
    const stabilizedTankIds = React.useMemo(() => JSON.stringify([...tankIds].sort()), [tankIds]);
    const cacheKey = `latest_readings_${stationId}_${stabilizedTankIds}`;
    const [isOffline, setIsOffline] = useState(false);

    const query = useQuery({
        queryKey: ['all_latest_readings', stationId, stabilizedTankIds],
        initialData: () => {
            if (!stationId) return undefined;
            return cacheHelper.get(cacheKey) || undefined;
        },
        queryFn: async () => {
            const validTankIds = tankIds.filter(id => validateUUID(id));
            if (validTankIds.length === 0) return {};
            
            try {
                const { data, error } = await supabase
                    .from('latest_sensor_readings')
                    .select('*')
                    .in('tank_id', validTankIds);

                if (error) throw error;
                
                const latest: Record<string, TankReading> = {};
                (data || []).forEach(r => {
                    latest[r.tank_id] = mapReading(r);
                });
                if (stationId && Object.keys(latest).length > 0) cacheHelper.set(cacheKey, latest);
                setIsOffline(false);
                return latest;
            } catch (err) {
                logger.warn('[GhostMode] Readings fetch failed, falling back to cache:', err);
                const cached = cacheHelper.get(cacheKey);
                if (cached) {
                    setIsOffline(true);
                    return cached;
                }
                throw err;
            }
        },
        enabled: enabled && !!stationId && tankIds.length > 0,
        staleTime: 10000,
        refetchInterval: enabled ? 3000 : false, // 3-second real-time fleet polling
    });

    return { 
        readings: query.data || {}, 
        loading: query.isLoading, 
        error: query.error as Error | null,
        isOffline 
    };
}

/**
 * Professional Supabase-based Hook for Alerts
 */
export function useAlerts(stationId?: string, resolved: boolean = false) {
    const query = useQuery({
        queryKey: ['alerts', stationId, resolved],
        initialData: () => {
            if (!stationId) return undefined;
            return cacheHelper.get(`alerts_${stationId}_${resolved}`) || undefined;
        },
        queryFn: async () => {
            let sbQuery = supabase.from('alerts').select('*').eq('is_resolved', resolved);
            if (stationId && stationId !== 'SYSTEM_GOVERNANCE') {
                sbQuery = sbQuery.eq('station_id', stationId);
            }
            const { data, error } = await sbQuery.order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            const mapped = (data || []).map(mapAlert);
            cacheHelper.set(`alerts_${stationId}_${resolved}`, mapped);
            return mapped;
        },
        enabled: true,
        staleTime: 10 * 1000,
        refetchInterval: 30000, // Realtime channel pushes inserts live; 30s is the safety fallback
        retry: 1,
        retryDelay: 10000,
    });

    return { alerts: query.data || [], loading: query.isLoading, error: query.error as Error | null, refetch: query.refetch };
}

/**
 * Hook for Live Market Prices (EPRA Sync)
 */
export function useLatestMarketPrices() {
    return useQuery({
        queryKey: ['market_prices'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('market_prices')
                .select('*')
                .order('effective_date', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        staleTime: 30 * 60 * 1000, // 30 minutes
    });
}
/**
 * Professional Supabase-based Hook for Sites
 */
export function useSites(stationId: string | undefined) {
    const query = useQuery({
        queryKey: ['sites', stationId],
        queryFn: async () => {
            if (!stationId) return [];
            let sbQuery = supabase.from('sites').select('*');
            if (stationId !== 'SYSTEM_GOVERNANCE') {
                sbQuery = sbQuery.eq('station_id', stationId);
            }
            const { data, error } = await sbQuery;
            if (error) throw error;
            return (data || []).map(s => ({
                id: s.id,
                stationId: s.station_id,
                siteName: s.site_name,
                address: s.location || '',
                gpsCoordinates: { latitude: 0, longitude: 0 },
                tankCount: 0,
                createdAt: new Date(s.created_at).getTime()
            } as Site));
        },
        enabled: !!stationId,
        staleTime: 10 * 60 * 1000,
    });

    return { sites: query.data || [], loading: query.isLoading, error: query.error as Error | null };
}

/**
 * Historical Data Hook
 */
export function useHistoricalReadings(
    _stationId: string | undefined,
    tankId: string | undefined,
    timeRange?: { start: number, end: number },
    maxPoints = 1440,
    _interval: 'hour' | 'day' = 'hour',
    enabled: boolean = true
) {
    const query = useQuery({
        queryKey: ['history', tankId, maxPoints, timeRange?.start, timeRange?.end],
        queryFn: async () => {
            if (!tankId || !validateUUID(tankId)) return [];
            let query = supabase
                .from('sensor_readings')
                .select('*')
                .eq('tank_id', tankId)
                .order('captured_at', { ascending: true });

            if (timeRange) {
                query = query
                    .gte('captured_at', new Date(timeRange.start).toISOString())
                    .lte('captured_at', new Date(timeRange.end).toISOString());
            }
            
            const { data, error } = await query.limit(maxPoints);

            if (error) throw error;
            const mapped = (data || []).map(mapReading);
            
            // Apply LTTB Downsampling if we have many points for better chart performance
            if (mapped.length > maxPoints / 2) {
                const points = mapped.map(r => ({ x: r.timestamp, y: r.volumeCorrected || r.volume }));
                const downsampledPoints = downsampleLTTB(points, Math.min(maxPoints, 500));
                
                // Map back to reading objects (simplified)
                const downsampledTimestamps = new Set(downsampledPoints.map(p => p.x));
                return mapped.filter(r => downsampledTimestamps.has(r.timestamp));
            }
            
            return mapped;
        },
        enabled: !!tankId && enabled,
        staleTime: 60 * 1000,
    });

    return { readings: query.data || [], loading: query.isLoading, error: query.error as Error | null };
}

/**
 * Materialized View Hook for 30-day Analytics
 * Faster than querying raw readings for historical trends
 */
export function useTankAnalytics30d(stationId: string | undefined) {
    const query = useQuery({
        queryKey: ['analytics-30d', stationId],
        queryFn: async () => {
            if (!stationId) return [];
            // Use the secure RPC wrapper instead of direct view access to satisfy security rules
            const { data, error } = await supabase.rpc('get_tank_analytics_30d', { p_station_id: stationId });

            if (error) {
                logger.warn('[useTankAnalytics30d] RPC failed, fallback to raw may be needed:', error);
                return [];
            }
            return data || [];
        },
        enabled: !!stationId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    return { analytics: query.data || [], loading: query.isLoading, error: query.error as Error | null };
}

let updateTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Update Tank Configuration (with Debouncing)
 */
export async function updateTank(tankId: string, updates: Partial<Tank>) {
    // Basic debounce to prevent rapid fire updates from UI
    if (updateTimeout) clearTimeout(updateTimeout);
    
    return new Promise((resolve, reject) => {
        updateTimeout = setTimeout(async () => {
            try {
                // Map Tank interface back to snake_case database columns
                const dbUpdates: any = {};
                if (updates.name !== undefined) dbUpdates.tank_name = updates.name;
                if (updates.thermalCoefficient !== undefined) dbUpdates.thermal_coefficient = updates.thermalCoefficient;
                if (updates.highLevelThreshold !== undefined) dbUpdates.high_level_threshold = updates.highLevelThreshold;
                if (updates.lowLevelThreshold !== undefined) dbUpdates.low_level_threshold = updates.lowLevelThreshold;
                if (updates.sensorHeight !== undefined) {
                    if (updates.sensorHeight < 0) throw new Error("Sensor height cannot be negative");
                    dbUpdates.sensor_height = updates.sensorHeight;
                }
                if (updates.sensorOffset !== undefined) dbUpdates.sensor_offset = updates.sensorOffset;
                if ((updates as any).temperatureAlertThreshold !== undefined) dbUpdates.high_temperature_threshold = (updates as any).temperatureAlertThreshold;
                if ((updates as any).esp32Address !== undefined) dbUpdates.sensor_id = (updates as any).esp32Address;
                if (updates.sensorId !== undefined) dbUpdates.sensor_id = updates.sensorId;
                if (updates.sensorChannel !== undefined) dbUpdates.sensor_channel = updates.sensorChannel;
                if ((updates as any).metadata !== undefined) dbUpdates.metadata = (updates as any).metadata;
                
                if (updates.height !== undefined) dbUpdates.tank_height = updates.height;
                if (updates.diameter !== undefined) dbUpdates.tank_radius = updates.diameter / 2;
                if (updates.length !== undefined) dbUpdates.tank_length = updates.length;
                if (updates.capacity !== undefined) dbUpdates.tank_capacity = updates.capacity;
                if (updates.shape !== undefined) {
                    dbUpdates.tank_shape = updates.shape === 'cylinder' ? 'vertical_cylinder' : (updates.shape === 'capsule' ? 'capsule' : 'rectangular');
                }
                
                dbUpdates.updated_at = new Date().toISOString();

                const { data, error } = await supabase
                    .from('tanks')
                    .update(dbUpdates)
                    .eq('id', tankId)
                    .select();

                if (error) throw error;

                // 🟢 Forensic Intelligence Log
                await AuditService.log(
                    'SYSTEM',
                    'SETTINGS_CHANGED',
                    (updates as any).stationId || '',
                    `Hardware profile updated for ${updates.name || 'tank'}. Fields modified: ${Object.keys(dbUpdates).join(', ')}`,
                    'INFO',
                    { tankId, changes: dbUpdates }
                ).catch((err: any) => logger.warn("[AUDIT_FAILURE]", err));

                resolve(data);
            } catch (err: any) {
                reject(err);
            }
        }, 300); // 300ms debounce
    });
}

/**
 * Create a new Tank record
 */
export async function createTank(tankData: Partial<Tank> & { stationId: string }) {
    try {
        // Fetch dynamic defaults
        const { data: settings } = await supabase.from('system_settings').select('key, value').in('key', ['DEFAULT_LOW_LEVEL_THRESHOLD', 'DEFAULT_HIGH_TEMP_THRESHOLD']);
        const getSetting = (key: string, def: number) => {
            const s = settings?.find(x => x.key === key);
            return s ? parseFloat(s.value) : def;
        };

        const dbTank = {
            station_id: tankData.stationId,
            site_id: tankData.siteId,
            tank_name: tankData.name,
            tank_capacity: tankData.capacity,
            fuel_type: tankData.fuelType,
            tank_shape: tankData.shape === 'cylinder' ? 'vertical_cylinder' : (tankData.shape === 'capsule' ? 'capsule' : 'rectangular'),
            tank_height: tankData.height,
            tank_radius: tankData.diameter ? tankData.diameter / 2 : undefined,
            tank_length: tankData.length,
            sensor_id: tankData.sensorId, // "ESP ID"
            sensor_channel: tankData.sensorChannel || 1,
            sensor_height: tankData.sensorHeight,
            sensor_empty_distance: tankData.sensorEmptyDistance,
            sensor_full_distance: tankData.sensorFullDistance,
            low_level_threshold: tankData.lowLevelThreshold || getSetting('DEFAULT_LOW_LEVEL_THRESHOLD', 20),
            high_temperature_threshold: tankData.temperatureAlertThreshold || getSetting('DEFAULT_HIGH_TEMP_THRESHOLD', 60),
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('tanks')
            .insert(dbTank)
            .select()
            .single();

        if (error) throw error;
        return mapTank(data);
    } catch (err) {
        logger.error('Error creating tank:', err);
        throw err;
    }
}

/**
 * Propagate threshold logic to all tanks in a station
 * [SaaS Fleet Management]: Ensures all sensors follow the same safety benchmarks.
 */
export async function propagateStationThresholds(stationId: string) {
    const { error } = await supabase
        .from('tanks')
        .update({
            high_level_threshold: 95,
            low_level_threshold: 20,
            critical_level_threshold: 5,
            updated_at: new Date().toISOString()
        })
        .eq('station_id', stationId);

    if (error) throw error;
    
    // Forensic Audit
    await AuditService.log(
        'SYSTEM',
        'SETTINGS_CHANGED',
        stationId,
        `Fleet-wide threshold propagation executed. Policy: High(95%), Low(20%), Critical(5%).`,
        'INFO'
    ).catch(err => logger.error('[Audit Log Failed]', err));
    
    return true;
}

/**
 * Hook for User Profile
 */
export function useProfile(authUserId: string | undefined) {
    const [profile, setProfile] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!authUserId) {
            setLoading(false);
            return;
        }

        let isMounted = true;

        const fetchProfile = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('auth_user_id', authUserId)
                    .single();

                if (!isMounted) return;

                if (error && error.code !== 'PGRST116') throw error;
                
                if (data) {
                    setProfile({
                        authUserId: data.auth_user_id,
                        email: data.email,
                        displayName: data.display_name,
                        role: data.role,
                        stationId: data.station_id,
                        siteIds: data.site_ids || [],
                        mfaEnabled: data.mfa_enabled,
                        createdAt: new Date(data.created_at).getTime(),
                        lastLoginAt: data.last_login_at ? new Date(data.last_login_at).getTime() : undefined,
                    } as User);
                    setError(null);
                } else {
                    setProfile(null);
                }
            } catch (err) {
                if (!isMounted) return;
                logger.error('Error fetching profile:', err);
                setError(err as Error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchProfile();

        if (import.meta.env.VITE_DISABLE_REALTIME === 'true') return;

        const channelId = `profile:${authUserId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `auth_user_id=eq.${authUserId}` },
                () => fetchProfile()
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [authUserId]);

    return { profile, loading, error };
}

// useShifts moved to useShifts.ts - exported here for forensic compatibility during HMR transition
export { useShifts } from './useShifts';

/**
 * Create Shift Record (Unified Forensic Logging)
 */
export async function createShift(stationId: string, shiftData: Omit<ShiftDocument, 'id'> & { operation_type?: 'OPEN' | 'CLOSE', action_label?: string }) {
    const dbShift = {
        station_id: stationId,
        opened_at: shiftData.openedAt,
        closed_at: shiftData.closedAt || shiftData.openedAt,
        duration_min: shiftData.durationMin,
        site_id: shiftData.siteId,
        tank_id: shiftData.tankId,
        pump_readings: shiftData.pumpReadings,
        volume_sold_liters: shiftData.volumeSoldLiters,
        expected_collections: shiftData.expected,
        received_collections: {
            ...shiftData.received,
            opened_by: shiftData.openedBy,
            closing_volume: shiftData.closingVolume
        },
        variance_data: shiftData.variance,
        status: (shiftData.status as string) === 'OPEN' ? 'NEEDS_REVIEW' : shiftData.status,
        review_state: shiftData.reviewState,
        auth_user_id: (shiftData.closedBy?.authUserId && validateUUID(shiftData.closedBy.authUserId)) 
            ? shiftData.closedBy.authUserId 
            : ((shiftData.openedBy?.authUserId && validateUUID(shiftData.openedBy.authUserId)) 
                ? shiftData.openedBy.authUserId 
                : null),
        supervisor_notes: shiftData.notes,
        operation_type: shiftData.operation_type || 'CLOSE',
        action_label: shiftData.action_label || (shiftData.operation_type === 'OPEN' ? 'Shift Initialized' : 'Reconciliation Finalized')
    };

    const { data, error } = await supabase
        .from('shift_closures')
        .insert(dbShift)
        .select();

    if (error) throw error;
    return data;
}

/**
 * Create/Update Profile
 * [FORENSIC HARDENING]: Enforces identity immutability for station_id once established
 */
export async function upsertProfile(profile: Partial<User> & { authUserId: string }) {
    // 1. Audit Check: If this is an update, verify we aren't changing the station_id
    const { data: existing } = await supabase
        .from('profiles')
        .select('station_id')
        .eq('auth_user_id', profile.authUserId)
        .maybeSingle();
    
    const dbProfile: any = {
        auth_user_id: profile.authUserId,
        email: profile.email,
        display_name: profile.displayName,
        role: profile.role,
        site_ids: profile.siteIds,
        mfa_enabled: profile.mfaEnabled,
        last_login_at: profile.lastLoginAt ? new Date(profile.lastLoginAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    // Only allow setting station_id if it's currently null/empty in DB
    if (!existing?.station_id && profile.stationId) {
        dbProfile.station_id = profile.stationId;
    } else if (existing?.station_id && profile.stationId && existing.station_id !== profile.stationId) {
        logger.warn(`[SECURITY] Prevented unauthorized station migration for user ${profile.authUserId}`);
        // Forensic log of the attempt
        AuditService.log(
            'SECURITY',
            'IDENTITY_MUTATION_ATTEMPT',
            existing.station_id,
            `User tried to change station_id from ${existing.station_id} to ${profile.stationId}`,
            'CRITICAL',
            { authUserId: profile.authUserId }
        ).catch(() => {});
    }

    const { data, error } = await supabase
        .from('profiles')
        .upsert(dbProfile, { onConflict: 'auth_user_id' })
        .select();

    if (error) throw error;
    return data;
}
/**
 * Bulk resolve all alerts for a station
 */
export async function resolveAllAlerts(stationId: string, resolvedBy: string = 'SYSTEM') {
    const { error } = await supabase
        .from('alerts')
        .update({
            is_resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: resolvedBy
        })
        .eq('station_id', stationId)
        .eq('is_resolved', false);

    if (error) throw error;
    return true;
}

/**
 * Resolve Alert
 */
export async function resolveAlert(alertId: string, resolvedBy: string) {
    const { data, error } = await supabase
        .from('alerts')
        .update({
            is_resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: resolvedBy
        })
        .eq('id', alertId)
        .select();

    if (error) throw error;
    return data;
}

/**
 * Delete Tank
 * [DESTRUCTIVE OPERATION]: Only accessible to authLevel <= 5.
 */
export async function deleteTank(tankId: string) {
    const { error } = await supabase
        .from('tanks')
        .delete()
        .eq('id', tankId);

    if (error) throw error;

    // Forensic Log for deletion
    await AuditService.log(
        'SECURITY',
        'DELETE_TANK',
        '', 
        `Tank identity ${tankId} permanently purged from system.`,
        'CRITICAL',
        { tankId }
    ).catch(() => {});

    return true;
}
/**
 * Trigger a new Alert
 */
export async function createAlert(alert: Partial<Alert> & { station_id: string }) {
    // 🟢 UUID Validation: Prevent 400 errors from "ghost" or malformed IDs
    const isValidStation = validateUUID(alert.station_id);
    const isValidTank = !alert.tankId || validateUUID(alert.tankId);

    if (!isValidStation || !isValidTank) {
        logger.warn('[useSupabase] Skipping alert insertion due to invalid UUID:', { station_id: alert.station_id, tank_id: alert.tankId });
        return null;
    }

    const { data, error } = await supabase
        .from('alerts')
        .insert({
            station_id: alert.station_id,
            tank_id: alert.tankId,
            alert_type: alert.type || 'anomaly',
            severity: alert.severity || 'info',
            message: alert.message || '',
            title: alert.title || 'System Alert',
            timestamp: new Date().toISOString(),
            is_resolved: false,
            metadata: alert.metadata || {}
        })
        .select();

    if (error) throw error;
    return data;
}

/**
 * Hook to monitor 'refuelling' state (sudden volume increase)
 * @deprecated Use AlertDetectionEngine refill sensing for centralized forensic logic
 */
export function useRefuelMonitor(stationId: string, tankId: string) {
    const [isRefuelling, setIsRefuelling] = useState(false);
    const { reading } = useLatestReading(stationId || 'default', tankId);
    const prevVolumeRef = useRef<number | null>(null);

    useEffect(() => {
        if (!reading) return;

        const currentVol = reading.volume ?? 0;
        
        if (prevVolumeRef.current !== null) {
            const diff = currentVol - prevVolumeRef.current;
            // If volume increased by more than 50L in one reading, consider it refuelling
            // This is a simple threshold-based detection
            if (diff > 50) {
                setIsRefuelling(true);
                // Reset after 30 seconds
                const timer = setTimeout(() => setIsRefuelling(false), 30000);
                return () => clearTimeout(timer);
            }
        }
        
        prevVolumeRef.current = currentVol;
    }, [reading]);

    return { isRefuelling };
}

/**
 * Hook to fetch all stations (Super Admin only)
 */
export function useAllStations() {
    const query = useQuery({
        queryKey: ['all_stations'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fuel_stations')
                .select('*')
                .order('station_name');
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
    });

    return { stations: query.data || [], loading: query.isLoading, error: query.error as Error | null };
}

/**
 * Hook for Global Infrastructure Stats (Super Admin)
 */
export function useGlobalStats() {
    const query = useQuery({
        queryKey: ['global_stats'],
        queryFn: async () => {
            // This would ideally be a single RPC, but we can aggregate here for now
            const { data: stations } = await supabase.from('fuel_stations').select('id');
            const { count: totalTanks } = await supabase.from('tanks').select('*', { count: 'exact', head: true });
            const { count: totalAlerts } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false);
            
            return {
                stationCount: stations?.length || 0,
                tankCount: totalTanks || 0,
                activeAlerts: totalAlerts || 0,
                healthScore: 100 - (totalAlerts ? Math.min(30, totalAlerts * 2) : 0)
            };
        },
        staleTime: 60 * 1000,
    });

    return { stats: query.data || { stationCount: 0, tankCount: 0, activeAlerts: 0, healthScore: 100 }, loading: query.isLoading };
}
