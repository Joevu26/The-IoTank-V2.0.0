/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/config/supabase';
import { User, UserRole } from '@/types';
import { AuditService } from '@/services/AuditService';

const CACHE_KEY = 'iotank_cached_user';

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
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [mfaChallengeRequired, setMfaChallengeRequired] = useState(false);
    const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
    // Stores the pending Supabase challenge ID during an MFA flow
    const mfaChallengeIdRef = useRef<string | null>(null);
    
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
            createdAt: Date.now(),
            lastLoginAt: Date.now()
        };
    };

    const enrichUserFromSupabase = async (sbUser: any) => {
        if (!sbUser?.id) return false;
        
        // Cooldown check: Prevent re-enriching the same user within 10s if we already tried
        const now = Date.now();
        if (currentUserAuthIdRef.current === sbUser.id && (now - lastEnrichmentAttemptRef.current < 10000)) {
            console.log(`[DEBUG_LOG] Enrichment cooldown active for ${sbUser.id}. Skipping.`);
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
            console.log(`[DEBUG_LOG] PROFILE: Launching optimized identity bundle handshake...`);
            let handshakeTimedOut = false;
            
            // TIMEOUT PROTECTION: Force-fail if a query hangs more than 15s (Safe for slow DB cold starts)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => {
                    handshakeTimedOut = true;
                    reject(new Error("Supabase query timeout"));
                }, 15000)
            );
            
            const runQuery = async () => {
                lastEnrichmentAttemptRef.current = Date.now(); // Record attempt start
                // 1. FAST BUNDLE: Fetch everything in one single database round-trip
                const { data: bundle, error } = await supabase.rpc('get_user_bundle_v2');

                if (error) {
                    console.error(`[DEBUG_LOG] FATAL: RPC Request failed for ${sbUser.email}:`, error);
                    
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
                    setLoading(false);
                    return true;
                }

                if (bundle?.identity_type === 'error') {
                    console.error(`[DEBUG_LOG] 400 ERROR DETAIL: Schema mismatch or recursive RLS detected.`);
                    
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
                    setLoading(false);
                    return true;
                }

                if (!bundle) {
                    console.warn(`[DEBUG_LOG] PERFORMANCE_WARN: Zero-Identity for ${sbUser.email}. Running provisional resolution.`);
                    setCurrentUser(mapToUnprovisionedUser(sbUser)); 
                    setLoading(false);
                    return true;
                }

                const isSystemUser = bundle.identity_type === 'system';

                // 2. SECURITY: Check is_active
                if (isSystemUser && !bundle.is_active) {
                    await AuditService.log(
                        'SECURITY',
                        'UNAUTHORIZED_ACCESS_ATTEMPT',
                        '',
                        `Blocked login attempt for deactivated administrator: ${sbUser.email}`,
                        'CRITICAL',
                        { auth_id: sbUser.id }
                    );
                    
                    console.error("[DEBUG_LOG] SECURITY: Account is deactivated. Signing out.");
                    await supabase.auth.signOut();
                    setCurrentUser(null);
                    setLoading(false);
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
                    companyName: bundle.station_name || (isSystemUser ? 'IoTank Governance' : 'Awaiting Config'),
                    logoUrl: bundle.logo_url,
                    address: bundle.address,
                    phoneNumber: bundle.phone_number,
                    siteIds: bundle.site_ids || [],
                    mfaEnabled: false, // Disabled until re-enabled in DB
                    isSystemAccount: isSystemUser,
                    createdAt: bundle.created_at ? new Date(bundle.created_at).getTime() : Date.now(),
                    lastLoginAt: Date.now()
                };

                // 4. CACHE: Persist for SWR (Stale-While-Revalidate) bootstrap
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify(finalUser));
                } catch (cacheErr) {
                    console.warn('[DEBUG_LOG] Failed to cache user profile:', cacheErr);
                }
            
                if (handshakeTimedOut) {
                    console.warn("[DEBUG_LOG] RECOVERY: Identity applied after timeout window.");
                } else {
                    console.log("[DEBUG_LOG] SUCCESS: Identity bundle applied.");
                }
                isProvisionedRef.current = !!finalUser.stationId;
                setCurrentUser(finalUser);
                updateLoadingState(false);
                return true;
            };

            return await Promise.race([runQuery(), timeoutPromise]) as boolean;

        } catch (err) {
            console.error('[DEBUG_LOG] FATAL: Identity bundle fetch failed or timed out:', err);
            
            // Safety fallback: Treat as unprovisioned if we timed out/failed
            if (!currentUserAuthIdRef.current || currentUserAuthIdRef.current === sbUser.id) {
                isProvisionedRef.current = false;
                setCurrentUser(mapToUnprovisionedUser(sbUser));
            }
            updateLoadingState(false);
            return false;
        } finally {
            isEnrichingRef.current = null;
        }
    };

    // MFA CHECK DISABLED — Re-enable when MFA factors are configured in DB
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const checkAndTriggerMFA = async (_unused?: unknown): Promise<boolean> => {
        return false;
    };

    // Mutual Exclusion: Track the initial boot handshake
    const isBootingRef = useRef(true);

    useEffect(() => {
        const isRecoveryFlow = window.location.pathname === '/reset-password';

        // Safety Timeout: Force clear loading after 12 seconds to prevent permanent hang
        // Increased from 4s to 12s to prevent race conditions during DB cold-starts
        const safetyTimer = setTimeout(() => {
            if (isLoadingRef.current) {
                console.warn("[DEBUG_LOG] BOOT: Safety timeout triggered. Unlocking UI.");
                updateLoadingState(false);
                isBootingRef.current = false;
                handshakeInProgressRef.current = false;
            }
        }, 12000);

        const initializeAuth = async () => {
            if (handshakeInProgressRef.current) return;
            
            console.log("[DEBUG_LOG] BOOT: Launching secure handshake...");
            isBootingRef.current = true;
            handshakeInProgressRef.current = true;
            
            try {
                // Determine initial session immediately
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;

                if (session?.user) {
                    currentUserAuthIdRef.current = session.user.id;
                    
                    // 1. BOOT FROM CACHE: Immediate UI unlock if valid
                    const cachedData = localStorage.getItem(CACHE_KEY);
                    if (cachedData) {
                        try {
                            const parsed = JSON.parse(cachedData);
                            if (parsed.authUserId === session.user.id) {
                                console.log("[DEBUG_LOG] BOOT: Restoring identity from local cache.");
                                setCurrentUser(parsed);
                                setLoading(false);
                                isProvisionedRef.current = !!parsed.stationId;
                            }
                        } catch (e) {
                            console.warn("[DEBUG_LOG] BOOT: Cache invalid.");
                        }
                    }

                    // 2. BACKGROUND ENRICHMENT: Always verify against DB in background
                    if (!isRecoveryFlow) {
                        const enrichmentPromise = enrichUserFromSupabase(session.user);
                        // If no cache hit, we MUST wait for the first enrichment to show anything
                        if (!cachedData) {
                            await enrichmentPromise;
                        }
                    }
                } else {
                    console.log("[DEBUG_LOG] BOOT: No active session. Public flight mode.");
                    setLoading(false);
                }
            } catch (error) {
                console.error("[DEBUG_LOG] BOOT: Handshake failed:", error);
                setLoading(false);
            } finally {
                isBootingRef.current = false;
                handshakeInProgressRef.current = false;
                clearTimeout(safetyTimer);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log(`[DEBUG_LOG] AUTH_EVENT: ${event} (Booting: ${isBootingRef.current})`);

            if (event === 'PASSWORD_RECOVERY' || isRecoveryFlow) {
                setLoading(false);
                return;
            }

            // Always handle sign out immediately
            if (event === 'SIGNED_OUT') {
                console.log("[DEBUG_LOG] AUTH_EVENT: Session terminated. Purging cache.");
                localStorage.removeItem(CACHE_KEY);
                currentUserAuthIdRef.current = null;
                setCurrentUser(null);
                setLoading(false);
                isBootingRef.current = false;
                return;
            }

            // CRITICAL: Suppress background events (token refresh, user update) during boot.
            // NEVER suppress SIGNED_IN — the user may have just logged in while boot was running.
            // The isEnrichingRef concurrency lock inside enrichUserFromSupabase handles deduplication.
            if ((isBootingRef.current || handshakeInProgressRef.current) && event !== 'SIGNED_IN') {
                console.log(`[DEBUG_LOG] AUTH_EVENT: ${event} suppressed (Handshake in progress)`);
                return;
            }

            const isSilentEvent = event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED';
            const isSameUser = session?.user?.id === currentUserAuthIdRef.current;

            // Handle sign-in events (including OAuth redirects)
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session) {
                    const mfaTriggered = await checkAndTriggerMFA();
                    if (mfaTriggered) return;
                }
            }

            // CRITICAL: isSameUser check should NOT block SIGNED_IN events if we are stuck
            // in an unprovisioned state, as we need to re-trigger enrichment.
            if (isSilentEvent || (isSameUser && event === 'SIGNED_IN' && isProvisionedRef.current)) {
                console.log(`[DEBUG_LOG] AUTH_EVENT: Skipping redundant update for ${event}`);
                return;
            }

            if (session?.user) {
                let unlockedByCache = false;
                setLoading(true);
                
                // PROVISIONAL IDENTITY: Set unprovisioned user immediately so ProtectedRoute
                // sees a truthy currentUser while enrichment happens.
                if (!currentUserAuthIdRef.current || currentUserAuthIdRef.current !== session.user.id) {
                    console.log("[DEBUG_LOG] AUTH_EVENT: Setting provisional identity.");
                    
                    const cachedUser = localStorage.getItem(CACHE_KEY);
                    if (cachedUser) {
                        try {
                            const parsed = JSON.parse(cachedUser);
                            if (parsed.authUserId === session.user.id) {
                                console.log("[DEBUG_LOG] AUTH_EVENT: Loading identity from cache.");
                                setCurrentUser(parsed);
                                setLoading(false);
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
                if (!unlockedByCache && loading) {
                    await enrichmentPromise;
                    setLoading(false);
                }
            } else {
                console.log("[DEBUG_LOG] AUTH_EVENT: Clearing identity.");
                currentUserAuthIdRef.current = null;
                setCurrentUser(null);
                setLoading(false);
            }
        });

        return () => {
            clearTimeout(safetyTimer);
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setLoading(false);
            throw error;
        }

        // Emit forensic log for unified_events subscription (toast/navbar mapping)
        if (data?.user) {
             const userMeta = data.user.user_metadata || {};
             const dbStationId = userMeta.station_id || '';
             AuditService.log(
                 'AUTH',
                 'LOGIN',
                 dbStationId,
                 `User ${email} authenticated successfully.`,
                 'INFO',
                 { email, auth_id: data.user.id }
             ).catch(err => console.warn('[Audit Log Failed]', err));
        }

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
        
        // MFA verified — now enrich the user and complete login
        setMfaChallengeRequired(false);
        setMfaFactorId(null);
        mfaChallengeIdRef.current = null;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            // Mark as handshaking to prevent listener from double-enriching
            handshakeInProgressRef.current = true;
            await enrichUserFromSupabase(session.user);
            handshakeInProgressRef.current = false;
        }
    };

    const cancelMFAChallenge = () => {
        setMfaChallengeRequired(false);
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
                'AUTH',
                'LOGOUT',
                currentUser.stationId || '',
                `User ${currentUser.email} ended their session.`,
                'INFO',
                { email: currentUser.email, auth_id: currentUser.authUserId }
            ).catch(err => console.warn('[Audit Log Failed]', err));
        }
        await supabase.auth.signOut();
        window.location.href = '/';
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
        return (currentUser?.authLevel || 99) <= requiredLevel;
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
