import React from 'react';
import { FiDatabase, FiCheckCircle, FiActivity, FiAlertTriangle } from 'react-icons/fi';
import { FaShieldAlt } from 'react-icons/fa';
import './ComplianceFramework.css';

export const ComplianceOverview: React.FC = () => {
    return (
        <div className="compliance-framework">
            <div className="compliance-grid">
                <div className="compliance-item item-left">
                    <div className="compliance-icon">
                        <FaShieldAlt />
                    </div>
                    <div className="compliance-content">
                        <h5 className="compliance-item-title">Asset Maintenance:</h5>
                        <p className="compliance-item-desc">Preventive Schedules Via Asset Management Systems</p>
                    </div>
                </div>

                <div className="compliance-item item-right">
                    <div className="compliance-icon">
                        <FiActivity />
                    </div>
                    <div className="compliance-content">
                        <h5 className="compliance-item-title">Operational Health & Safety:</h5>
                        <p className="compliance-item-desc">Real-Time Tracking with EHS Software</p>
                    </div>
                </div>

                <div className="compliance-item item-left">
                    <div className="compliance-icon">
                        <FiDatabase />
                    </div>
                    <div className="compliance-content">
                        <h5 className="compliance-item-title">Inventory Handling:</h5>
                        <p className="compliance-item-desc">Traceable Material Flow and Reporting</p>
                    </div>
                </div>

                <div className="compliance-item item-right">
                    <div className="compliance-icon">
                        <FiAlertTriangle />
                    </div>
                    <div className="compliance-content">
                        <h5 className="compliance-item-title">Environmental Compliance:</h5>
                        <p className="compliance-item-desc">Emission and Waste Monitoring</p>
                    </div>
                </div>

                <div className="compliance-item item-center">
                    <div className="compliance-icon">
                        <FiCheckCircle />
                    </div>
                    <div className="compliance-content">
                        <h5 className="compliance-item-title">Quality Management:</h5>
                        <p className="compliance-item-desc">Replace Paper-Based QMS with Digital Systems for Audit-Ready Documentation</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
