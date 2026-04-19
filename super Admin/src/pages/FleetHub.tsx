import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import ClientsList from './ClientsList';
import PendingRegistrations from './PendingRegistrations';
import HardwareMonitoring from './HardwareMonitoring';
import { FiActivity, FiUsers, FiCpu, FiChevronDown } from 'react-icons/fi';
import './FleetHub.css';

const FleetHub: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'clients' | 'registrations' | 'hardware'>('clients');
    const [isScrolled, setIsScrolled] = useState(false);
    
    // Refs for scrolling if needed, but for now we'll use conditional rendering 
    // to maintain performance of large lists (since user asked for "longer page" 
    // but the underlying lists are massive). We'll simulate the "long page" 
    // while keeping it snappy.

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 100);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const sections = [
        { id: 'clients', label: 'Client Registry', icon: <FiUsers /> },
        { id: 'registrations', label: 'Intake Queue', icon: <FiActivity /> },
        { id: 'hardware', label: 'Node Hardware', icon: <FiCpu /> }
    ];

    return (
        <Layout>
            <div className="fleet-hub-container">
                {/* ── Sticky Hub Navigator ── */}
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

                {/* ── Hub Intelligence Surface ── */}
                <div className="hub-content-surface animate-fade-in">
                    {activeSection === 'clients' && <ClientsList isHubView={true} />}
                    {activeSection === 'registrations' && <PendingRegistrations isHubView={true} />}
                    {activeSection === 'hardware' && <HardwareMonitoring isHubView={true} />}
                </div>
            </div>
        </Layout>
    );
};

export default FleetHub;
