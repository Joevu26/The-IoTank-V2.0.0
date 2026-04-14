import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    MdDashboard,
    MdStorage,
    MdBarChart,
    MdTrendingUp,
    MdWarning,
    MdAssessment,
    MdSecurity,
    MdSettings,
    MdHelp,
    MdOutlineEventNote,
    MdCreditCard,
} from 'react-icons/md';

import { FiHome, FiTruck, FiShield } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { enableGovernanceConsole } from '@/config/supabase';
import './Sidebar.css';

interface SidebarProps {
    collapsed: boolean;
    mobileOpen: boolean;
    closeMobile: () => void;
    onActivity?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    collapsed,
    mobileOpen,
    closeMobile,
    onActivity,
}) => {

    const { t } = useTranslation();
    const { currentUser, canSee } = useAuth();
    const navigate = useNavigate();

    // ── RBAC DEFINITION ────────────────────────────────────────────────────────
    // Level 5 (Owner): Everything
    // Level 6 (Supervisor): Core Ops, Monitoring, No Billing/Users
    // Level 7 (Operator): Monitor Only, No Reports/Settings
    // ── ─────────────────────────────────────────────────────────────────────────

    const menuItems = [
        { name: 'Core Operations', isSection: true, path: 'sec-core', level: 7 },
        { name: t('dashboard'), path: '/dashboard', icon: <MdDashboard />, level: 7 },
        { name: t('inventory'), path: '/inventory', icon: <MdStorage />, level: 7 },
        { name: 'Deliveries', path: '/deliveries', icon: <FiTruck />, level: 6 },
        { name: t('analytics'), path: '/analytics', icon: <MdBarChart />, level: 6 },

        { name: 'Intelligence & Monitoring', isSection: true, path: 'sec-intel', level: 7 },
        { name: 'Event Log', path: '/event-log', icon: <MdOutlineEventNote />, level: 6 },
        { name: t('market'), path: '/market', icon: <MdTrendingUp />, level: 7 },
        { name: t('alerts'), path: '/alerts', icon: <MdWarning />, level: 7 },
        { name: 'Forensic Security', path: '/security', icon: <FiShield />, level: 6 },
        { name: 'Doc Intelligence', path: '/analysis', icon: <MdAssessment />, level: 6 },
        { name: t('reporting'), path: '/reporting', icon: <MdAssessment />, level: 6 },

        { name: 'Administration', isSection: true, path: 'sec-admin', level: 6 },
        { name: 'User Management', path: '/users', icon: <MdSecurity />, level: 5 },
        { name: 'Billing & Usage', path: '/billing', icon: <MdCreditCard />, level: 5 },
        ...(enableGovernanceConsole ? [{ name: t('governance'), path: '/governance', icon: <MdSecurity />, level: 5 }] : []),
        { name: t('settings'), path: '/settings', icon: <MdSettings />, level: 6 },
        { name: t('help'), path: '/help', icon: <MdHelp />, level: 7 },
    ].filter(item => canSee(item.level));



    return (
        <aside
            className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
            onMouseMove={onActivity}
            onTouchMove={onActivity}
            onTouchStart={onActivity}
            onClick={onActivity}
            onScroll={onActivity}
        >
            {/* Organization Identity Layer (Governance) */}
            <div
                className={`operator-identity-module ${collapsed ? 'collapsed' : ''}`}
                onClick={() => navigate('/settings?tab=company')}
                title="Manage Organization Identity"
            >
                <div className="avatar-container">
                    <div className="operator-photo-placeholder neumorphic-rim overflow-hidden flex items-center justify-center">
                        {currentUser?.logoUrl ? (
                            <img src={currentUser.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <FiHome className="company-logo-icon" />
                        )}
                    </div>
                </div>
                {(!collapsed || mobileOpen) && (
                    <div className="operator-meta animate-fade-in">
                        <div className="flex items-center gap-2">
                            <span className="op-name">{currentUser?.companyName || 'IoTank'}</span>
                        </div>
                        <span className="op-role uppercase tracking-tighter opacity-80">{currentUser?.address?.state || (currentUser?.isSystemAccount ? 'Cloud Services' : 'STATION LOCATION')}</span>
                    </div>
                )}
            </div>

            <nav className="sidebar-nav">
                <ul>
                    {menuItems.map((item, index) => {
                        if (item.isSection) {
                            // Only show section if there is at least one non-section item following it 
                            // before the next section begins
                            const nextItems = menuItems.slice(index + 1);
                            const hasVisibleItemsInSection = nextItems.length > 0 && 
                                (nextItems.findIndex(ni => ni.isSection) === -1 || nextItems.findIndex(ni => ni.isSection) > 0);
                            
                            if (!hasVisibleItemsInSection) return null;

                            return (
                                <li key={item.path} className={`nav-section ${(collapsed && !mobileOpen) ? 'hidden' : ''}`}>
                                    <span className="nav-section-label">{item.name}</span>
                                </li>
                            );
                        }

                        return (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                    onClick={closeMobile}
                                    title={collapsed && !mobileOpen ? item.name : ''}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    {(!collapsed || mobileOpen) && <span className="nav-text">{item.name}</span>}
                                    {(collapsed && !mobileOpen) && <span className="nav-tooltip">{item.name}</span>}
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </nav>

        </aside>
    );
};
