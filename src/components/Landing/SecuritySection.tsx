import React from 'react';
import './SecuritySection.css';
import { FiLock, FiShield, FiFileText, FiArrowRight } from 'react-icons/fi';

const SecuritySection: React.FC = () => {
    const features = [
        {
            id: 1,
            title: "Role-Based Access Control (RBAC)",
            description: "Strictly enforced user permissions ensure that staff only see what they need, while admins maintain full oversight of the entire fleet.",
            icon: <FiLock strokeWidth={2} />,
            iconColor: "icon-blue"
        },
        {
            id: 2,
            title: "TLS 1.3 Encryption",
            description: "All data in transit is protected by the latest Transport Layer Security standards, ensuring that sensor readings cannot be intercepted or spoofed.",
            icon: <FiShield strokeWidth={2} />,
            iconColor: "icon-pink"
        },
        {
            id: 3,
            title: "Immutable Audit Trails",
            description: "Every action—from tank refills to price updates—is logged permanently. History cannot be altered, providing a source of truth for compliance.",
            icon: <FiFileText strokeWidth={2} />,
            iconColor: "icon-green"
        }
    ];

    return (
        <section className="security-section" id="security">

            <div className="security-container">

                {/* Header */}
                <div className="security-header">
                    <h2 className="security-title">The Security Systems</h2>
                    <p className="security-subtitle">
                        Your data is your asset. We protect it with enterprise-grade security.
                    </p>
                </div>

                {/* Cards Grid */}
                <div className="security-grid">
                    {features.map((feature) => (
                        <div key={feature.id} className="security-card">
                            <div className={`icon-wrapper ${feature.iconColor}`}>
                                <div className="card-icon" style={{ fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {feature.icon}
                                </div>
                            </div>
                            <h3 className="security-card-title">{feature.title}</h3>
                            <p className="security-description">{feature.description}</p>
                            <a href="#faq" className="read-more">
                                Read more
                                <FiArrowRight />
                            </a>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
};

export default SecuritySection;
