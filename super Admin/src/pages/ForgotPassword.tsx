import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FaEnvelope, FaChevronLeft, FaPaperPlane, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import './Login.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const { resetPassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email) {
            setError('Please enter your administrator email.');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(email.toLowerCase().trim());
            setSent(true);
        } catch (err: any) {
            console.error('Reset error:', err);
            setError(err.message || 'Failed to send reset email. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page-wrapper">
            {/* Using the same layout structure as Login.tsx for perfect alignment */}
            <div className="branding-section">
                <div className="branding-content">
                    <h1 className="branding-title">Admin Recovery</h1>
                    <p className="branding-description">
                        Locked out? Enter your credentials to initiate a secure biometric-linked password reset.
                    </p>
                </div>
            </div>

            <div className="form-section">
                <div className="login-container">
                    <div className="login-card">
                        <div className="login-header">
                            <div className="recovery-icon-circle">
                                {sent ? <FaCheckCircle className="text-success" /> : <FaPaperPlane />}
                            </div>
                            <h2 className="login-title">{sent ? 'Check Your Inbox' : 'System Recovery'}</h2>
                            <p className="login-subtitle">
                                {sent 
                                    ? `Verification link dispatched to ${email}`
                                    : 'Enter your verified email for clearance'}
                            </p>
                        </div>

                        <div className="login-body">
                            {error && (
                                <div className="alert alert-danger">
                                    <FaExclamationTriangle />
                                    <span>{error}</span>
                                </div>
                            )}

                            {sent ? (
                                <div className="recovery-success-content">
                                    <p className="status-message">
                                        If the email is registered in our secure database, you will receive a reset link shortly. 
                                        Please check your spam folder if it doesn't arrive in 2 minutes.
                                    </p>
                                    <Link to="/login" className="btn btn-primary btn-block">
                                        <FaChevronLeft className="inline-icon" /> Return to Login
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="login-form">
                                    <div className="form-group">
                                        <label htmlFor="email"><FaEnvelope className="inline-icon" /> Administrator Email</label>
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="admin@iotank.ai"
                                            autoComplete="off"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                                        {loading ? <div className="spinner" /> : 'Send Reset Link'}
                                    </button>
                                    
                                    <div className="login-footer">
                                        <Link to="/login" className="text-link">
                                            <FaChevronLeft className="inline-icon" /> Back to Safety
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

export default ForgotPassword;
