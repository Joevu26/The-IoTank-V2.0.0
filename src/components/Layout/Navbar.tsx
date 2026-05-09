import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAlerts, resolveAlert } from '@/hooks/useSupabase';
import { supabase } from '@/config/supabase';
import { Alert } from '@/types';
import {
    MdSearch,
    MdNotifications,
    MdPerson,
    MdLogout,
    MdCheck,
    MdSettings,
    MdMenu,
    MdElectricBolt,
    MdCircle
} from 'react-icons/md';

import './Navbar.css';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useModals } from '@/contexts/ModalContext';
import { sanitizeIds } from '@/utils/formatUtils';

import { DeliveryModal } from '../QuickActions/DeliveryModal';
import { ShiftCloseModal } from '../QuickActions/ShiftCloseModal';
import { ShiftOpenModal } from '../QuickActions/ShiftOpenModal';
import { ReportModal } from '../QuickActions/ReportModal';
import { OrderModal } from '../QuickActions/OrderModal';
import { Toast } from '../Common/Toast';
import { useShiftStatus } from '@/hooks/useShiftStatus';
import { ViewOnlyNoticeModal } from '../Common/ViewOnlyNoticeModal';
import { FiEye, FiLock, FiClock, FiShield, FiTrendingDown, FiUserPlus, FiInfo, FiBell } from 'react-icons/fi';
import { NotificationService } from '@/services/NotificationService';
import { DeviceCommandService } from '@/services/DeviceCommandService';
import { FiActivity } from 'react-icons/fi';
import tankIQRobot from '@/assets/tankiq-robot.png';

interface NavbarProps {
    onToggleSidebar: () => void;
    onToggleTankIQ: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onToggleTankIQ }) => {
    const { currentUser, signOut } = useAuth();
    const stationId = currentUser?.stationId || '';
    const navigate = useNavigate();

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showQuickActions, setShowQuickActions] = useState(false);
    
    const { status: shiftStatus, isViewOnly } = useShiftStatus();
    const [showNoticeModal, setShowNoticeModal] = useState(false);

    const [toast, setToast] = useState<{ 
        message: string, 
        type: 'info' | 'warning' | 'success' | 'error',
        actionLabel?: string,
        onAction?: () => void
    } | null>(null);
    
    const { activeModal, openModal, closeModal } = useModals();
    
    // Derived states for local UI
    const isDeliveryModalOpen = activeModal === 'delivery';
    const isShiftCloseModalOpen = activeModal === 'shift-close';
    const isShiftOpenModalOpen = activeModal === 'shift-open';
    const isReportModalOpen = activeModal === 'report';
    const isOrderModalOpen = activeModal === 'order';

    const [currentTime, setCurrentTime] = useState(new Date());
    const [isOnline, setIsOnline] = useState(true);
    const [pendingCommandCount, setPendingCommandCount] = useState(0);
    const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
    const [hiddenAlerts, setHiddenAlerts] = useState<Set<string>>(new Set());

    const [unifiedEvents, setUnifiedEvents] = useState<any[]>([]);

    // Fetch alerts for the notification tray
    const { alerts } = useAlerts(stationId, false);
    const unreadAlerts = alerts.filter((a: any) => !a.resolved && !hiddenAlerts.has(a.id));

    // Use click outside hooks
    const profileMenuRef = useClickOutside(() => setShowProfileMenu(false));
    const notificationRef = useClickOutside(() => setShowNotifications(false));
    const quickActionsRef = useClickOutside(() => setShowQuickActions(false));

    const handleResolve = async (e: React.MouseEvent, alertId: string) => {
        e.stopPropagation();
        if (resolvingIds.has(alertId)) return;
        
        // Optimistic UI: Hide immediately
        setHiddenAlerts(prev => new Set(prev).add(alertId));
        setResolvingIds(prev => new Set(prev).add(alertId));
        
        try {
            if (!currentUser) return;
            await resolveAlert(alertId, currentUser.authUserId);
        } catch (err) {
            console.error('Error resolving alert:', err);
            // Rollback on failure
            setResolvingIds(prev => {
                const next = new Set(prev);
                next.delete(alertId);
                return next;
            });
        }
    };

    const handleResolveEvent = async (e: React.MouseEvent, eventId: string) => {
        e.stopPropagation();
        if (resolvingIds.has(eventId)) return;

        // Save current state for rollback
        const previousEvents = [...unifiedEvents];
        
        // Optimistic UI: Remove from list immediately
        setUnifiedEvents(prev => prev.filter(ev => ev.id !== eventId));
        setResolvingIds(prev => new Set(prev).add(eventId));

        try {
            // [PERSISTENCE PROTOCOL]: Handle Forensic Audit Events
            // 1. Check if the event has a source record (e.g., an alert) in metadata
            const event = (unifiedEvents as any[]).find(ev => ev.id === eventId);
            const sourceTable = event?.metadata?.table;
            const sourceId = event?.metadata?.new?.id || event?.metadata?.old?.id;

            if (sourceTable === 'alerts' && sourceId) {
                await supabase
                    .from('alerts')
                    .update({ 
                        is_resolved: true,
                        resolved_at: new Date().toISOString(),
                        resolved_by: currentUser?.authUserId || 'SYSTEM'
                    })
                    .eq('id', sourceId);
            }

            // 2. Resolve the event itself in unified_events
            // Note: Requires migration 20260508000000_allow_event_resolution.sql to be applied
            const { error } = await supabase
                .from('unified_events')
                .update({ is_resolved: true })
                .eq('id', eventId);
            
            if (error) {
                // If it fails (e.g. migration not applied), we keep the optimistic UI state 
                // but log the error for diagnostics.
                console.warn('[Navbar] Failed to persist event resolution. Forensic logs may remain immutable.', error);
            }
        } catch (err: any) {
            console.error('Error resolving event:', err);
            
            // Rollback on failure: Restore the event to the UI
            setUnifiedEvents(previousEvents);
            
            if (err?.code === 'PGRST202') {
                setToast({
                    message: 'Database security schema is synchronizing. Please try again in 1-2 minutes.',
                    type: 'warning'
                });
            } else {
                setToast({
                    message: 'Forensic Link Error: Could not synchronize acknowledgement. Please try again.',
                    type: 'error'
                });
            }
        } finally {
            setResolvingIds(prev => {
                const next = new Set(prev);
                next.delete(eventId);
                return next;
            });
        }
    };

    // Monitor for pending hardware instructions
    useEffect(() => {
        const updatePending = () => {
            const pending = DeviceCommandService.getLocalPendingIds();
            setPendingCommandCount(pending.length);
        };
        updatePending();

        const pCount = DeviceCommandService.getLocalPendingIds().length;
        if (pCount > 0) {
            setToast({
                message: `Session Recovery: ${pCount} hardware command(s) are still pending.`,
                type: 'warning',
                actionLabel: 'View Queue',
                onAction: () => navigate('/settings?tab=devices')
            });
        }

        const interval = setInterval(updatePending, 2000);
        return () => clearInterval(interval);
    }, [navigate]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        const hasSeenNotice = sessionStorage.getItem('iotank_view_only_notice_shown');
        if (isViewOnly && !hasSeenNotice) {
            setShowNoticeModal(true);
            sessionStorage.setItem('iotank_view_only_notice_shown', 'true');
        }

        return () => clearInterval(timer);
    }, [isViewOnly]);

    useEffect(() => {
        const fetchUnifiedEvents = async () => {
            if (!stationId) return;
            const { data } = await supabase
                .from('unified_events')
                .select('*')
                .eq('station_id', stationId)
                .eq('is_resolved', false)
                .order('created_at', { ascending: false })
                .limit(15);
            
            if (data) {
                const mapped = data.map((ev: any) => {
                    const desc = ev.description || '';
                    const title = ev.title || '';
                    
                    // [NOISE REDUCTION]: Filter out internal state transitions with "no essence"
                    const isInternalNoise = 
                        desc.includes('UPDATE detected on alerts') || 
                        desc.includes('UPDATE detected on tanks') ||
                        desc.includes('INSERT on alerts') ||
                        desc.includes('Forensic audit: UPDATE') ||
                        desc.includes('verified notification has no essence') ||
                        title.includes('Audit Synchronized');

                    if (isInternalNoise) return null;

                    let finalDesc = desc;
                    if (desc.includes('Forensic audit:')) {
                        // Extract just the action as requested: "it should just show the action done"
                        finalDesc = desc.split('Forensic audit:')[1]?.trim() || 'System state change';
                    }
                    
                    // Strip generic "Audit Synchronized:" prefix if present
                    if (finalDesc.includes('Audit Synchronized:')) {
                        finalDesc = finalDesc.split('Audit Synchronized:')[1]?.trim() || finalDesc;
                    }

                    return { ...ev, description: finalDesc };
                }).filter(Boolean);
                setUnifiedEvents(mapped as any);
            }
        };

        fetchUnifiedEvents();
        if (!stationId) return;

        const channel = supabase
            .channel(`public:unified_events:navbar:${stationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'unified_events',
                    filter: `station_id=eq.${stationId}`
                },
                (payload) => {
                    const description = payload.new.description || '';
                    const cat = payload.new.event_category || 'SYSTEM';
                    const isCritical = payload.new.severity === 'CRITICAL';
                    const title = payload.new.title || '';
                    
                    // [FILTER]: Ignore routine forensic updates to prevent UI loops/spam
                    const isNoise = 
                        description.includes('UPDATE detected on alerts') || 
                        description.includes('UPDATE detected on tanks') ||
                        description.includes('INSERT on alerts') ||
                        title.includes('Audit Synchronized');
                    
                    if (isNoise) return;

                    // Update UI State
                    setUnifiedEvents(prev => [payload.new, ...prev].slice(0, 15));

                    let messageText = description;
                    if (description.includes('Forensic audit:')) {
                        messageText = description.split('Forensic audit:')[1]?.trim() || 'System state change';
                    } else {
                        messageText = sanitizeIds(description);
                    }

                    if (messageText.includes('Audit Synchronized:')) {
                        messageText = messageText.split('Audit Synchronized:')[1]?.trim() || messageText;
                    }

                    setToast({
                        message: messageText || 'New audit event recorded.',
                        type: isCritical ? 'error' : cat === 'SECURITY' ? 'warning' : 'success',
                    });

                    if (NotificationService.isEnabled()) {
                        NotificationService.show(messageText || 'System Audit Event', {
                            body: `Category: ${cat} | Severity: ${payload.new.severity}`,
                            tag: 'unified-event'
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [stationId]);

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const { error } = await supabase.from('market_signals').select('id').limit(1);
                setIsOnline(!error);
            } catch {
                setIsOnline(false);
            }
        };
        checkConnection();
        const interval = setInterval(checkConnection, 60000);
        return () => clearInterval(interval);
    }, []);

    const formattedTime = currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

    return (
        <header className="navbar">
            <div className="navbar-left">
                <button className="menu-toggle-btn mr-4" onClick={onToggleSidebar} aria-label="Toggle Sidebar">
                    <MdMenu size={24} />
                </button>
                {/* Organization Profile to the left */}
                <div className="site-context scale-90 sm:scale-100 flex-shrink-0 ml-4 hidden md:flex">
                    <span className="org-name whitespace-nowrap">{currentUser?.companyName || 'IoTank Hub'}</span>
                    <span className="context-divider mx-1">|</span>
                    <span className="site-name hidden sm:inline whitespace-nowrap">{currentUser?.address?.state || 'SECURE CONNECT'}</span>
                </div>
            </div>

            <div className="navbar-center flex items-center justify-center">
                {isViewOnly && (
                    <div 
                        className="view-only-badge animate-pulse" 
                        onClick={() => setShowNoticeModal(true)}
                        title="Operational State: Limited Visibility Only"
                    >
                        <FiEye size={14} />
                        <span>View Only Mode</span>
                        <FiLock size={10} className="view-only-lock-icon" />
                    </div>
                )}
            </div>

            <div className="navbar-right">
                <div className="search-bar hidden md:block">
                    <MdSearch className="search-icon" />
                    <input type="text" placeholder="Global Search..." />
                </div>

                <div className="navbar-item-relative system-health hidden lg:flex">
                    <div className={`health-badge ${!isOnline ? 'offline' : ''}`}>
                        <MdCircle className={isOnline ? "pulse-green-small" : "text-red-500"} />
                        <span className="health-text">{isOnline ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}</span>
                        <span className="health-separator">|</span>
                        <span className="health-time">{formattedTime}</span>
                        {pendingCommandCount > 0 && (
                            <div 
                                className="pending-badge ml-2 flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Clear pending command queue? This only stops client tracking, it does not cancel the command on the server.')) {
                                        localStorage.removeItem('iotank_pending_commands');
                                        setPendingCommandCount(0);
                                    }
                                }}
                                title="Click to clear local action queue"
                            >
                                <FiActivity className="animate-pulse" />
                                {pendingCommandCount} PENDING
                            </div>
                        )}
                    </div>
                </div>

                <div className="navbar-item-relative">
                    <button
                        className="navbar-btn tankiq-toggle-btn group relative"
                        onClick={onToggleTankIQ}
                        title="Open TankIQ Assistant"
                    >
                        <img 
                            src={tankIQRobot} 
                            style={{ 
                                width: '28px', 
                                height: '28px', 
                                minWidth: '28px', 
                                minHeight: '28px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                            }} 
                            className="group-hover:scale-110 transition-transform shadow-sm" 
                            alt="TankIQ" 
                        />
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                    </button>
                </div>


                <div className="navbar-item-relative" ref={quickActionsRef}>
                    <button
                        className="navbar-btn quick-action-btn"
                        onClick={() => setShowQuickActions(!showQuickActions)}
                        title="Quick Actions"
                    >
                        <MdElectricBolt />
                    </button>
                    {showQuickActions && (
                        <div className="dropdown-menu modern-dropdown quick-actions-dropdown">
                            <div className="dropdown-header">
                                <h3>Quick Actions</h3>
                            </div>
                            <div className="dropdown-content">
                                <ul>
                                    <li>
                                        <button className="menu-btn" onClick={() => { 
                                            if (shiftStatus !== 'open') {
                                                setToast({ 
                                                    message: 'No active shift found. Please start a shift first.', 
                                                    type: 'warning',
                                                    actionLabel: 'Start New Shift',
                                                    onAction: () => openModal('shift-open')
                                                });
                                            } else {
                                                openModal('delivery'); 
                                            }
                                            setShowQuickActions(false); 
                                        }}>
                                            <MdElectricBolt className="menu-icon" />
                                            <div className="action-details">
                                                <span className="action-title">Add Delivery</span>
                                                <span className="action-desc">Log new fuel intake to inventory</span>
                                            </div>
                                        </button>
                                    </li>
                                    <li>
                                        <button className="menu-btn" onClick={() => { 
                                            if (shiftStatus === 'open') {
                                                setToast({ 
                                                    message: 'Shift is already active. Please end the current shift first.', 
                                                    type: 'warning',
                                                    actionLabel: 'End Current Shift',
                                                    onAction: () => openModal('shift-close')
                                                });
                                            } else {
                                                openModal('shift-open'); 
                                            }
                                            setShowQuickActions(false); 
                                        }}>
                                            <MdElectricBolt className="menu-icon text-emerald-500" />
                                            <div className="action-details">
                                                <span className="action-title">Start New Shift</span>
                                                <span className="action-desc">Initialize daily operations & meter readings</span>
                                            </div>
                                        </button>
                                    </li>
                                    <li>
                                        <button className="menu-btn" onClick={() => { 
                                            if (shiftStatus !== 'open') {
                                                setToast({ 
                                                    message: 'No active shift found. Please start a shift first.', 
                                                    type: 'warning',
                                                    actionLabel: 'Start New Shift',
                                                    onAction: () => openModal('shift-open')
                                                });
                                            } else {
                                                openModal('shift-close'); 
                                            }
                                            setShowQuickActions(false); 
                                        }}>
                                            <MdElectricBolt className="menu-icon text-rose-500" />
                                            <div className="action-details">
                                                <span className="action-title">End Current Shift</span>
                                                <span className="action-desc">Finalize sales & close register</span>
                                            </div>
                                        </button>
                                    </li>
                                    <li>
                                        <button className="menu-btn" onClick={() => { 
                                            if (shiftStatus !== 'open') {
                                                setToast({ 
                                                    message: 'No active shift found. Please start a shift first.', 
                                                    type: 'warning',
                                                    actionLabel: 'Start New Shift',
                                                    onAction: () => openModal('shift-open')
                                                });
                                            } else {
                                                openModal('report'); 
                                            }
                                            setShowQuickActions(false); 
                                        }}>
                                            <MdElectricBolt className="menu-icon" />
                                            <div className="action-details">
                                                <span className="action-title">Generate Report</span>
                                                <span className="action-desc">Export system analytics & activity logs</span>
                                            </div>
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                <div className="navbar-item-relative" ref={notificationRef}>
                    <button
                        className="navbar-btn"
                        onClick={() => setShowNotifications(!showNotifications)}
                        aria-label="Notifications"
                    >
                        <MdNotifications />
                        {(unreadAlerts.length + unifiedEvents.length) > 0 && (
                            <span className="notification-badge animate-pulse">{(unreadAlerts.length + unifiedEvents.length)}</span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="dropdown-menu modern-dropdown notifications-dropdown">
                        <div className="dropdown-header notif-header">
                                <h3>Notifications</h3>
                                {(unreadAlerts.length + unifiedEvents.length) > 0 && <span className="pro-badge notif-badge-inline">{(unreadAlerts.length + unifiedEvents.length)} New</span>}
                            </div>
                            <div className="dropdown-content custom-scrollbar overflow-y-auto max-h-[380px]">
                                {unreadAlerts.length > 0 || unifiedEvents.length > 0 ? (
                                    <>

                                        {unreadAlerts.map((alert: Alert) => {
                                            const category = alert.severity === 'critical' || alert.message.includes('THEFT') || alert.message.includes('LEAK') ? 'security' : 
                                                           alert.type.startsWith('low_level') ? 'delivery' : 'system';
                                            return (
                                                <div
                                                    key={alert.id}
                                                    className={`notification-item cat-${category} ${!alert.resolved ? 'unread' : ''} severity-${alert.severity || 'info'} ${resolvingIds.has(alert.id) ? 'resolving-out' : ''}`}
                                                    onClick={() => {
                                                        navigate('/alerts');
                                                        setShowNotifications(false);
                                                    }}
                                                >
                                                    <div className="notification-title">
                                                        <div className="notif-placeholder">
                                                            {alert.message.includes('THEFT') ? '🚨' :
                                                             alert.message.includes('LEAK') ? '💧' :
                                                             alert.type.startsWith('low_level') ? '📉' : '⚠️'}
                                                        </div>
                                                        <div className="notification-body">
                                                            <span className="font-black text-[13px] leading-tight block mb-1">
                                                                {sanitizeIds(alert.message.split('.')[0])}
                                                            </span>
                                                            <div className="notification-meta flex justify-between items-center opacity-70">
                                                                <span className="text-[10px] font-bold flex items-center gap-1 uppercase tracking-tighter">
                                                                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/5 font-black uppercase">
                                                                    {alert.severity || 'INFO'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn-mark-read hover:bg-emerald-50 hover:text-emerald-600 transition-colors bg-slate-100 rounded-full p-1.5 ml-2"
                                                            onClick={(e) => handleResolve(e, alert.id)}
                                                            title="Mark as acknowledge"
                                                        >
                                                            <MdCheck size={14} className="text-emerald-500 font-bold" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}


                                        {unifiedEvents
                                            .slice(0, 15)
                                            .map((event: any) => {
                                            const category = event.event_category?.toLowerCase() || 'system';
                                            return (
                                                <div key={event.id} className={`notification-item cat-${category} severity-${event.severity?.toLowerCase() || 'info'} ${resolvingIds.has(event.id) ? "resolving-out" : ""}`}>
                                                    <div className="notification-title">
                                                        <div className="notif-placeholder">
                                                            {event.event_category === 'SHIFT' ? <FiClock /> :
                                                             event.event_category === 'DELIVERY' ? <FiTrendingDown /> :
                                                             event.event_category === 'SECURITY' ? <FiShield /> :
                                                             event.event_category === 'TEAM' ? <FiUserPlus /> : <FiInfo />}
                                                        </div>
                                                        <div className="notification-body">
                                                            <span className="font-black text-[13px] leading-tight block mb-1">
                                                                {sanitizeIds(event.description.split('.')[0])}
                                                            </span>
                                                            <div className="notification-meta flex justify-between items-center opacity-70">
                                                                <span className="text-[10px] font-bold flex items-center gap-1 uppercase tracking-tighter">
                                                                    {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/5 font-black uppercase">
                                                                    {event.event_category || 'INFO'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn-mark-read hover:bg-emerald-50 hover:text-emerald-600 transition-colors bg-slate-100 rounded-full p-1.5 ml-2 flex items-center justify-center w-[24px] h-[24px]"
                                                            onClick={(e) => handleResolveEvent(e, event.id)}
                                                            title="Mark as acknowledge"
                                                        >
                                                            <MdCheck size={14} className="text-emerald-500 font-bold" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                ) : (
                                    <div className="empty-notif-state">
                                        <div className="empty-icon-wrapper">
                                            <FiBell size={28} />
                                        </div>
                                        <h4 className="empty-title">All Caught Up</h4>
                                        <p className="empty-desc">
                                            The Forensic Intelligence Scanner has found no active threats or pending alerts.
                                        </p>
                                        <div className="integrity-badge">
                                            <span className="status-dot"></span>
                                            System Integrity Verified
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="dropdown-footer">
                                <button
                                    onClick={() => {
                                        navigate('/alerts');
                                        setShowNotifications(false);
                                    }}
                                    className="btn-open-alerts"
                                >
                                    <FiActivity /> Command Center
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="navbar-item-relative user-menu-container" ref={profileMenuRef}>
                    <button
                        className="profile-btn px-1 sm:px-2"
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                    >
                        <div className="avatar">
                            {currentUser?.photoURL ? (
                                <img src={currentUser.photoURL} alt={currentUser.displayName || 'User'} />
                            ) : (
                                <MdPerson />
                            )}
                        </div>
                        <span className="navbar-username hidden lg:inline-block">
                            {currentUser?.displayName?.split(' ')[0] || 'User'}
                        </span>
                    </button>

                    {showProfileMenu && (
                        <div className="dropdown-menu modern-dropdown profile-dropdown">
                            <div className="dropdown-header">
                                <div className="user-role">Personal Account</div>
                                <h3>{currentUser?.displayName || 'Session user'}</h3>
                                <div className="user-email">{currentUser?.email}</div>
                            </div>
                            <div className="dropdown-content">
                                <ul>
                                    <li>
                                        <button className="menu-btn" onClick={() => { navigate('/settings?tab=profile'); setShowProfileMenu(false); }}>
                                            <MdPerson className="menu-icon" /> My Profile
                                        </button>
                                    </li>
                                    <li>
                                        <button className="menu-btn" onClick={() => { navigate('/settings?tab=security'); setShowProfileMenu(false); }}>
                                            <MdSettings className="menu-icon" /> Account Settings
                                        </button>
                                    </li>
                                </ul>
                                <div className="divider"></div>
                                <ul>
                                    <li>
                                        <button className="menu-btn logout-btn" onClick={() => { signOut(); setShowProfileMenu(false); }}>
                                            <MdLogout className="menu-icon" /> Logout
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Quick Action Modals */}
            <DeliveryModal
                isOpen={isDeliveryModalOpen}
                onClose={closeModal}
                onSuccess={(msg) => setToast({ message: msg, type: 'success' })}
            />
            <ShiftCloseModal
                isOpen={isShiftCloseModalOpen}
                onClose={closeModal}
            />
            <ShiftOpenModal
                isOpen={isShiftOpenModalOpen}
                onClose={closeModal}
            />
            <ReportModal
                isOpen={isReportModalOpen}
                onClose={closeModal}
            />
            <OrderModal
                isOpen={isOrderModalOpen}
                onClose={closeModal}
                onSuccess={(msg) => setToast({ message: msg, type: 'success' })}
            />

            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type} 
                    actionLabel={toast.actionLabel}
                    onAction={toast.onAction}
                    onClose={() => setToast(null)} 
                />
            )}

            <ViewOnlyNoticeModal
                isOpen={showNoticeModal}
                onClose={() => setShowNoticeModal(false)}
                onOpenShift={() => openModal('shift-open')}
            />
        </header >
    );
};
