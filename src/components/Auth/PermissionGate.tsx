import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';

interface PermissionGateProps {
    children: React.ReactNode;
    level?: number;
    role?: UserRole | UserRole[];
    fallback?: React.ReactNode;
}

/**
 * PermissionGate
 * Highly reusable component for granular RBAC enforcement.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({ 
    children, 
    level, 
    role, 
    fallback = null 
}) => {
    const { canSee, hasRole } = useAuth();

    let hasAccess = true;

    if (level !== undefined) {
        hasAccess = hasAccess && canSee(level);
    }

    if (role !== undefined) {
        hasAccess = hasAccess && hasRole(role);
    }

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
