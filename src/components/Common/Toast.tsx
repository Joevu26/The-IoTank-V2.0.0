import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiInfo, FiAlertCircle, FiCheckCircle, FiShield, FiArrowRight } from 'react-icons/fi';

import './Toast.css';

export type ToastType = 'info' | 'warning' | 'success' | 'error';

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
    actionLabel?: string;
    onAction?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ 
    message, 
    type = 'info', 
    duration = 5000,
    onClose,
    actionLabel,
    onAction
}) => {
    const isShiftBlocked = message.toLowerCase().includes('shift');

    const getIcon = () => {
        if (isShiftBlocked) return <FiShield size={32} />;
        switch (type) {
            case 'warning': return <FiAlertCircle size={32} />;
            case 'success': return <FiCheckCircle size={32} />;
            case 'error': return <FiAlertCircle size={32} />;
            default: return <FiInfo size={32} />;
        }
    };

    const getTitle = () => {
        if (isShiftBlocked) {
            return type === 'warning' ? 'Shift Action Blocked' : 'Shift Notification';
        }
        switch (type) {
            case 'warning': return 'Attention Needed';
            case 'success': return 'Action Successful';
            case 'error': return 'System Error';
            default: return 'System Notification';
        }
    };

    const handleAction = () => {
        if (onAction) onAction();
        onClose();
    };

    React.useEffect(() => {
        if (duration > 0 && !actionLabel) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose, actionLabel]);

    return createPortal(
        <AnimatePresence mode="wait">
            <div className={`toast-portal-root toast-${type}`}>
                {/* Fixed Overlay Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="toast-modal-overlay"
                >
                    {/* Modern High-Fidelity Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="toast-modal-card"
                    >
                        {/* Premium Icon Ring / Mesh Gradient Wrapper */}
                        <div className="toast-icon-container">
                            <motion.div 
                                animate={{ 
                                    boxShadow: ['0 0 20px rgba(99, 102, 241, 0.2)', '0 0 40px rgba(99, 102, 241, 0.5)', '0 0 20px rgba(99, 102, 241, 0.2)']
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                className="toast-icon-wrapper"
                            >
                                <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_50%_0%,_#fff,_transparent_70%)]" />
                                <div className="relative text-white flex items-center justify-center">
                                    {getIcon()}
                                </div>
                            </motion.div>
                            
                            <div className="toast-icon-pulse animate-pulse" />
                        </div>

                        {/* Impactful Header Section */}
                        <h3 className="toast-title">
                            {getTitle()}
                        </h3>
                        
                        <p className="toast-message">
                            {message}
                        </p>

                        {/* Action Buttons Stack */}
                        <div className="toast-actions">
                            {actionLabel && (
                                <motion.button 
                                    whileHover={{ scale: 1.02, translateY: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleAction}
                                    className="btn-toast-primary"
                                >
                                    {actionLabel}
                                    <FiArrowRight size={18} />
                                </motion.button>
                            )}
                            
                            <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onClose}
                                className="btn-toast-secondary"
                            >
                                {actionLabel ? 'Close and solve later' : 'Understood, proceed'}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};
