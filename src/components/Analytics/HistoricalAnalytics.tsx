import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTanks, useAlerts } from '@/hooks/useSupabase';
import {
    FiDatabase,
    FiAlertCircle,
} from 'react-icons/fi';
import './HistoricalAnalytics.css';

export const HistoricalAnalytics: React.FC = () => {
    const { currentUser } = useAuth();
    const orgId = currentUser?.stationId || 'default-org-id';

    const { tanks } = useTanks(orgId);
    const activeTank = tanks[0];

    const [range] = useState<'24h' | '7d' | '30d' | '90d'>('7d');

    const timeWindow = useMemo(() => {
        const now = Date.now();
        const ranges = {
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
            '90d': 90 * 24 * 60 * 60 * 1000,
        };
        return {
            start: now - ranges[range],
            end: now
        };
    }, [range]);

    const { alerts } = useAlerts(orgId, false);

    const filteredAlerts = useMemo(() => {
        return alerts.filter(a =>
            a.timestamp >= timeWindow.start &&
            a.timestamp <= timeWindow.end &&
            (activeTank ? a.tankId === activeTank.id : true)
        ).sort((a, b) => b.timestamp - a.timestamp);
    }, [alerts, timeWindow, activeTank]);



    if (!activeTank) {
        return (
            <div className="historical-analytics-container empty">
                <div className="empty-state">
                    <FiDatabase size={48} className="text-secondary mb-4" />
                    <h3>No Data Available</h3>
                    <p>Connect a tank to start tracking historical performance.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="historical-analytics-container">


            <section className="events-timeline-section">
                <h2>Audit & Event Timeline</h2>
                <div className="timeline-list">
                    {filteredAlerts.length > 0 ? (
                        filteredAlerts.map(alert => (
                            <div key={alert.id} className={`timeline-item severity-${alert.severity}`}>
                                <div className="timeline-icon">
                                    {alert.type === 'anomaly' ? <FiAlertCircle className="text-danger" /> : <FiAlertCircle className="text-warning" />}
                                </div>
                                <div className="timeline-content">
                                    <div className="timeline-meta">{new Date(alert.timestamp).toLocaleString()}</div>
                                    <div className="timeline-title">{alert.type.toUpperCase()}</div>
                                    <div className="timeline-desc text-secondary text-sm">{alert.message}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state py-8 bg-secondary/5 border-dashed border-2 rounded-lg text-center">
                            <p className="text-secondary italic">No critical events recorded during this window.</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
