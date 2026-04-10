import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiInfo, FiAlertCircle, FiCheckCircle, FiShield, FiArrowRight } from 'react-icons/fi';

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

    return createPortal(
        <AnimatePresence mode="wait">
            <div className="toast-portal-root" style={{ position: 'relative', zIndex: 99999999 }}>
                {/* Fixed Overlay Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="toast-modal-overlay"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999999,
                        padding: '24px'
                    }}
                >
                    {/* Modern High-Fidelity Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="toast-modal-card"
                        style={{ 
                            maxWidth: '440px',
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(32px) saturate(1.8)',
                            borderRadius: '40px',
                            boxShadow: '0 48px 100px -24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.4) inset',
                            padding: '48px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            border: '1px solid rgba(255, 255, 255, 0.5)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Premium Icon Ring / Mesh Gradient Wrapper */}
                        <div style={{ position: 'relative', marginBottom: '32px' }}>
                            <motion.div 
                                animate={{ 
                                    boxShadow: ['0 0 20px rgba(99, 102, 241, 0.2)', '0 0 40px rgba(99, 102, 241, 0.5)', '0 0 20px rgba(99, 102, 241, 0.2)']
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
                                }}
                            >
                                <div style={{ position: 'absolute', inset: 0, opacity: 0.4, background: 'radial-gradient(circle at 50% 0%, #fff, transparent 70%)' }} />
                                <div style={{ position: 'relative', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {getIcon()}
                                </div>
                            </motion.div>
                            
                            <div style={{ 
                                position: 'absolute', 
                                top: '-8px', 
                                left: '-8px', 
                                right: '-8px', 
                                bottom: '-8px', 
                                borderRadius: '36px', 
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                            }} />
                        </div>

                        {/* Impactful Header Section */}
                        <h3 style={{ 
                            fontSize: '2.25rem', 
                            fontWeight: 900, 
                            color: '#0f172a', 
                            lineHeight: 1.1, 
                            letterSpacing: '-0.05em', 
                            marginBottom: '16px' 
                        }}>
                            {getTitle()}
                        </h3>
                        
                        <p style={{ 
                            fontSize: '1.05rem', 
                            fontWeight: 700, 
                            color: '#64748b', 
                            lineHeight: 1.6, 
                            marginBottom: '40px', 
                            padding: '0 16px' 
                        }}>
                            {message}
                        </p>

                        {/* Action Buttons Stack */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                            {actionLabel && (
                                <motion.button 
                                    whileHover={{ scale: 1.02, translateY: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleAction}
                                    style={{
                                        width: '100%',
                                        maxWidth: '280px',
                                        height: '56px',
                                        borderRadius: '16px',
                                        background: '#6366f1',
                                        color: 'white',
                                        fontWeight: 900,
                                        fontSize: '14px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: '0 12px 24px -6px rgba(99, 102, 241, 0.5)',
                                        transition: 'box-shadow 0.2s'
                                    }}
                                >
                                    {actionLabel}
                                    <FiArrowRight size={18} />
                                </motion.button>
                            )}
                            
                            <motion.button 
                                whileHover={{ backgroundColor: 'rgba(241, 245, 249, 1)', color: '#0f172a' }}
                                onClick={onClose}
                                style={{
                                    width: '100%',
                                    maxWidth: '280px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'rgba(241, 245, 249, 0.5)',
                                    color: '#475569', // Darker slate for better visibility
                                    fontWeight: 900,
                                    fontSize: '12px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    border: '1px solid rgba(203, 213, 225, 0.8)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
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
