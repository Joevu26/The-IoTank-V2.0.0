import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    FiEye, FiLock, FiArrowRight, 
    FiActivity, FiPieChart, FiDatabase, FiTruck 
} from 'react-icons/fi';
import './ViewOnlyNoticeModal.css';

interface ViewOnlyNoticeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenShift: () => void;
}

const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: { 
        opacity: 1, 
        scale: 1, 
        y: 0,
        transition: { 
            type: "spring" as const, 
            stiffness: 300, 
            damping: 25,
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    },
    exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2 } }
};

const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
};

export const ViewOnlyNoticeModal: React.FC<ViewOnlyNoticeModalProps> = ({
    isOpen,
    onClose,
    onOpenShift
}) => {
    // Portaling ensures the modal is 'floating' at the root of the document,
    // avoiding stacking context issues from parent components (like Navbar).
    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="view-only-notice-overlay">
                    <motion.div 
                        className="view-only-notice-card"
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <div className="notice-header">
                            <div className="glass-shine"></div>
                            <div className="notice-icon-wrapper">
                                <FiEye size={28} className="notice-icon" />
                                <FiLock size={14} className="notice-lock-badge" />
                            </div>
                        </div>
                        
                        <div className="notice-content">
                            <motion.h2 variants={itemVariants}>Operational Mode: View-Only</motion.h2>
                            <motion.p variants={itemVariants}>
                                <strong>The shift is closed</strong>. Oversight and monitoring are active, but administrative 
                                actions are locked to maintain audit integrity and safety.
                            </motion.p>
                            
                            <div className="notice-features">
                                <motion.div className="feature-item active" variants={itemVariants}>
                                    <div className="feature-icon-box"><FiActivity size={14} /></div>
                                    <div className="feature-text">
                                        <span className="label">Live Telemetry</span>
                                        <span className="status">Enabled</span>
                                    </div>
                                </motion.div>
                                <motion.div className="feature-item active" variants={itemVariants}>
                                    <div className="feature-icon-box"><FiPieChart size={14} /></div>
                                    <div className="feature-text">
                                        <span className="label">Analytics Audit</span>
                                        <span className="status">Read-Only</span>
                                    </div>
                                </motion.div>
                                <motion.div className="feature-item locked" variants={itemVariants}>
                                    <div className="feature-icon-box"><FiDatabase size={14} /></div>
                                    <div className="feature-text">
                                        <span className="label">Configuration</span>
                                        <span className="status">Locked</span>
                                    </div>
                                </motion.div>
                                <motion.div className="feature-item locked" variants={itemVariants}>
                                    <div className="feature-icon-box"><FiTruck size={14} /></div>
                                    <div className="feature-text">
                                        <span className="label">Logistics</span>
                                        <span className="status">Restricted</span>
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        <div className="notice-actions-row">
                            <button className="btn-secondary-glass compact" onClick={onClose}>
                                Dismiss Oversight
                            </button>
                            <button className="btn-primary-shimmer compact" onClick={() => {
                                onClose();
                                onOpenShift();
                            }}>
                                <span>Initialize Shift</span>
                                <FiArrowRight className="btn-arrow" />
                                <div className="shimmer-effect"></div>
                            </button>
                        </div>
                        
                        <div className="notice-footer">
                            <p>Logged in as Station Administrator</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
