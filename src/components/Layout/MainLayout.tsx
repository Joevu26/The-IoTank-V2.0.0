/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, Suspense, lazy } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAlerts } from '@/hooks/useSupabase';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { AlertBanner } from '../Alerts/AlertBanner';
import TermsModal from '../Landing/TermsModal';
import { PhotoNudgeBanner } from './PhotoNudgeBanner';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiFacebook, FiInstagram, FiTwitter } from 'react-icons/fi';
import { PageLoader } from '../Common/PageLoader';
import brandMark from '@/assets/iotank-logo-v3.png';

const TourGuide = lazy(() => import('../Tour/TourGuide').then(module => ({ default: module.TourGuide })));

import './MainLayout.css';

export const MainLayout: React.FC = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Modal state for footer links
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [modalInitialStep, setModalInitialStep] = useState(0);

    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const isFullBleedPage = location.pathname.includes('/alerts');
    const [showNudge, setShowNudge] = useState(() => {
        // Only show if user has no photo and hasn't dismissed it this session
        const dismissed = sessionStorage.getItem('photo_nudge_dismissed');
        return !currentUser?.photoURL && !dismissed;
    });

    // Mobile Sidebar Inactivity Timer
    const mobileMenuTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const resetMobileTimer = React.useCallback(() => {
        if (mobileMenuTimerRef.current) {
            clearTimeout(mobileMenuTimerRef.current);
        }
        if (isMobileMenuOpen) {
            mobileMenuTimerRef.current = setTimeout(() => {
                setIsMobileMenuOpen(false);
            }, 5000);
        }
    }, [isMobileMenuOpen]);

    React.useEffect(() => {
        if (isMobileMenuOpen) {
            resetMobileTimer();
        } else if (mobileMenuTimerRef.current) {
            clearTimeout(mobileMenuTimerRef.current);
            mobileMenuTimerRef.current = null;
        }

        return () => {
            if (mobileMenuTimerRef.current) {
                clearTimeout(mobileMenuTimerRef.current);
            }
        };
    }, [isMobileMenuOpen, resetMobileTimer]);

    // Ensure route changes scroll to the top of the page
    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    const handleNudgeUpload = () => {
        setShowNudge(false);
        sessionStorage.setItem('photo_nudge_dismissed', 'true');
        navigate('/settings?tab=profile');
    };

    const handleNudgeDismiss = () => {
        setShowNudge(false);
        sessionStorage.setItem('photo_nudge_dismissed', 'true');
    };

    // Fetch notifications for the floating pop-ups
    const stationId = currentUser?.stationId || '';
    const { alerts } = useAlerts(stationId, false);
    const unreadAlerts = alerts.filter(a => !a.resolved).slice(0, 1);

    // Native Browser Notifications
    useBrowserNotifications(stationId);

    const toggleSidebar = () => {
        if (window.innerWidth <= 768) {
            setIsMobileMenuOpen(!isMobileMenuOpen);
        } else {
            setSidebarCollapsed(!sidebarCollapsed);
        }
    };

    const openLegalModal = (step: number) => {
        setModalInitialStep(step);
        setIsTermsModalOpen(true);
    };

    return (
        <div className={`main-layout ${sidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-menu-active' : ''}`}>
            <Suspense fallback={null}>
                <TourGuide />
            </Suspense>

            {/* Global Floating Alert Notification */}
            <div className="alerts-floating-container">
                {unreadAlerts.map((alert: any) => (
                    <AlertBanner key={`${alert.id}-${alert.timestamp}`} alert={alert} floating={true} />
                ))}
            </div>
            <Sidebar
                collapsed={sidebarCollapsed}
                mobileOpen={isMobileMenuOpen}
                closeMobile={() => setIsMobileMenuOpen(false)}
                onActivity={resetMobileTimer}
            />

            <div className="content-wrapper">
                <Navbar onToggleSidebar={toggleSidebar} />
                {showNudge && currentUser && (
                    <PhotoNudgeBanner
                        onUploadClick={handleNudgeUpload}
                        onDismiss={handleNudgeDismiss}
                    />
                )}

                <main className={`main-content ${isFullBleedPage ? 'full-bleed' : ''}`}>
                    <Suspense fallback={<PageLoader />}>
                        <Outlet />
                    </Suspense>
                </main>

                <footer className="mission-control-footer">
                    <div className="footer-left">
                        <div className="footer-brand">
                            <img src={brandMark} alt="IoTank" className="footer-brand-logo" />
                            <div className="v-divider"></div>
                            <div className="system-tag">
                                <span className="tag-label">Client Hub</span>
                                <span className="tag-version">V2.0.0-PRO</span>
                            </div>
                        </div>
                        <div className="v-divider hidden xl:block"></div>
                        <div className="legal-text hidden xl:block">
                            © 2026 <span className="text-accent-primary">The IoTank</span>
                        </div>
                    </div>
                    
                    <div className="footer-center">
                        <nav className="footer-nav">
                            <a href="/" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }} className="footer-nav-link">hub dashboard</a>
                            <a href="/inventory" onClick={(e) => { e.preventDefault(); navigate('/inventory'); }} className="footer-nav-link">inventory</a>
                            <a href="/analytics" onClick={(e) => { e.preventDefault(); navigate('/analytics'); }} className="footer-nav-link">analytics</a>
                        </nav>
                    </div>

                    <div className="footer-right">
                        <div className="footer-status-legal">
                            <div className="uptime-index">
                                <span className="pulse-cyan"></span> <span className="hidden sm:inline">Status:</span> Operational
                            </div>
                            <div className="v-divider"></div>
                            <a href="#privacy" onClick={(e) => { e.preventDefault(); openLegalModal(3); }} className="footer-nav-link !text-[10px]">Privacy</a>
                        </div>
                        
                        <div className="v-divider hidden lg:block"></div>

                        <div className="footer-social">
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-pill" title="Facebook" aria-label="IoTank on Facebook"><FiFacebook /></a>
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-pill" title="Instagram" aria-label="IoTank on Instagram"><FiInstagram /></a>
                            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-pill" title="Twitter" aria-label="IoTank on Twitter"><FiTwitter /></a>
                        </div>
                    </div>
                </footer>
            </div>

            <TermsModal
                isOpen={isTermsModalOpen}
                onClose={() => setIsTermsModalOpen(false)}
                onComplete={() => setIsTermsModalOpen(false)}
                initialStep={modalInitialStep}
                readOnly={true}
            />

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="mobile-overlay"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-hidden="true"
                />
            )}
        </div>
    );
};
