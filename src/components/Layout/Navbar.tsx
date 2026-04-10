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

import { DeliveryModal } from '../QuickActions/DeliveryModal';
import { ShiftCloseModal } from '../QuickActions/ShiftCloseModal';
import { ShiftOpenModal } from '../QuickActions/ShiftOpenModal';
import { ReportModal } from '../QuickActions/ReportModal';
import { Toast } from '../Common/Toast';
import { useShiftStatus } from '@/hooks/useShiftStatus';
import { ViewOnlyNoticeModal } from '../Common/ViewOnlyNoticeModal';
import { FiEye, FiLock } from 'react-icons/fi';

interface NavbarProps {
    onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
    const { currentUser, signOut } = useAuth();
    const orgId = currentUser?.stationId || '';

    // Theme toggle removed
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showQuickActions, setShowQuickActions] = useState(false);
    
    // Shift Status Logic
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

    const navigate = useNavigate();

    // Fetch real alerts for the notification tray
    const { alerts } = useAlerts(orgId, false);
    const unreadAlerts = alerts.filter(a => !a.resolved);

    const handleResolve = async (e: React.MouseEvent, alertId: string) => {
        e.stopPropagation(); // Don't navigate to /alerts
        try {
            if (!currentUser) return;
            await resolveAlert(alertId, currentUser.authUserId);
        } catch (err) {
            console.error('Error resolving alert from navbar:', err);
        }
    };

    // Use click outside hooks
    const profileMenuRef = useClickOutside(() => setShowProfileMenu(false));
    const notificationRef = useClickOutside(() => setShowNotifications(false));
    const quickActionsRef = useClickOutside(() => setShowQuickActions(false));

    const [currentTime, setCurrentTime] = useState(new Date());
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        // Check if we should show the View-Only notice
        const hasSeenNotice = sessionStorage.getItem('iotank_view_only_notice_shown');
        if (isViewOnly && !hasSeenNotice) {
            setShowNoticeModal(true);
            sessionStorage.setItem('iotank_view_only_notice_shown', 'true');
        }

        return () => {
            clearInterval(timer);
        };
    }, [isViewOnly]);

    useEffect(() => {
        const checkConnection = async () => {
            try {
                // Check a valid table to verify connectivity (market_prices was deleted/renamed)
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
                    <div className="view-only-badge animate-pulse" 
                         onClick={() => setShowNoticeModal(true)}
                         title="Operational State: Limited Visibility Only"
                         style={{
                             background: 'rgba(239, 68, 68, 0.08)',
                             border: '1px solid rgba(239, 68, 68, 0.2)',
                             color: '#ef4444',
                             padding: '6px 14px',
                             borderRadius: '99px',
                             display: 'flex',
                             alignItems: 'center',
                             gap: '8px',
                             cursor: 'pointer',
                             fontSize: '11px',
                             fontWeight: 900,
                             letterSpacing: '0.05em',
                             textTransform: 'uppercase'
                         }}>
                        <FiEye size={14} />
                        <span>View Only Mode</span>
                        <FiLock size={10} style={{ opacity: 0.6 }} />
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
                        <span className="health-text">{isOnline ? 'System Online' : 'System Offline'}</span>
                        <span className="sync-text">{formattedTime}</span>
                    </div>
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
                        {unreadAlerts.length > 0 && (
                            <span className="notification-badge animate-pulse">{unreadAlerts.length}</span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="dropdown-menu modern-dropdown notifications-dropdown">
                            <div className="dropdown-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>Notifications</h3>
                                {unreadAlerts.length > 0 && <span className="pro-badge" style={{ margin: 0 }}>{unreadAlerts.length} New</span>}
                            </div>
                            <div className="dropdown-content overflow-y-auto max-h-[400px]">
                                {unreadAlerts.length > 0 ? (
                                    unreadAlerts.slice(0, 5).map((alert: Alert) => (
                                        <div
                                            key={alert.id}
                                            className={`notification-item ${!alert.resolved ? 'unread' : ''} severity-${alert.severity || 'info'}`}
                                            onClick={() => {
                                                navigate('/alerts');
                                                setShowNotifications(false);
                                            }}
                                        >
                                            <div className="notification-title">
                                                <span className="flex items-center gap-2">
                                                    <span className="text-lg">
                                                        {alert.message.includes('Started') ? '🏁' :
                                                         alert.message.includes('Closed') || alert.message.includes('Closure') ? '🚩' :
                                                         alert.message.includes('THEFT') ? '🚨' :
                                                         alert.message.includes('LEAK') ? '💧' :
                                                         alert.message.includes('COLLUSION') ? '🤝' :
                                                         alert.type === 'low-level' ? '📉' :
                                                         alert.type === 'anomaly' ? '⚠️' : '🔔'}
                                                    </span>
                                                    {alert.message.split('.')[0]}
                                                </span>
                                                <button
                                                    className="btn-mark-read hover:bg-emerald-50 hover:text-emerald-600 transition-colors bg-slate-100 rounded-full p-1.5"
                                                    onClick={(e) => handleResolve(e, alert.id)}
                                                    title="Mark as acknowledge"
                                                >
                                                    <MdCheck size={18} className="text-emerald-500 font-bold" />
                                                </button>
                                            </div>
                                            <div className="notification-meta flex justify-between items-center mt-2 px-1">
                                                <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                                                    <MdCircle size={6} className={alert.severity === 'critical' ? 'text-red-500' : 'text-blue-500'} />
                                                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 font-bold text-gray-500 border border-gray-200/50">
                                                    {alert.detectionMethod === 'ai-assisted' ? '🤖 AI AGENT' : 'SYSTEM'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-60">
                                        <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                                            <MdCheck className="text-emerald-500" size={24} />
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">All Caught Up</span>
                                        <span className="text-[11px] text-gray-500 mt-1">No pending alerts found</span>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 mt-4 mx-4 mb-2 bg-slate-50/80 rounded-[20px] border border-slate-200/60 flex items-center justify-center shadow-inner">
                                <button
                                    onClick={() => {
                                        navigate('/alerts');
                                        setShowNotifications(false);
                                    }}
                                    className="px-8 py-3 bg-gradient-to-r from-[#855AFF] to-[#6C40FE] text-white font-black rounded-full shadow-[0_10px_20px_-5px_rgba(133,90,255,0.4)] hover:shadow-[0_12px_24px_-5px_rgba(133,90,255,0.6)] active:scale-[0.96] transition-all text-[12px] tracking-widest uppercase"
                                >
                                    Open Alert Center
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
                        <span className="hidden lg:inline-block text-sm font-bold ml-1 overflow-hidden transition-all duration-300" style={{ maxWidth: '80px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
