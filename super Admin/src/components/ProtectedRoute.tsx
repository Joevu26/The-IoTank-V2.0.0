import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
    requiredLevel?: number;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredLevel = 4 }) => {
    const { user, systemUser, loading, canSee } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-primary" style={{
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
                            Establishing secure encrypted tunnel...
                        </p>
                    </div>

                    <div className="psych-progress-container">
                        <div className="psych-progress-bar"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!user || !systemUser) {
        return <Navigate to="/login" replace />;
    }

    if (!canSee(requiredLevel)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
