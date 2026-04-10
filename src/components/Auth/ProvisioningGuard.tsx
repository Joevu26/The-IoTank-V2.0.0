import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FiRefreshCw, FiCheckCircle, FiLoader, FiShield, FiCpu, FiActivity, FiServer } from 'react-icons/fi';

interface ProvisioningGuardProps {
    children: React.ReactNode;
}

/**
 * Enhanced ProvisioningGuard matching the Login UI's Light Glassmorphism aesthetic.
 */
export const ProvisioningGuard: React.FC<ProvisioningGuardProps> = ({ children }) => {
    const { currentUser, signOut } = useAuth();
    const [isRetrying, setIsRetrying] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Finalizing technical configuration for your station account...');

    const isProvisioned = !!currentUser?.stationId;
    const isSystem = currentUser?.isSystemAccount;

    const handleRetry = () => {
        setIsRetrying(true);
        setStatusMessage('Re-synchronizing security clearance with the Provisioning Hub...');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    };

    if (!isProvisioned && !isSystem && currentUser) {
        return (
            <div style={styles.overlay}>
                <div style={styles.backgroundPatterns}></div>
                
                <div style={styles.card}>
                    <div style={styles.header}>
                        <div style={styles.logoCircle}>
                            <FiServer style={styles.logoIcon} />
                        </div>
                        <h2 style={styles.title}>System Initialization</h2>
                        <p style={styles.subtitle}>Configuring your secure enterprise environment</p>
                    </div>

                    <div style={styles.body}>
                        <div style={styles.loaderArea}>
                            <div style={styles.pulseRing}></div>
                            <FiLoader style={{ ...styles.loaderIcon, animation: 'spin 2s linear infinite' }} />
                        </div>

                        <p style={styles.statusText}>{statusMessage}</p>

                        <div style={styles.steps}>
                            <div style={styles.stepItem}>
                                <div style={styles.stepInfo}>
                                    <FiShield style={styles.stepIcon} />
                                    <span>Identity Clearance</span>
                                </div>
                                <FiCheckCircle style={styles.successColor} />
                            </div>
                            <div style={styles.stepItem}>
                                <div style={styles.stepInfo}>
                                    <FiCpu style={{ ...styles.stepIcon, color: '#3b82f6' }} />
                                    <span>Station Allocation</span>
                                </div>
                                <div style={styles.pendingDot}></div>
                            </div>
                            <div style={styles.stepItem}>
                                <div style={styles.stepInfo}>
                                    <FiActivity style={styles.stepIcon} />
                                    <span>Telemetry Uplink</span>
                                </div>
                                <div style={{ ...styles.pendingDot, animationDelay: '0.4s' }}></div>
                            </div>
                        </div>

                        <div style={styles.actions}>
                            <button 
                                onClick={handleRetry}
                                disabled={isRetrying}
                                style={{ ...styles.primaryBtn, opacity: isRetrying ? 0.7 : 1 }}
                            >
                                <FiRefreshCw style={{ animation: isRetrying ? 'spin 1s linear infinite' : 'none' }} />
                                {isRetrying ? 'Synchronizing...' : 'Force System Sync'}
                            </button>
                            
                            <button 
                                onClick={() => signOut()}
                                style={styles.secondaryBtn}
                            >
                                Re-authenticate Session
                            </button>
                        </div>
                    </div>

                    <div style={styles.footer}>
                        TRACE_ID: {currentUser.authUserId.slice(0, 8).toUpperCase()} // NODE_01
                    </div>
                </div>

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    @keyframes ping { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(1.5); opacity: 0; } }
                    @keyframes pulseSmall { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.6); opacity: 0.5; } }
                `}</style>
            </div>
        );
    }

    return <>{children}</>;
};

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        height: '100vh',
        width: '100vw',
        backgroundColor: '#f1f5f9',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.05) 0, transparent 50%), radial-gradient(at 50% 0%, rgba(99, 102, 241, 0.03) 0, transparent 50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Segoe UI', Roboto, sans-serif"
    },
    backgroundPatterns: {
        position: 'absolute',
        inset: 0,
        opacity: 0.4,
        backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")'
    },
    card: {
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: '410px',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(30px) saturate(150%)',
        borderRadius: '28px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(255, 255, 255, 0.5) inset',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        overflow: 'hidden',
        transition: 'transform 0.3s ease'
    },
    header: {
        padding: '32px 32px 16px',
        textAlign: 'center'
    },
    logoCircle: {
        width: '56px',
        height: '56px',
        margin: '0 auto 16px',
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 16px rgba(37, 99, 235, 0.2)'
    },
    logoIcon: {
        color: 'white',
        fontSize: '24px'
    },
    title: {
        fontSize: '20px',
        fontWeight: 800,
        color: '#1e293b',
        margin: '0 0 4px',
        letterSpacing: '-0.02em'
    },
    subtitle: {
        fontSize: '13px',
        color: '#64748b',
        margin: 0,
        fontWeight: 500
    },
    body: {
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    loaderArea: {
        position: 'relative',
        marginBottom: '24px'
    },
    pulseRing: {
        position: 'absolute',
        inset: '-10px',
        border: '2px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '50%',
        animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
    },
    loaderIcon: {
        fontSize: '40px',
        color: '#3b82f6'
    },
    statusText: {
        fontSize: '14px',
        color: '#475569',
        textAlign: 'center',
        lineHeight: 1.5,
        marginBottom: '32px',
        fontWeight: 500
    },
    steps: {
        width: '100%',
        background: 'rgba(15, 23, 42, 0.03)',
        borderRadius: '20px',
        padding: '8px',
        marginBottom: '32px'
    },
    stepItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid rgba(15, 23, 42, 0.05)'
    },
    stepInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '13px',
        fontWeight: 600,
        color: '#334155'
    },
    stepIcon: {
        fontSize: '16px',
        color: '#94a3b8'
    },
    successColor: {
        color: '#10b981',
        fontSize: '16px'
    },
    pendingDot: {
        width: '6px',
        height: '6px',
        backgroundColor: '#3b82f6',
        borderRadius: '50%',
        boxShadow: '0 0 8px rgba(3b, 82, f6, 0.4)',
        animation: 'pulseSmall 1.5s ease-in-out infinite'
    },
    actions: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    primaryBtn: {
        width: '100%',
        height: '48px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        transition: 'all 0.2s ease',
        boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.3)'
    },
    secondaryBtn: {
        width: '100%',
        height: '40px',
        background: 'transparent',
        color: '#64748b',
        border: 'none',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'color 0.2s ease'
    },
    footer: {
        padding: '16px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '1px',
        background: 'rgba(0,0,0,0.02)',
        borderTop: '1px solid rgba(0,0,0,0.02)'
    }
};
