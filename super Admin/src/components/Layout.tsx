import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Sidebar } from './Layout/Sidebar';
import { Navbar } from './Layout/Navbar';
import { FiFacebook, FiInstagram, FiTwitter } from 'react-icons/fi';
import brandMark from '../assets/iotank-logo-v3.png';
import './Layout/MainLayout.css';

interface LayoutProps {
    children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const navigate = useNavigate();

    const location = useLocation();

    const isFullBleedPage = location.pathname.includes('/market') || location.pathname.includes('/clients/');

    const toggleSidebar = () => {
        if (window.innerWidth <= 768) {
            setIsMobileMenuOpen(!isMobileMenuOpen);
        } else {
            setSidebarCollapsed(!sidebarCollapsed);
        }
    };

    return (
        <div className={`main-layout ${sidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-menu-active' : ''}`}>
            <Sidebar
                collapsed={sidebarCollapsed}
                mobileOpen={isMobileMenuOpen}
                closeMobile={() => setIsMobileMenuOpen(false)}
            />

            <div className="content-wrapper">
                <Navbar onToggleSidebar={toggleSidebar} />
                
                <main className={`main-content ${isFullBleedPage ? 'full-bleed' : ''}`}>
                    {children}
                </main>
                
                <footer className="mission-control-footer">
                    <div className="footer-main">
                        <div className="footer-brand">
                            <img src={brandMark} alt="IoTank" className="footer-brand-logo" />
                            <div className="v-divider"></div>
                            <div className="system-tag">
                                <span className="tag-label">Kernel</span>
                                <span className="tag-version">V2.0.0-STABLE</span>
                            </div>
                        </div>
                        <nav className="footer-nav">
                            <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="footer-nav-link">Control Board</a>
                            <a href="/clients" onClick={(e) => { e.preventDefault(); navigate('/clients'); }} className="footer-nav-link">Global Accounts</a>
                            <a href="/logs" onClick={(e) => { e.preventDefault(); navigate('/logs'); }} className="footer-nav-link">Audit Trails</a>
                            <a href="/admins" onClick={(e) => { e.preventDefault(); navigate('/admins'); }} className="footer-nav-link">Governance</a>
                        </nav>
                        <div className="footer-social">
                            <a href="https://facebook.com" target="_blank" rel="noreferrer" className="social-pill"><FiFacebook /></a>
                            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="social-pill"><FiInstagram /></a>
                            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social-pill"><FiTwitter /></a>
                        </div>
                    </div>
                    <div className="footer-legal">
                        <div className="legal-text">
                            © 2026 <span className="text-accent-primary">The IoTank</span> | System Command Console [KE-NBO-01]
                        </div>
                        <div className="uptime-index">
                            <span className="pulse-cyan"></span> Platform Status: Operational
                        </div>
                    </div>
                </footer>
            </div>

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

export default Layout;

