import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../config/supabase';
import { FaLock, FaShieldAlt, FaCheckCircle, FaExclamationTriangle, FaChevronLeft } from 'react-icons/fa';
import './Login.css';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        let retries = 0;
        const maxRetries = 10;
        const retryInterval = 500; // ms

        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setLoading(false);
                return;
            }

            if (retries < maxRetries) {
                retries++;
                setTimeout(checkSession, retryInterval);
            } else {
                setError('No active recovery session found. Please request a new reset link.');
                setLoading(false);
            }
        };

        // Also listen for the initial event which might fire after getSession
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
                setLoading(false);
                setError('');
            }
        });

        setLoading(true);
        checkSession();

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long for administrative access.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            console.error('Admin password update error:', err);
            setError(err.message || 'Failed to update administrative password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="branding-section">
                <div className="branding-content">
                    <h1 className="branding-title">Security Gateway</h1>
                    <p className="branding-description">
                        Administrative access recovery. Re-establishing secure handshake protocols for your governance account.
                    </p>
                </div>
            </div>

            <div className="form-section">
                <div className="login-container">
                    <div className="login-card">
                        <div className="login-header">
                            <div className="recovery-icon-circle" style={{ 
                                width: '64px', 
                                height: '64px', 
                                background: 'rgba(0, 212, 255, 0.1)', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                color: '#00D4FF',
                                fontSize: '1.5rem'
                            }}>
                                {success ? <FaCheckCircle style={{ color: '#10b981' }} /> : <FaShieldAlt />}
                            </div>
                            <h2 className="login-title">{success ? 'Access Restored' : 'Credential Reset'}</h2>
                            <p className="login-subtitle">
                                {success 
                                    ? 'Administrative credentials updated. Synchronizing...' 
                                    : 'Enter your new high-security password below.'}
                            </p>
                        </div>

                        <div className="login-body">
                            {error && (
                                <div className="alert alert-danger">
                                    <FaExclamationTriangle />
                                    <span>{error}</span>
                                </div>
                            )}

                            {success ? (
                                <div className="recovery-success-content">
                                    <p className="status-message">
                                        Your password has been successfully updated. You will be redirected to the login portal shortly.
                                    </p>
                                    <Link to="/login" className="btn btn-primary btn-block">
                                        Go to Login
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="login-form">
                                    <div className="form-group">
                                        <label htmlFor="password"><FaLock className="inline-icon" /> New Admin Password</label>
                                        <input
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Min. 8 characters"
                                            required
                                            disabled={loading}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="confirm-password"><FaLock className="inline-icon" /> Confirm Password</label>
                                        <input
                                            id="confirm-password"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repeat password"
                                            required
                                            disabled={loading}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-block" disabled={loading || !!error}>
                                        {loading ? <div className="spinner" /> : 'Set New Password'}
                                    </button>
                                    
                                    <div className="login-footer">
                                        <Link to="/login" className="text-link">
                                            <FaChevronLeft className="inline-icon" /> Cancel Recovery
                                        </Link>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

                <footer className="login-page-footer">
                    <p>© 2026 IoTank Governance Hub. All rights reserved.</p>
                </footer>
            </div>
        </div>
    );
};

export default ResetPassword;
