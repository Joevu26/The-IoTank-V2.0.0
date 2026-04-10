import React from 'react';
import { Tank } from '@/types';
import { formatVolume } from '@/utils/formatUtils';
import { FiClock, FiActivity } from 'react-icons/fi';
import './TankGridView.css';

interface TankGridViewProps {
    tanks: Tank[];
    onSelectTank: (id: string) => void;
}

export const TankGridView: React.FC<TankGridViewProps> = ({ tanks, onSelectTank }) => {
    return (
        <div className="tank-grid-view">
            {tanks.map(tank => {
                const fillPercent = tank.capacity ? ((tank.currentVolume || 0) / tank.capacity) * 100 : 0;
                let statusColor = 'status-normal';
                let statusLabel = 'Normal';

                if (fillPercent < 15) {
                    statusColor = 'status-critical';
                    statusLabel = 'Critical';
                } else if (fillPercent < 30) {
                    statusColor = 'status-low';
                    statusLabel = 'Low';
                }

                return (
                    <div
                        key={tank.id}
                        className={`tank-grid-card ${statusColor} animate-fade-in`}
                        onClick={() => onSelectTank(tank.id)}
                    >
                        <div className="card-header">
                            <span className={`status-badge ${statusColor}`}>{statusLabel}</span>
                            <span className="tank-fuel-type">{tank.fuelType}</span>
                        </div>

                        <div className="card-body">
                            <h3 className="tank-name">{tank.name}</h3>
                            <div className="volume-display">
                                <span className="volume-value">{formatVolume(tank.currentVolume || 0)}</span>
                                <span className="volume-percent">{fillPercent.toFixed(1)}%</span>
                            </div>

                            <div className="level-indicator-container">
                                <div 
                                    className="level-indicator-bar" 
                                    style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="card-footer">
                            <div className="footer-metric">
                                <FiClock className="metric-icon" />
                                <span>Sync: <strong>{new Date(tank.lastReading || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                            </div>
                            <div className="footer-metric">
                                <FiActivity className="metric-icon" />
                                <span>Health: <strong>Online</strong></span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
