/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/config/supabase';
import { User, UserRole } from '@/types';

export interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<any>;
    signUp: (email: string, password: string, displayName: string, stationId: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    hasRole: (requiredRole: UserRole | UserRole[]) => boolean;
    canSee: (level: number) => boolean;
    updateMasterPassword: (password: string) => Promise<void>;
    verifySettingsPassword: (password: string) => Promise<void>;
    updateUser: (data: Partial<User>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Concurrency Lock: Prevent multiple enrichment calls from overlapping
    const isEnrichingRef = useRef<string | null>(null);
    const currentUserAuthIdRef = useRef<string | null>(null);

    const mapToUser = (sbUser: SupabaseUser, dbUser: any, level: number, isSystemUser: boolean = false): User => {
        const roleMapping: Record<string, UserRole> = {
            'super_admin': 'admin',
            'admin_helper': 'admin',
            'support_staff': 'supervisor',
            'analyst': 'viewer'
        };

        const role = isSystemUser ? (roleMapping[dbUser.role] || 'admin') : (dbUser.role as UserRole);
        const joinData = dbUser.fuel_stations;
        const stationData = Array.isArray(joinData) ? joinData[0] : joinData;

        return {
            authUserId: sbUser.id,
            email: sbUser.email || dbUser.email,
            displayName: dbUser.display_name || sbUser.user_metadata?.full_name || (isSystemUser ? 'System Guardian' : 'Portal User'),
            photoURL: dbUser.photo_url || sbUser.user_metadata?.avatar_url,
            role: role,
            authLevel: level,
            stationId: dbUser.station_id || (isSystemUser ? 'SYSTEM_GOVERNANCE' : ''),
            companyName: stationData?.station_name || dbUser.company_name || sbUser.user_metadata?.company_name || (isSystemUser ? 'IoTank Governance' : 'Awaiting Config'),
            logoUrl: stationData?.logo_url || (isSystemUser ? '/iotank-logo.png' : undefined),
            address: dbUser.address || (stationData?.county ? { state: stationData.county } : sbUser.user_metadata?.address),
            phoneNumber: dbUser.phone_number || sbUser.user_metadata?.phone,
            siteIds: dbUser.site_ids || [],
            mfaEnabled: !!dbUser.mfa_enabled,
            isSystemAccount: isSystemUser,
            createdAt: dbUser.created_at ? new Date(dbUser.created_at).getTime() : Date.now(),
            lastLoginAt: Date.now()
        };
    };

    const mapToUnprovisionedUser = (sbUser: SupabaseUser): User => {
        return {
            authUserId: sbUser.id,
            email: sbUser.email || '',
            displayName: sbUser.user_metadata?.full_name || 'Provisioning User',
            role: 'viewer', // Low privilege default
            authLevel: 7,   // Minimum level
            stationId: '',  // TRiggers ProvisioningGuard
            siteIds: [],
            mfaEnabled: false,
            createdAt: Date.now(),
            lastLoginAt: Date.now()
        };
    };

    const enrichUserFromSupabase = async (sbUser: SupabaseUser): Promise<void> => {
        // Prevent concurrent enrichment for the same user session
        if (isEnrichingRef.current === sbUser.id) {
            console.log(`[DEBUG_LOG] Enrichment already in progress for ${sbUser.id}. Skipping concurrent call.`);
            return;
        }
        
        isEnrichingRef.current = sbUser.id;
        
        try {
            const isRecoveryFlow = window.location.pathname === '/reset-password';
            let isSystemUser = false;
            let enrichedDbUser: any = null;

            console.log(`[DEBUG_LOG] Fetching profile for UID: ${sbUser.id}`);
            
            // 1. Fetch profile - try auth_user_id first
            let { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*, fuel_stations(station_name, logo_url, county)')
                .eq('auth_user_id', sbUser.id)
                .maybeSingle();

            // Fallback for transitionary period where column might be 'supabase_uid'
            if (!profileData && !profileError) {
                console.log("[DEBUG_LOG] Profile not found by auth_user_id, trying supabase_uid...");
                const { data: fallbackProfile, error: fallbackError } = await supabase
                    .from('profiles')
                    .select('*, fuel_stations(station_name, logo_url, county)')
                    .eq('supabase_uid', sbUser.id)
                    .maybeSingle();
                
                if (!fallbackError && fallbackProfile) {
                    profileData = fallbackProfile;
                }
            }

            if (profileError) console.error("[DEBUG_LOG] Profile fetch error:", profileError);
            enrichedDbUser = profileData;

            // 2. Check system_users if no client profile
            if (!enrichedDbUser) {
                console.log("[DEBUG_LOG] No client profile found, checking system_users...");
                let { data: sysUser, error: sysError } = await supabase
                    .from('system_users')
                    .select('*')
                    .eq('auth_user_id', sbUser.id)
                    .maybeSingle();
                
                // Fallback for system_users uid column
                if (!sysUser && !sysError) {
                    console.log("[DEBUG_LOG] System user not found by auth_user_id, trying supabase_uid/firebase_uid...");
                    const { data: fallbackSys } = await supabase
                        .from('system_users')
                        .select('*')
                        .or(`supabase_uid.eq.${sbUser.id},firebase_uid.eq.${sbUser.id}`)
                        .maybeSingle();
                    if (fallbackSys) sysUser = fallbackSys;
                }

                if (sysError) console.error("[DEBUG_LOG] System user check error:", sysError);
                if (sysUser) {
                    enrichedDbUser = sysUser;
                    isSystemUser = true;
                }
            }

            if (!enrichedDbUser) {
                if (isRecoveryFlow) {
                    setLoading(false);
                    return;
                }
                
                console.warn(`[DEBUG_LOG] Profile enrichment: No database record found for ${sbUser.email}. User persists in 'unprovisioned' state.`);
                // CRITICAL FIX: To prevent logout on refresh, we set a partial user object.
                // This keeps 'currentUser' truthy so ProtectedRoute doesn't redirect to /login.
                // The ProvisioningGuard will then catch the empty stationId and show the setup screen.
                setCurrentUser(mapToUnprovisionedUser(sbUser)); 
                setLoading(false);
                return;
            }

            // 3. SECURITY: Check is_active
            if (isSystemUser && enrichedDbUser && !enrichedDbUser.is_active) {
                console.error("[DEBUG_LOG] Account is deactivated. Signing out.");
                await supabase.auth.signOut();
                setCurrentUser(null);
                setLoading(false);
                return;
            }

            // 4. Fetch auth level
            const { data: levelData, error: rpcError } = await supabase.rpc('get_auth_level');
            if (rpcError) console.error("Error calling get_auth_level RPC:", rpcError);

            const finalUser = mapToUser(sbUser, enrichedDbUser, levelData || 7, isSystemUser);
            
            console.log("[DEBUG_LOG] SUCCESS: User Enrichment Complete.");
            console.table({
                email: finalUser.email,
                role: finalUser.role,
                stationId: finalUser.stationId,
                company: finalUser.companyName,
                isSystem: finalUser.isSystemAccount
            });

            setCurrentUser(finalUser);

        } catch (err) {
            console.error('[DEBUG_LOG] FATAL: Supabase profile enrichment failed:', err);
        } finally {
            isEnrichingRef.current = null;
        }
    };

    // Mutual Exclusion: Track the initial boot handshake
    const isBootingRef = useRef(true);

    useEffect(() => {
        const isRecoveryFlow = window.location.pathname === '/reset-password';
        let initialResolved = false;

        // Safety Timeout: Force clear loading after 15 seconds to prevent permanent hang
        const safetyTimer = setTimeout(() => {
            if (loading) {
                console.warn("[DEBUG_LOG] BOOT: Safety timeout triggered. Forcing loading to false.");
                setLoading(false);
                isBootingRef.current = false;
            }
        }, 15000);

        const initializeAuth = async () => {
            console.log("[DEBUG_LOG] BOOT: Initializing secure handshake...");
            isBootingRef.current = true;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session?.user) {
                    console.log("[DEBUG_LOG] BOOT: Active session detected. Holding identity...");
                    currentUserAuthIdRef.current = session.user.id;
                    
                    // PROGRESSIVE IDENTITY: Mark as authenticated immediately to stop ProtectedRoute redirect
                    setCurrentUser(mapToUnprovisionedUser(session.user));
                    
                    if (!isRecoveryFlow) {
                        await enrichUserFromSupabase(session.user);
                    }
                } else {
                    console.log("[DEBUG_LOG] BOOT: No active session found.");
                }
            } catch (error) {
                console.error("[DEBUG_LOG] BOOT: Fatal initialization error:", error);
            } finally {
                console.log("[DEBUG_LOG] BOOT: Handshake complete.");
                initialResolved = true;
                isBootingRef.current = false;
                setLoading(false);
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
                console.log("[DEBUG_LOG] AUTH_EVENT: Session terminated.");
                currentUserAuthIdRef.current = null;
                setCurrentUser(null);
                setLoading(false);
                isBootingRef.current = false;
                return;
            }

            // CRITICAL: During initial boot, the initializeAuth function is the owner.
            // We ignore INITIAL_SESSION and common boot-time events here to prevent race conditions.
            if (isBootingRef.current && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
                console.log(`[DEBUG_LOG] AUTH_EVENT: Deferring ${event} to boot sequence.`);
                return;
            }

            const isSilentEvent = event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED';
            const isSameUser = session?.user?.id === currentUserAuthIdRef.current;

            if (isSilentEvent || (isSameUser && event === 'SIGNED_IN')) {
                console.log(`[DEBUG_LOG] AUTH_EVENT: Skipping redundant update for ${event}`);
                return;
            }

            if (session?.user) {
                setLoading(true);
                currentUserAuthIdRef.current = session.user.id;
                await enrichUserFromSupabase(session.user);
                setLoading(false);
            } else {
                if (initialResolved) {
                    console.log("[DEBUG_LOG] AUTH_EVENT: Clearing identity.");
                    currentUserAuthIdRef.current = null;
                    setCurrentUser(null);
                    setLoading(false);
                }
            }
        });

        return () => {
            clearTimeout(safetyTimer);
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await enrichUserFromSupabase(data.user);
        return data;
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
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) throw error;
    };

    const signOut = async () => {
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
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        hasRole,
        canSee,
        updateMasterPassword,
        verifySettingsPassword,
        updateUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
