import React from 'react';
import './OwnershipSection.css';
import { FiWifiOff, FiAlertCircle, FiRotateCcw } from 'react-icons/fi';

const OwnershipSection: React.FC = () => {
    return (
        <section className="ownership-section">
            <div className="ownership-card shadow-soft">
                {/* Left Column: Header */}
                <div className="ownership-header-side">
                    <p className="eyebrow">TELEMETRY ERROR · EVENT_4029</p>
                    <h2 className="main-title">Intelligence Interrupted</h2>
                    <p className="subtitle">
                        A telemetry processing error occurred. The system has automatically
                        logged this event for analysis.
                    </p>
                </div>

                {/* Right Column: Status Items */}
                <div className="ownership-status-side">
                    {/* Item 1: Signal Dropout */}
                    <div className="status-item signal">
                        <div className="status-icon-box">
                            <FiWifiOff />
                        </div>
                        <div className="status-content">
                            <h3 className="status-title">Signal Dropout</h3>
                            <p className="status-desc">
                                Channel 3 unresponsive. Inventory read on tank probe A02YYUW-7 interrupted.
                            </p>
                        </div>
                    </div>

                    {/* Item 2: Module Unresolved */}
                    <div className="status-item module">
                        <div className="status-icon-box">
                            <FiAlertCircle />
                        </div>
                        <div className="status-content">
                            <h3 className="status-title">Module Unresolved</h3>
                            <p className="status-desc">
                                FiDatabase is not defined. Inventory pipeline halted automatically.
                            </p>
                        </div>
                    </div>

                    {/* Item 3: Manual Fallback */}
                    <div className="status-item fallback">
                        <div className="status-icon-box">
                            <FiRotateCcw />
                        </div>
                        <div className="status-content">
                            <h3 className="status-title">Manual Fallback</h3>
                            <p className="status-desc">
                                Reverting to dipstick. ±700L uncertainty reinstated. Losses resume.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default OwnershipSection;
