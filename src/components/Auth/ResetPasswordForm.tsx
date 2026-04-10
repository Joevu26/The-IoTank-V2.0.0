/* eslint-disable react/no-unescaped-entities */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaLock, FaCheckCircle, FaExclamationTriangle, FaShieldAlt } from 'react-icons/fa';
import { supabase } from '@/config/supabase';
import { PasswordInput } from './PasswordInput';
import './LoginForm.css';

export const ResetPasswordForm: React.FC = () => {
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
            
            // If session exists but isn't recovery, it might just be the user landing.
            // In most reset flows, type will be 'recovery'.
            if (session) {
                setLoading(false);
                return;
            }

            if (retries < maxRetries) {
                retries++;
                setTimeout(checkSession, retryInterval);
            } else {
                setError('No active recovery session found. Please request a new reset link and ensure you click the link directly.');
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
            setError('Password must be at least 8 characters long.');
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
            console.error('Password update error:', err);
            setError(err.message || 'Failed to update password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="form-section" style={{ flex: '1', justifyContent: 'center' }}>
                <div className="login-container">
                    <div className="login-card card">
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
                            <h2 className="login-title" style={{ fontSize: '1.8rem' }}>
                                {success ? 'Password Updated' : 'Secure Reset'}
                            </h2>
                            <p className="login-subtitle">
                                {success 
                                    ? 'Your credentials have been re-synchronized. Redirecting to login...' 
                                    : 'Establish a new high-entropy password for your account.'}
                            </p>
                        </div>

                        <div className="login-body">
                            {error && (
                                <div className="alert alert-danger mb-6 flex items-start gap-2" role="alert" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1rem', borderRadius: '0.75rem' }}>
                                    <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {success ? (
                                <div className="text-center py-4">
                                    <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                                        Return to Login Now
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="login-form">
                                    <div className="form-group mb-4">
                                        <label htmlFor="password"><FaLock className="inline-icon" /> NEW PASSWORD</label>
                                        <PasswordInput
                                            id="password"
                                            value={password}
                                            onChange={setPassword}
                                            showStrength={true}
                                            placeholder="Enter strong password"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <div className="form-group mb-8">
                                        <label htmlFor="confirm-password"><FaLock className="inline-icon" /> CONFIRM NEW PASSWORD</label>
                                        <input
                                            id="confirm-password"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Repeat new password"
                                            className="form-control"
                                            autoComplete="new-password"
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={loading || !!error}
                                        style={{ 
                                            width: '100%', 
                                            height: '48px',
                                            display: 'flex', 
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {loading ? (
                                            <div className="loading-dots">
                                                <span></span><span></span><span></span>
                                            </div>
                                        ) : 'Update Password & Re-sync'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
