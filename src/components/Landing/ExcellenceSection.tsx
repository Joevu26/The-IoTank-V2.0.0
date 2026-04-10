import React from 'react';
import './ExcellenceSection.css';
import {
    FiLayers, FiTrendingUp, FiAlertTriangle, FiShield
} from 'react-icons/fi';

const ExcellenceSection: React.FC = () => {
    const features = [
        {
            id: 1,
            title: "Operational Awareness",
            description: "3D visualization of underground assets, corrected fuel volumes, and real-time temperature logs.",
            cta: "View demo",
            icon: <FiLayers />,
            color: "#3B82F6" // Blue
        },
        {
            id: 2,
            title: "Decision Intelligence",
            description: "Price trend overlays ('Buy Now' vs 'Wait'), Time-to-Empty forecasts, and confidence-scored supply advice.",
            cta: "See signals",
            icon: <FiTrendingUp />,
            color: "#10B981" // Green
        },
        {
            id: 3,
            title: "Risk & Safety",
            description: "Leak detection algorithms, supply disruption alerts, and offline data caching for resilience.",
            cta: "Safety protocols",
            icon: <FiAlertTriangle />,
            color: "#EF4444" // Red
        },
        {
            id: 4,
            title: "Compliance & Reporting",
            description: "Automated EPRA compliance reports, historical replay of events, and exportable audit trails.",
            cta: "Export sample",
            icon: <FiShield />,
            color: "#8B5CF6" // Purple
        }
    ];

    return (
        <section className="excellence-section">
            <div className="excellence-container">
                {/* Left side: Header info */}
                <div className="excellence-header">
                    <div className="excellence-pill">PLATFORM CAPABILITIES</div>
                    <h1 className="excellence-title">
                        Advanced <br />
                        <span className="excellence-highlight">Operational</span> <br />
                        Excellence
                    </h1>
                    <p className="excellence-intro">
                        We integrate hardware, AI, and cloud infrastructure to provide
                        unmatched visibility into your tank operations — engineered for
                        industrial-grade reliability.
                    </p>
                </div>

                {/* Middle side: Circular Art */}
                <div className="excellence-visual">
                    <div className="circle-infographic">
                        <div className="central-hub">
                            <div className="hub-core">
                                <span className="hub-value">Our</span>
                                <span className="hub-label">System</span>
                            </div>
                        </div>
                        {/* Golden Circle Orbits */}
                        <div className="orbit-ring ring-1"></div>
                        <div className="orbit-ring ring-2"></div>
                        <div className="orbit-ring ring-3"></div>

                        {/* Orbiting Label Nodes */}
                        {/* Orbiting Encircled Text Nodes */}
                        <div className="orbit-node node-reliability">
                            <span className="node-label">Reliability</span>
                        </div>
                        <div className="orbit-node node-safety">
                            <span className="node-label">Safety</span>
                        </div>
                        <div className="orbit-node node-accuracy">
                            <span className="node-label">Accuracy</span>
                        </div>
                    </div>
                </div>

                {/* Right side: Features list */}
                <div className="excellence-features">
                    {/* Visual Connector for Feature Icons */}


                    {features.map((feature) => (
                        <div key={feature.id} className="excellence-feature-item">
                            <div className="feature-icon" style={{ backgroundColor: `${feature.color}15`, color: feature.color }}>
                                {feature.icon}
                            </div>
                            <div className="feature-content">
                                <h3 className="feature-title">{feature.title}</h3>
                                <p className="feature-desc">{feature.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ExcellenceSection;
