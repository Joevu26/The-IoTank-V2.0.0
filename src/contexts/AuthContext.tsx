/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/config/supabase';
import { User, UserRole } from '@/types';
import { AuditService } from '@/services/AuditService';
import { NewsService } from '@/services/NewsService';

import { logger } from '@/utils/logger';

// HIGH-003: Only emit debug logs in development — never in production
const debugLog = (msg: string, ctx?: any) => logger.info(msg, ctx, 'AUTH_CONTEXT');

const CACHE_KEY = 'iotank_cached_user';
// HIGH-001: Fields stored in the localStorage cache — sensitive auth fields (role, authLevel)
// are intentionally excluded; they are always re-derived from the DB on enrichment.
const SAFE_CACHE_FIELDS: (keyof User)[] = [
    'authUserId', 'email', 'displayName', 'photoURL',
    'stationId', 'companyName', 'logoUrl', 'address', 'phoneNumber', 'siteIds'
];

export interface EnrollMFAResult {
    factorId: string;
    qrCode: string;   // otpauth:// URI for QR code display
    secret: string;   // Plain text secret for manual entry
}

export interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    mfaChallengeRequired: boolean;
    mfaFactorId: string | null;
    signIn: (email: string, password: string) => Promise<any>;
    signUp: (email: string, password: string, displayName: string, stationId: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    enrichUserFromSupabase: (sbUser?: any) => Promise<boolean>;
    resetPassword: (email: string) => Promise<void>;
    hasRole: (requiredRole: UserRole | UserRole[]) => boolean;
    canSee: (level: number) => boolean;
    updateMasterPassword: (password: string) => Promise<void>;
    verifySettingsPassword: (password: string) => Promise<void>;
    updateUser: (data: Partial<User>) => Promise<void>;
    enrollMFA: () => Promise<EnrollMFAResult>;
    verifyMFARegistration: (factorId: string, code: string) => Promise<void>;
    verifyMFA: (code: string) => Promise<void>;
    unenrollMFA: () => Promise<void>;
    cancelMFAChallenge: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                // Preliminary check: if we have a cached user, we can assume authenticated for the first frame
                parsed.isProvisional = true;
                parsed.role = 'viewer';
                parsed.authLevel = 8;
                return parsed;
            } catch { return null; }
        }
        return null;
    });
    const [loading, setLoading] = useState(!localStorage.getItem(CACHE_KEY));
    const [mfaChallengeRequired, setMfaChallengeRequired] = useState(false);
    const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
    // Stores the pending Supabase challenge ID during an MFA flow
    const mfaChallengeIdRef = useRef<string | null>(null);
    const mfaChallengeInProgressRef = useRef(false);
    
    // Concurrency Lock: Prevent multiple enrichment calls from overlapping
    const isEnrichingRef = useRef<string | null>(null);
    const currentUserAuthIdRef = useRef<string | null>(null);
    const lastEnrichmentAttemptRef = useRef<number>(0);
    const enrichmentLockRef = useRef<boolean>(false);
    const handshakeInProgressRef = useRef(false);
    const isProvisionedRef = useRef<boolean>(false);
    const isLoadingRef = useRef<boolean>(true);

    const updateLoadingState = (val: boolean) => {
        setLoading(val);
        isLoadingRef.current = val;
    };
    const mapToUnprovisionedUser = (sbUser: SupabaseUser): User => {
        return {
            authUserId: sbUser.id,
            email: sbUser.email || '',
            displayName: sbUser.user_metadata?.full_name || 'Provisioning User',
            role: 'viewer', // Minimum level role
            authLevel: 8,   // Minimum level (Viewer)
            stationId: '',  // Triggers ProvisioningGuard
            siteIds: [],
            mfaEnabled: false,
            isProvisional: false, // [FIX] Ensure provisional is false for unprovisioned state
            createdAt: Date.now(),
            lastLoginAt: Date.now()
        };
    };

    const enrichUserFromSupabase = async (sbUser: any) => {
        if (!sbUser?.id) return false;
        
        // Cooldown check: Prevent re-enriching the same user within 15s if we already tried
        const now = Date.now();
        if (currentUserAuthIdRef.current === sbUser.id && (now - lastEnrichmentAttemptRef.current < 15000)) {
            debugLog(`[DEBUG_LOG] Enrichment cooldown active for ${sbUser.id}. Skipping.`);
            updateLoadingState(false);
            return false;
        }

        if (enrichmentLockRef.current) {
            // Always ensure loading clears even on skipped enrichment
            updateLoadingState(false);
            return false; // Indicating skipped
        }
        
        isEnrichingRef.current = sbUser.id;
        
        try {
            debugLog(`[DEBUG_LOG] PROFILE: Launching optimized identity bundle handshake...`);
            let handshakeTimedOut = false;
            
            // TIMEOUT PROTECTION: Force-fail if a query hangs more than 15s (Safe for slow DB cold starts)
            // TIMEOUT PROTECTION: Force-fail if a query hangs more than 15s (Safe for slow DB cold starts)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => {
                    handshakeTimedOut = true;
                    reject(new Error("Supabase query timeout"));
                }, 15000)
            );
            
            const runQuery = async () => {
                debugLog(`[DEBUG_LOG] ENRICHMENT STEP 1: Starting query for ${sbUser.id}`);
                lastEnrichmentAttemptRef.current = Date.now(); // Record attempt start
                enrichmentLockRef.current = true; // [FIX] Lock enrichment to prevent concurrent overlaps
                
                // [RECOVERY PANIC BYPASS]: If we detect a recovery link, we MUST NOT enrich or check boundaries.
                // Doing so might trigger a sign-out for System-Admins landing on the Client portal.
                if (window.location.hash.includes('type=recovery') || window.location.hash.includes('recovery_token=')) {
                    debugLog("[DEBUG_LOG] ENRICHMENT: Recovery detected. Postponing enrichment to allow password reset.");
                    return false;
                }

                // 1. IDENTITY BUNDLE: Fetch everything in one single database round-trip
                // 1.5 MFA STATUS: Check for verified factors in parallel
                debugLog(`[DEBUG_LOG] ENRICHMENT STEP 2: Firing Promise.all for DB and MFA...`);
                const [bundleResult, mfaResult] = await Promise.all([
                    (async () => {
                        debugLog(`[DEBUG_LOG] ENRICHMENT DB: Starting get_user_bundle_v2...`);
                        const res = await supabase.rpc('get_user_bundle_v2');
                        debugLog(`[DEBUG_LOG] ENRICHMENT DB: Finished get_user_bundle_v2! Error: ${!!res.error}`);
                        return res;
                    })(),
                    // MFA check is secondary - don't let it hang the whole identity handshake
                    Promise.race([
                        (async () => {
                            debugLog(`[DEBUG_LOG] ENRICHMENT MFA: Starting listFactors...`);
                            const res = await supabase.auth.mfa.listFactors();
                            debugLog(`[DEBUG_LOG] ENRICHMENT MFA: Finished listFactors!`);
                            return res;
                        })(),
                        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('MFA Timeout')), 10000))
                    ]).catch(e => {
                        logger.warn('[MFA] Factor list deferred or timed out:', e);
                        return { data: null, error: e };
                    })
                ]);
                debugLog(`[DEBUG_LOG] ENRICHMENT STEP 3: Promise.all completed!`);

                const { data: bundle, error } = bundleResult;
                const { data: factors } = mfaResult;
                const hasVerifiedMfa = factors?.totp?.some((f: any) => f.status === 'verified') || false;

                if (error) {
                    logger.error(`FATAL: RPC Request failed for ${sbUser.email}:`, error, 'AUTH_HANDSHAKE');
                    
                    // Forensic Log for failed handshake
                    await AuditService.log(
                        'SECURITY',
                        'IDENTITY_MUTATION_ATTEMPT',
                        '',
                        `Identity handshake failed for ${sbUser.email}: RPC Error`,
                        'CRITICAL',
                        { error: error.message, code: error.code }
                    );

                    setCurrentUser(mapToUnprovisionedUser(sbUser)); 
                    updateLoadingState(false);
                    return true;
                }

                if (bundle?.identity_type === 'error') {
                    logger.error(`400 ERROR DETAIL: Schema mismatch or recursive RLS detected.`, null, 'AUTH_HANDSHAKE');
                    
                    await AuditService.log(
                        'SECURITY',
                        'IDENTITY_MUTATION_ATTEMPT',
                        '',
                        `Identity handshake protocol error for ${sbUser.email}`,
                        'CRITICAL',
                        { error_message: bundle.error_message, error_code: bundle.error_code }
                    );

                    // Set provisional to trigger ProvisioningGuard, which can show the DB error now.
                    const errorUser = mapToUnprovisionedUser(sbUser);
                    errorUser.companyName = `DB_ERR: ${bundle.error_message}`; 
                    setCurrentUser(errorUser); 
                    updateLoadingState(false);
                    return true;
                }

                if (!bundle) {
                    logger.warn(`PERFORMANCE_WARN: Zero-Identity for ${sbUser.email}. Running provisional resolution.`, null, 'AUTH_HANDSHAKE');
                    setCurrentUser(mapToUnprovisionedUser(sbUser)); 
                    updateLoadingState(false);
                    return true;
                }

                debugLog("[DEBUG_LOG] User Identity Bundle Received:", {
                    station_id: bundle.station_id,
                    identity_type: bundle.identity_type,
                    role: bundle.role
                });

                const isSystemUser = bundle.identity_type === 'system';

                // 2. SECURITY: Hard Application Boundary - Block System Users from Client Portal
                // EXCEPTION: Allow recovery sessions to bypass the boundary so Admins can reset passwords.
                const isRecoveryPath = window.location.pathname === '/reset-password' || window.location.hash.includes('type=recovery');
                
                if (isSystemUser && !isRecoveryPath) {
                    await AuditService.log(
                        'SECURITY',
                        'UNAUTHORIZED_ACCESS_ATTEMPT',
                        '',
                        `Blocked: System Administrator (${sbUser.email}) attempted to load the Client Portal.`,
                        'WARNING',
                        { auth_id: sbUser.id }
                    );
                    
                    logger.error("SECURITY: Application Boundary Enforced. System users cannot access the Client Portal. Forcing instant sign-out.", { auth_id: sbUser.id }, 'AUTH_BOUNDARY');
                    await supabase.auth.signOut();
                    setCurrentUser(null);
                    updateLoadingState(false);
                    return true;
                }

                // 2.1 SECURITY: Check is_active (Legacy check fallback)
                if (isSystemUser && !bundle.is_active) {
                    await AuditService.log(
                        'SECURITY',
                        'UNAUTHORIZED_ACCESS_ATTEMPT',
                        '',
                        `Blocked login attempt for deactivated administrator: ${sbUser.email}`,
                        'CRITICAL',
                        { auth_id: sbUser.id }
                    );
                    
                    logger.error("SECURITY: Account is deactivated. Signing out.", { auth_id: sbUser.id }, 'AUTH_BOUNDARY');
                    await supabase.auth.signOut();
                    setCurrentUser(null);
                    updateLoadingState(false);
                    return true;
                }

                // 3. MAP IDENTITY FROM BUNDLE
                const finalUser: User = {
                    authUserId: sbUser.id,
                    email: sbUser.email || bundle.email || '',
                    displayName: bundle.display_name || (isSystemUser ? 'System Guardian' : 'Portal User'),
                    photoURL: bundle.photo_url,
                    role: bundle.role,
                    authLevel: bundle.auth_level,
                    stationId: bundle.station_id || (isSystemUser ? 'SYSTEM_GOVERNANCE' : ''),
                    companyName: bundle.station_name || (isSystemUser ? 'IoTank Governance' : 'Organization Setup Pending'),
                    stationEmail: bundle.station_email,
                    logoUrl: bundle.logo_url,
                    address: bundle.address,
                    phoneNumber: bundle.phone_number,
                    siteIds: bundle.site_ids || [],
                    mfaEnabled: hasVerifiedMfa,
                    isSystemAccount: isSystemUser,
                    isProvisional: false, // [FIX] Explicitly clear provisional flag to unlock ProtectedRoute
                    createdAt: bundle.created_at ? new Date(bundle.created_at).getTime() : Date.now(),
                    lastLoginAt: Date.now()
                };

                // 4. CACHE: Persist for SWR (Stale-While-Revalidate) bootstrap
                // HIGH-001: Only cache non-sensitive identity fields — role/authLevel always come from DB
                try {
                    const safeCache: Partial<User> = {};
                    SAFE_CACHE_FIELDS.forEach(k => { (safeCache as any)[k] = (finalUser as any)[k]; });
                    localStorage.setItem(CACHE_KEY, JSON.stringify(safeCache));
                } catch (cacheErr) {
                    debugLog('[DEBUG_LOG] Failed to cache user profile:', cacheErr);
                }
            
                if (handshakeTimedOut) {
                    logger.warn("RECOVERY: Identity applied after timeout window.", null, 'AUTH_HANDSHAKE');
                } else {
                    debugLog("[DEBUG_LOG] SUCCESS: Identity bundle applied.");
                }
                isProvisionedRef.current = !!finalUser.stationId;
                setCurrentUser(finalUser);
                updateLoadingState(false);
                return true;
            };

            return await Promise.race([runQuery(), timeoutPromise]) as boolean;

        } catch (err) {
            logger.error('FATAL: Identity bundle fetch failed or timed out:', err, 'AUTH_HANDSHAKE');
            
            // Safety fallback: Treat as unprovisioned if we timed out/failed
            if (!currentUserAuthIdRef.current || currentUserAuthIdRef.current === sbUser.id) {
                isProvisionedRef.current = false;
                setCurrentUser(mapToUnprovisionedUser(sbUser));
            }
            updateLoadingState(false);
            return false;
        } finally {
            isEnrichingRef.current = null;
            enrichmentLockRef.current = false; // [FIX] Release lock
        }
    };

    // [RECOVERY DETECTOR]: Detect recovery fragments before routing or enrichment logic starts
    useEffect(() => {
        if (window.location.hash.includes('type=recovery') || window.location.hash.includes('recovery_token=')) {
            debugLog("[DEBUG_LOG] BOOT: Recovery hash detected. Immediate route to reset module.");
            const targetUrl = `${window.location.origin}/reset-password${window.location.hash}`;
            window.location.href = targetUrl;
        }
    }, []);

    const checkAndTriggerMFA = async (session: any): Promise<boolean> => {
        if (!session) return false;
        if (mfaChallengeRequired || mfaChallengeInProgressRef.current) return true;
        
        mfaChallengeInProgressRef.current = true;
        try {
            const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (error) throw error;

            debugLog(`[MFA] AAL Check: Current=${data.currentLevel}, Next=${data.nextLevel}`);

            if (data.currentLevel !== data.nextLevel && data.nextLevel === 'aal2') {
                const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
                if (factorsError) throw factorsError;

                const totpFactor = factors.totp.find(f => f.status === 'verified');
                if (totpFactor) {
                    debugLog(`[MFA] Verified TOTP factor found: ${totpFactor.id}. Triggering challenge.`);
                    
                    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
                    if (challengeError) throw challengeError;

                    mfaChallengeIdRef.current = challenge.id;
                    setMfaFactorId(totpFactor.id);
                    setMfaChallengeRequired(true);
                    updateLoadingState(false);
                    return true;
                }
            }
        } catch (err) {
            logger.warn('[MFA] Challenge initiation failed:', err, 'AUTH_MFA');
            mfaChallengeInProgressRef.current = false;
            updateLoadingState(false);
            throw err;
        }
        updateLoadingState(false);
        return false;
    };

    // Mutual Exclusion: Track the initial boot handshake
    const isBootingRef = useRef(true);

    useEffect(() => {
        
        // Safety Timeout: Force clear loading after 12 seconds to prevent permanent hang
        // Increased from 4s to 12s to prevent race conditions during DB cold-starts
        const safetyTimer = setTimeout(() => {
            if (isLoadingRef.current) {
                logger.warn("BOOT: Safety timeout triggered. Unlocking UI.", null, 'AUTH_CONTEXT');
                updateLoadingState(false);
                isBootingRef.current = false;
                handshakeInProgressRef.current = false;
                
                // [FIX] Force clear provisional state to unblock ProtectedRoute
                setCurrentUser(prev => prev ? { ...prev, isProvisional: false } : null);
            }
        }, 12000);

        const initializeAuth = async () => {
            if (handshakeInProgressRef.current) return;
            
            debugLog("[DEBUG_LOG] BOOT: Launching secure handshake...");
            isBootingRef.current = true;
            handshakeInProgressRef.current = true;

            // [RECOVERY SCAN]: Detect if the user landed on ANY page with a recovery hash
            // This is a fail-safe for when Supabase ignores the redirectTo parameter.
            if (window.location.hash.includes('type=recovery') || window.location.hash.includes('recovery_token=')) {
                debugLog("[DEBUG_LOG] BOOT: Recovery hash detected. Immediate route to reset module.");
                
                // Clear any potentially conflicting state
                isBootingRef.current = false;
                handshakeInProgressRef.current = false;
                
                const targetUrl = `${window.location.origin}/reset-password${window.location.hash}`;
                if (window.location.pathname !== '/reset-password') {
                    window.location.href = targetUrl;
                }
                updateLoadingState(false);
                return;
            }
            
            try {
                // Determine initial session immediately
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                // CATCH: Invalid Refresh Token or other session recovery failures
                if (sessionError) {
                    const isInvalidToken = sessionError.message?.toLowerCase().includes('refresh token') || 
                                          sessionError.message?.toLowerCase().includes('invalid token') ||
                                          (sessionError as any).status === 400;
                    
                    if (isInvalidToken) {
                        logger.warn("BOOT: Session data corrupted or expired. Performing silent purge.", null, 'AUTH_BOOT');
                        localStorage.removeItem(CACHE_KEY);
                        // Sign out but without throwing more errors
                        await supabase.auth.signOut().catch(() => {});
                        setCurrentUser(null);
                        updateLoadingState(false);
                        return;
                    }
                    throw sessionError;
                }

                if (session?.user) {
                    currentUserAuthIdRef.current = session.user.id;
                    
                    // 1. BOOT FROM CACHE: Immediate UI unlock if valid
                    const cachedData = localStorage.getItem(CACHE_KEY);
                    if (cachedData) {
                        try {
                            const parsed = JSON.parse(cachedData);
                            if (parsed.authUserId === session.user.id) {
                                debugLog("[DEBUG_LOG] BOOT: Restoring identity from local cache.");
                                // PREVENT PREMATURE REDIRECTS: Force provisional state on boot so ProtectedRoute shows a loader 
                                // instead of kicking the user out before the background DB handshake completes.
                                parsed.isProvisional = true;
                                parsed.role = 'viewer';
                                parsed.authLevel = 8;
                                setCurrentUser(parsed);
                                updateLoadingState(false);
                                isProvisionedRef.current = !!parsed.stationId;
                            }
                        } catch (e) {
                            logger.warn("BOOT: Cache invalid.", null, 'AUTH_BOOT');
                        }
                    }

                    // 2. BACKGROUND ENRICHMENT: Always verify against DB in background
                    if (window.location.pathname !== '/reset-password') {
                        const enrichmentPromise = enrichUserFromSupabase(session.user);
                        // If no cache hit, we MUST wait for the first enrichment to show anything
                        if (!cachedData) {
                            await enrichmentPromise;
                        }
                    }
                } else {
                    debugLog("[DEBUG_LOG] BOOT: No active session. Public flight mode.");
                    updateLoadingState(false);
                }
            } catch (error) {
                logger.error("BOOT: Handshake failed:", error, 'AUTH_BOOT');
                updateLoadingState(false);
            } finally {
                isBootingRef.current = false;
                handshakeInProgressRef.current = false;
                // Final safety: ensure loading state is derived correctly
                if (isLoadingRef.current) {
                    updateLoadingState(false);
                }
                clearTimeout(safetyTimer);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setTimeout(async () => {
                debugLog(`[DEBUG_LOG] AUTH_EVENT: ${event} (Booting: ${isBootingRef.current})`);

                if (event === 'PASSWORD_RECOVERY') {
                    debugLog("[DEBUG_LOG] AUTH_EVENT: Password recovery detected. Forcing navigation to reset module.");
                    updateLoadingState(false);
                    if (window.location.pathname !== '/reset-password') {
                        // Use href to ensure a clean state break
                        const target = `${window.location.origin}/reset-password${window.location.hash}`;
                        window.location.href = target;
                        return;
                    }
                    return;
                }

                if (window.location.pathname === '/reset-password') {
                    updateLoadingState(false);
                    return;
                }

                // Always handle sign out immediately
                if (event === 'SIGNED_OUT') {
                    debugLog("[DEBUG_LOG] AUTH_EVENT: Session terminated. Purging cache.");
                    localStorage.removeItem(CACHE_KEY);
                    currentUserAuthIdRef.current = null;
                    setCurrentUser(null);
                    updateLoadingState(false);
                    isBootingRef.current = false;
                    return;
                }

                // CRITICAL: Suppress background events (token refresh, user update) during boot.
                // NEVER suppress SIGNED_IN — the user may have just logged in while boot was running.
                // The isEnrichingRef concurrency lock inside enrichUserFromSupabase handles deduplication.
                if ((isBootingRef.current || handshakeInProgressRef.current) && event !== 'SIGNED_IN') {
                    debugLog(`[DEBUG_LOG] AUTH_EVENT: ${event} suppressed (Handshake in progress)`);
                    return;
                }

                const isSilentEvent = event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED';
                const isSameUser = session?.user?.id === currentUserAuthIdRef.current;

                // Handle sign-in events (including OAuth redirects)
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    if (session) {
                        const mfaTriggered = await checkAndTriggerMFA(session);
                        if (mfaTriggered) return;
                    }
                }

                // CRITICAL: isSameUser check should NOT block SIGNED_IN events if we are stuck
                // in an unprovisioned state, as we need to re-trigger enrichment.
                if (isSilentEvent || (isSameUser && event === 'SIGNED_IN' && isProvisionedRef.current)) {
                    debugLog(`[DEBUG_LOG] AUTH_EVENT: Skipping redundant update for ${event}`);
                    return;
                }

                if (session?.user) {
                    let unlockedByCache = false;
                    updateLoadingState(true);
                    
                    // PROVISIONAL IDENTITY: Set unprovisioned user immediately so ProtectedRoute
                    // sees a truthy currentUser while enrichment happens.
                    if (!currentUserAuthIdRef.current || currentUserAuthIdRef.current !== session.user.id) {
                        debugLog("[DEBUG_LOG] AUTH_EVENT: Setting provisional identity.");
                        
                        const cachedUser = localStorage.getItem(CACHE_KEY);
                        if (cachedUser) {
                            try {
                                const parsed = JSON.parse(cachedUser);
                                if (parsed.authUserId === session.user.id) {
                                    debugLog("[DEBUG_LOG] AUTH_EVENT: Loading identity from cache.");
                                    parsed.isProvisional = true;
                                    parsed.role = 'viewer';
                                    parsed.authLevel = 8;
                                    setCurrentUser(parsed);
                                    updateLoadingState(false);
                                    unlockedByCache = true;
                                } else {
                                setCurrentUser(mapToUnprovisionedUser(session.user));
                            }
                        } catch {
                            setCurrentUser(mapToUnprovisionedUser(session.user));
                        }
                    } else {
                        setCurrentUser(mapToUnprovisionedUser(session.user));
                    }
                    
                    currentUserAuthIdRef.current = session.user.id;
                }
                
                const enrichmentPromise = enrichUserFromSupabase(session.user);
                
                // If we already unlocked the UI with a provisional/cached identity,
                // do not block here. Let it finish in the background.
                // We use unlockedByCache to bypass the potentially stale 'loading' state.
                if (!unlockedByCache && isLoadingRef.current) {
                    await enrichmentPromise;
                    updateLoadingState(false);
                }
            } else {
                debugLog("[DEBUG_LOG] AUTH_EVENT: Clearing identity.");
                currentUserAuthIdRef.current = null;
                setCurrentUser(null);
                updateLoadingState(false);
            }
            }, 0);
        });

        return () => {
            clearTimeout(safetyTimer);
            subscription.unsubscribe();
        };
    }, []);

    // 4. NEWS LIFECYCLE: Only active for logged-in accounts
    useEffect(() => {
        if (currentUser && !loading) {
            NewsService.startListening();
            return () => NewsService.stopListening();
        }
    }, [currentUser, loading]);

    const signIn = async (email: string, password: string) => {
        updateLoadingState(true);
 
        // HIGH-005: Server-side brute-force check before attempting auth
        try {
            const { data: allowed, error: rateErr } = await supabase.rpc('check_auth_attempt', { p_email: email });
            if (!rateErr && allowed === false) {
                updateLoadingState(false);
                throw new Error('Account temporarily locked due to too many failed attempts. Please try again later.');
            }
        } catch (rateCheckErr: any) {
            // If the RPC itself fails, continue — don't block login due to rate limiter failure
            if (rateCheckErr.message?.includes('locked')) throw rateCheckErr;
            debugLog('[signIn] Rate check RPC unavailable, proceeding:', rateCheckErr.message);
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            // Record the failed attempt
            supabase.rpc('log_auth_attempt', { p_email: email, p_is_success: false }).then(({error: rpcErr}) => {
                if (rpcErr) debugLog('[signIn] log_auth_attempt failed', rpcErr);
            });
            updateLoadingState(false);
            throw error;
        }

        // Emit forensic log for unified_events subscription (toast/navbar mapping)
        if (data?.user) {
             const userMeta = data.user.user_metadata || {};
             const dbStationId = userMeta.station_id || '';
             AuditService.log(
                 'SECURITY',
                 'LOGIN',
                 dbStationId,
                 `User ${email} authenticated successfully.`,
                 'INFO',
                 { email, auth_id: data.user.id }
             ).catch(err => logger.warn('[Audit Log Failed]', err, 'AUTH_AUDIT'));
        }

        updateLoadingState(false);
        return data;
    };

    const verifyMFA = async (code: string) => {
        if (!mfaFactorId || !mfaChallengeIdRef.current) {
            throw new Error('No active MFA challenge. Please sign in again.');
        }
        const { error } = await supabase.auth.mfa.verify({
            factorId: mfaFactorId,
            challengeId: mfaChallengeIdRef.current,
            code,
        });
        if (error) throw error;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            // Mark as handshaking to prevent listener from double-enriching
            handshakeInProgressRef.current = true;
            await enrichUserFromSupabase(session.user);
            handshakeInProgressRef.current = false;
        }

        // MFA verified and user enriched — now we can safely clear the MFA UI state.
        // This prevents the LoginForm from navigating to /dashboard before the user's
        // authLevel is fully populated, which was causing the Unauthorized modal.
        setMfaChallengeRequired(false);
        mfaChallengeInProgressRef.current = false;
        setMfaFactorId(null);
        mfaChallengeIdRef.current = null;
    };

    const cancelMFAChallenge = () => {
        setMfaChallengeRequired(false);
        mfaChallengeInProgressRef.current = false;
        setMfaFactorId(null);
        mfaChallengeIdRef.current = null;
        supabase.auth.signOut();
    };

    const enrollMFA = async (): Promise<EnrollMFAResult> => {
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
        if (error) throw error;
        return {
            factorId: data.id,
            qrCode: data.totp.qr_code,
            secret: data.totp.secret,
        };
    };

    const verifyMFARegistration = async (factorId: string, code: string) => {
        // Enrollment verification requires a challenge to be created first
        const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeError) throw challengeError;

        const { error: verifyError } = await supabase.auth.mfa.verify({
            factorId,
            challengeId: challengeData.id,
            code,
        });
        if (verifyError) throw verifyError;

        // Refresh session to update AAL (Authenticator Assurance Level)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await enrichUserFromSupabase(session.user);
    };

    const unenrollMFA = async () => {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const allFactors = [...(factorsData?.totp || []), ...(factorsData?.phone || [])];
        if (allFactors.length === 0) throw new Error('No MFA factors found to remove.');
        
        for (const factor of allFactors) {
            const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
            if (error) throw error;
        }
        // Refresh user to update mfaEnabled flag
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) await enrichUserFromSupabase(session.user);
    };

    const signUp = async (email: string, password: string, displayName: string, stationId: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: displayName, role: 'viewer', station_id: stationId }
            }
        });
        if (error) throw error;
    };

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Redirect to root — the LoginForm's useEffect on currentUser
                // will then navigate authenticated users to /dashboard.
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    };

    const signOut = async () => {
        if (currentUser) {
            AuditService.log(
                'SECURITY',
                'LOGOUT',
                currentUser.stationId || '',
                `User ${currentUser.email} ended their session.`,
                'INFO',
                { email: currentUser.email, auth_id: currentUser.authUserId }
            ).catch(err => logger.warn('[Audit Log Failed]', err, 'AUTH_AUDIT'));
        }
        
        // [FIX] Force local cleanup immediately
        localStorage.removeItem(CACHE_KEY);
        
        try {
            // [FIX] Ensure logout cannot hang the UI if the network is disconnected
            await Promise.race([
                supabase.auth.signOut(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Signout timeout')), 3000))
            ]);
        } catch (e) {
            logger.warn('[AuthContext] Server signout timed out or failed. Forcing local logout.', e);
        } finally {
            window.location.href = '/';
        }
    };

    const resetPassword = async (email: string) => {
        const resetUrl = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
        });
        if (error) throw error;
    };

    const updateMasterPassword = async (password: string) => {
        if (!currentUser) throw new Error("Not authenticated");
        const { error } = await supabase.rpc('update_master_password', { new_password: password });
        if (error) throw error;
        setCurrentUser(prev => prev ? { ...prev, masterAccessPassword: 'set' } : null);
    };

    const verifySettingsPassword = async (password: string) => {
        const { data, error } = await supabase.rpc('verify_master_password', { test_password: password });
        
        if (error || !data) {
            if (!currentUser?.email) throw new Error("Verification failed.");
            const { error: signInErr } = await supabase.auth.signInWithPassword({ email: currentUser.email, password });
            if (signInErr) throw new Error("Verification failed. Invalid password.");
        }
    };

    const updateUser = async (data: Partial<User>) => {
        if (!currentUser) return;
        
        const dbUpdates: any = {};
        
        if (currentUser.isSystemAccount) {
            if (data.displayName) dbUpdates.full_name = data.displayName;
            if (data.photoURL) dbUpdates.photo_url = data.photoURL;
            
            if (Object.keys(dbUpdates).length > 0) {
                const { error: dbError } = await supabase
                    .from('system_users')
                    .update(dbUpdates)
                    .eq('auth_user_id', currentUser.authUserId);
                if (dbError) throw dbError;
            }
        } else {
            if (data.displayName) dbUpdates.display_name = data.displayName;
            if (data.photoURL) dbUpdates.photo_url = data.photoURL;
            if (data.address) dbUpdates.address = data.address;
            
            if (Object.keys(dbUpdates).length > 0) {
                const { error: dbError } = await supabase
                    .from('profiles')
                    .update(dbUpdates)
                    .eq('auth_user_id', currentUser.authUserId);
                if (dbError) throw dbError;
            }
        }

        const metadataPatch: Record<string, unknown> = {};
        if (data.displayName !== undefined) metadataPatch.full_name = data.displayName;
        if (data.companyName !== undefined) metadataPatch.company_name = data.companyName;
        if (data.address !== undefined) metadataPatch.address = data.address;
        if (data.photoURL !== undefined) metadataPatch.avatar_url = data.photoURL;
        
        if (Object.keys(metadataPatch).length > 0) {
            const { error: authUpdateError } = await supabase.auth.updateUser({ data: metadataPatch });
            if (authUpdateError) throw authUpdateError;
        }

        setCurrentUser(prev => prev ? { ...prev, ...data } : null);
    };

    const hasRole = (requiredRole: UserRole | UserRole[]): boolean => {
        if (!currentUser) return false;
        const roleHierarchy: Record<UserRole, number> = { viewer: 1, operator: 2, supervisor: 3, admin: 4, owner: 4 };
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        return roles.some(role => roleHierarchy[currentUser.role] >= roleHierarchy[role]);
    };

    const canSee = (requiredLevel: number): boolean => {
        return (currentUser?.authLevel ?? 99) <= requiredLevel;
    };

    const value = {
        currentUser,
        loading,
        mfaChallengeRequired,
        mfaFactorId,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        enrichUserFromSupabase,
        hasRole,
        canSee,
        updateMasterPassword,
        verifySettingsPassword,
        updateUser,
        enrollMFA,
        verifyMFARegistration,
        verifyMFA,
        unenrollMFA,
        cancelMFAChallenge,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

