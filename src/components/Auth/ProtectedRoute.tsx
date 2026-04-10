/* eslint-disable react/no-unescaped-entities */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';

import { ProvisioningGuard } from './ProvisioningGuard';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: UserRole | UserRole[];
    requiredLevel?: number;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requiredRole,
    requiredLevel,
}) => {
    const { currentUser, loading, hasRole, canSee } = useAuth();
    const location = useLocation();

    const [loadingTimeout, setLoadingTimeout] = React.useState(false);

    React.useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => setLoadingTimeout(true), 8000);
            return () => clearTimeout(timer);
        } else {
            setLoadingTimeout(false);
        }
    }, [loading]);

    if (loading) {
        return (
            <div className="flex h-screen w-screen flex-col items-center justify-center" style={{ 
                background: 'var(--color-bg-primary)',
                backgroundImage: 'radial-gradient(circle at center, rgba(0, 212, 255, 0.05) 0%, transparent 70%)'
            }}>
                <div className="flex flex-col items-center gap-8">
                    <div className="advanced-loader">
                        <div className="loader-pulse"></div>
                        <div className="loader-ring"></div>
                        <div className="loader-ring"></div>
                        <div className="loader-ring"></div>
                    </div>
                    
                    <div className="text-center mt-2">
                        <p className="text-primary font-semibold text-lg mb-1" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Verifying system clearance
                        </p>
                        <p className="text-secondary text-sm animate-pulse">
                            Synchronizing security protocols...
                        </p>
                    </div>

                    <div className="psych-progress-container">
                        <div className="psych-progress-bar"></div>
                    </div>

                    <div style={{
                        width: '360px',
                        height: '240px',
                        overflow: 'hidden',
                        position: 'relative',
                        borderRadius: '24px',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                        border: '8px solid rgba(255,255,255,0.8)'
                    }}>
                        <video
                            src="https://v1.pinimg.com/videos/iht/expMp4/59/24/45/592445ca657c7225e76d41bf1d4c17aa_720w.mp4"
                            autoPlay
                            muted
                            loop
                            playsInline
                            style={{
                                width: '400px',
                                height: 'auto',
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                pointerEvents: 'none'
                            }}
                            onCanPlay={(e) => (e.currentTarget.muted = true)}
                        />
                    </div>
                </div>

                {loadingTimeout && (
                    <div className="mt-8 animate-fade-in text-center p-6 bg-white rounded-xl shadow-lg border border-slate-100 max-w-sm">
                        <p className="text-xs text-secondary mb-4">Establishing secure connection is taking longer than expected.</p>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => window.location.reload()}
                        >
                            Force Re-Sync
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (!currentUser) {
        // Redirect to login, save attempted location
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Wrap the legitimate children in a ProvisioningGuard to stop white-screen crashes
    // if the user is authenticated but not yet fully provisioned.
    return (
        <ProvisioningGuard>
            {/* 1. Check specific roles if provided */}
            {requiredRole && !hasRole(requiredRole) ? (
                <div className="flex flex-col items-center justify-center" style={{ minHeight: '100vh', padding: '2rem' }}>
                    <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
                    <p className="text-secondary mb-6">
                        You don't have permission to access this page.
                    </p>
                    <a href="/dashboard" className="btn btn-primary">
                        Return to Dashboard
                    </a>
                </div>
            ) : requiredLevel !== undefined && !canSee(requiredLevel) ? (
                <Navigate to="/dashboard" replace />
            ) : (
                <>{children}</>
            )}
        </ProvisioningGuard>
    );
};
