/* eslint-disable react/no-unescaped-entities */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaEnvelope, FaArrowLeft, FaPaperPlane } from 'react-icons/fa';
import { FiShield } from 'react-icons/fi';
import './LoginForm.css'; // Re-use styling
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '@/hooks/useAuth';

export const ForgotPasswordForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sentToEmail, setSentToEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const { resetPassword } = useAuth();

    const [countdown, setCountdown] = useState(0);

    const startCountdown = () => {
        setCountdown(60);
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            setError('Please enter your email address.');
            return;
        }

        try {
            setMessage('');
            setError('');
            setLoading(true);

            await resetPassword(email);
            setSentToEmail(email);
            setMessage(`Password reset email sent to ${email}.`);
            startCountdown();
        } catch (err: any) {
            setError(err.message || 'Failed to send reset email. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="form-section" style={{ flex: '1', justifyContent: 'center' }}>
                <div className="login-container forgot-password-container">
                    <div className="login-card card">
                        <div className="login-header">
                            <h2 className="login-title" style={{ fontSize: '1.5rem' }}>Reset Password</h2>
                            <p className="login-subtitle text-xs font-semibold opacity-70">Enter your email to receive recovery instructions.</p>
                        </div>

                        <div className="login-body">
                            <div className="status-container">
                                {error && <div className="alert alert-danger mb-4">{error}</div>}
                                
                                <AnimatePresence>
                                    {message && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="success-delivery-card mb-6"
                                        >
                                            <div className="delivery-icon-wrapper">
                                                <FaPaperPlane className="delivery-icon" />
                                                <div className="delivery-ping"></div>
                                            </div>
                                            
                                            <div className="delivery-content">
                                                <h3>Check Your Inbox</h3>
                                                <p>Reset link sent to <span className="highlight-email">{sentToEmail}</span></p>
                                                
                                                <div className="delivery-instructions mt-4">
                                                    <p className="primary-instruction">If you don't see it within 2 minutes:</p>
                                                    <div className="instruction-item">
                                                        <div className="dot"></div>
                                                        <span>Check your <strong>Spam</strong> or <strong>Junk</strong> folder.</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <form onSubmit={handleSubmit} className="login-form">
                                <div className="form-group mb-6">
                                    <label htmlFor="email" className="flex items-center gap-2 mb-2 font-semibold text-sm text-gray-700">
                                        <FaEnvelope className="text-primary" /> EMAIL ADDRESS
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="you@example.com"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center font-medium"
                                    />
                                    <div className="reset-security-note mt-3">
                                        <div className="note-icon"><FiShield size={10} /></div>
                                        <span>A reset link will be sent if the email matches an active account.</span>
                                    </div>
                                </div>

                                <button
                                    disabled={loading || countdown > 0}
                                    className="primary-reset-btn"
                                    type="submit"
                                >
                                    {loading ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : <><FaPaperPlane style={{ display: 'inline', marginRight: '8px' }} /> Send Link</>}
                                </button>
                            </form>

                            <div className="login-footer mt-8">
                                <Link to="/login" className="back-to-login-btn">
                                    <FaArrowLeft size={12} />
                                    <span>Login Access</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
