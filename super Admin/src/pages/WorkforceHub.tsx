import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import SystemUsers from './SystemUsers';
import SupportTickets from './SupportTickets';
import { FiUsers, FiMessageSquare } from 'react-icons/fi';
import './FleetHub.css'; // Reuse core hub hub-navigator styles

const WorkforceHub: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'users' | 'tickets'>('users');
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 100);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const sections = [
        { id: 'users', label: 'Console Team', icon: <FiUsers /> },
        { id: 'tickets', label: 'Support Desk', icon: <FiMessageSquare /> }
    ];

    return (
        <Layout>
            <div className="fleet-hub-container">
                <div className={`hub-header-sticky ${isScrolled ? 'scrolled' : ''}`}>
                    <div className="hub-nav-track">
                        {sections.map(s => (
                            <button 
                                key={s.id}
                                className={`hub-nav-pill ${activeSection === s.id ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveSection(s.id as any);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            >
                                <span className="hub-nav-icon">{s.icon}</span>
                                <span className="hub-nav-label">{s.label}</span>
                                {activeSection === s.id && <div className="hub-nav-indicator" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="hub-content-surface animate-fade-in">
                    {activeSection === 'users' && <SystemUsers isHubView={true} />}
                    {activeSection === 'tickets' && <SupportTickets isHubView={true} />}
                </div>
            </div>
        </Layout>
    );
};

export default WorkforceHub;
