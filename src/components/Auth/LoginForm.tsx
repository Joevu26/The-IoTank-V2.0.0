import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FaGoogle, FaTimesCircle, FaEnvelope, FaLock, FaShieldAlt, FaDollarSign, FaChartBar, FaSearch, FaCog } from 'react-icons/fa';
import { PasswordInput } from './PasswordInput';
import { authRateLimiter } from '@/utils/rateLimiter';
import './LoginForm.css';
import TermsModal from '../Landing/TermsModal';
import '../Landing/TermsModal.css';
import { OnboardingModal } from './OnboardingModal';
import { RegistrationRequestForm } from './RegistrationRequestForm';
import { getAuthFriendlyErrorMessage } from '@/utils/authErrors';
import brandMark from '@/assets/iotank-logo-v3.png';




export const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [rateLimitError, setRateLimitError] = useState('');
    const [remainingAttempts, setRemainingAttempts] = useState(0);

    const { signIn, signInWithGoogle, currentUser } = useAuth();
    const navigate = useNavigate();
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [showRegRequest, setShowRegRequest] = useState(false);




    const formatResetTime = (timeMs: number): string => {
        const minutes = Math.ceil((timeMs - Date.now()) / (1000 * 60));
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        const hours = Math.ceil(minutes / 60);
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    };

    const processSignIn = async () => {
        try {
            authRateLimiter.recordAttempt(email.toLowerCase().trim());
            const userCredential = await signIn(email, password);
            if (userCredential?.user) {
                // Audit log is written after the user profile is loaded via AuthContext,
                // so currentUser (with a valid org ID) is available. Skipping here avoids
                // the 400 error caused by passing 'pending' as a station_id UUID.
            }
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Auth Error:', err);
            const friendlyMsg = getAuthFriendlyErrorMessage(err);
            setError(friendlyMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setRateLimitError('');
        const identifier = email.toLowerCase().trim();
        const rateLimit = authRateLimiter.canAttempt(identifier);

        if (!rateLimit.allowed) {
            setRateLimitError(`Too many failed attempts. Please try again in ${formatResetTime(rateLimit.resetTime!)}.`);
            setRemainingAttempts(rateLimit.remainingAttempts);
            setLoading(false);
            return;
        }

        setRemainingAttempts(rateLimit.remainingAttempts);
        setLoading(true);
        await processSignIn();
    };


    const handleTermsAccepted = () => {
        setIsTermsOpen(false);
        setShowRegRequest(true);
    };

    const initiateSignUp = () => {
        setIsTermsOpen(true);
    };


    const handleGoogleSignIn = async () => {
        setError('');
        setRateLimitError('');
        setLoading(true);
        try {
            await signInWithGoogle();
            navigate('/dashboard');
        } catch (err: any) {
            console.error("Google Auth Error:", err);
            setError(getAuthFriendlyErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="branding-section">
                <div className="branding-content">
                    <img src={brandMark} alt="IoTank Logo" className="branding-logo" />
                    <h1 className="branding-title">Advanced Fuel Intelligence</h1>
                    <p className="branding-description">Enterprise-grade monitoring, analytics, and governance for your fuel assets.</p>
                    <div className="value-statements">
                        <div className="value-item item-1">
                            <div className="value-icon"><FaShieldAlt /></div>
                            <div className="value-number">01</div>
                            <strong>Total Asset Security</strong>
                            <span>Real-time theft detection and leak alerts protect your inventory 24/7.</span>
                        </div>
                        <div className="value-item item-2">
                            <div className="value-icon"><FaDollarSign /></div>
                            <div className="value-number">02</div>
                            <strong>Financial Clarity</strong>
                            <span>See the exact dollar value of your fuel with live market pricing.</span>
                        </div>
                        <div className="value-item item-3">
                            <div className="value-icon"><FaChartBar /></div>
                            <div className="value-number">03</div>
                            <strong>Pinpoint Accuracy</strong>
                            <span>Physics-based corrections deliver precise volume readings you can trust.</span>
                        </div>
                        <div className="value-item item-4">
                            <div className="value-icon"><FaSearch /></div>
                            <div className="value-number">04</div>
                            <strong>AI-Powered Insights</strong>
                            <span>Smart procurement advice tells you exactly when to refill for maximum savings.</span>
                        </div>
                        <div className="value-item item-5">
                            <div className="value-icon"><FaCog /></div>
                            <div className="value-number">05</div>
                            <strong>Instant Alerts</strong>
                            <span>Get notified the moment something unusual happens—day or night.</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="form-section">
                <div className="login-container">
                    <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} onComplete={handleTermsAccepted} />

                    {currentUser && <OnboardingModal isOpen={showOnboarding} user={currentUser} onComplete={() => { setShowOnboarding(false); navigate('/dashboard'); }} />}
                    {showRegRequest && (
                        <RegistrationRequestForm onBack={() => setShowRegRequest(false)} />
                    )}

                    <div className={`login-card card ${showOnboarding || showRegRequest ? 'hidden' : ''}`}>

                        <div className="login-header">
                            <h2 className="login-title">Welcome Back</h2>
                            <p className="login-subtitle">Sign in to your dashboard</p>
                        </div>
                        <div className="login-body">
                            <>
                                {rateLimitError && (
                                    <div className="alert alert-danger flex items-start gap-2" role="alert">
                                        <FaTimesCircle className="mt-1 flex-shrink-0" />
                                        <div>
                                            <span>{rateLimitError}</span>
                                            {remainingAttempts > 0 && <div className="text-sm mt-1 opacity-75">{remainingAttempts} attempt{remainingAttempts > 1 ? 's' : ''} remaining</div>}
                                        </div>
                                    </div>
                                )}
                                {error && (
                                    <div className="alert alert-danger flex items-start gap-2" role="alert">
                                        <FaTimesCircle className="mt-1 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}
                                <form onSubmit={handleSubmit} className="login-form">
                                    <div style={{ opacity: 0, position: 'absolute', top: -1000, left: -1000, height: 0, width: 0, overflow: 'hidden' }} aria-hidden="true">
                                        <input type="text" name="username_fake" tabIndex={-1} autoComplete="off" />
                                        <input type="password" name="password_fake" tabIndex={-1} autoComplete="off" />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="email"><FaEnvelope className="inline-icon" /> Email Address</label>
                                        <input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required aria-required="true" autoComplete="new-password" />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="password"><FaLock className="inline-icon" /> Password</label>
                                        <PasswordInput id="password" name="password" value={password} onChange={setPassword} showStrength={false} placeholder="Enter your password" autoComplete="new-password" />
                                    </div>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary" 
                                        disabled={loading}
                                        style={{ 
                                            minWidth: '220px', 
                                            height: '48px', 
                                            margin: '0 auto', 
                                            display: 'flex', 
                                            justifyContent: 'center',
                                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                        }}
                                    >
                                        {loading ? (
                                            <div className="loading-dots">
                                                <span></span><span></span><span></span>
                                            </div>
                                        ) : 'Sign In'}
                                    </button>

                                </form>
                                <button onClick={handleGoogleSignIn} className="btn btn-secondary btn-block mt-4" disabled={loading}><FaGoogle /> Continue with Google</button>
                                 <div className="login-footer">
                                    <Link to="/forgot-password" title="Forgot password link" className="text-link">Lost Access?</Link>
                                </div>
                            </>
                        </div>
                    </div>

                    <div className={`registration-promo-card card ${showOnboarding || showRegRequest ? 'hidden' : ''}`}>
                        <div className="promo-icon">
                            <FaShieldAlt />
                        </div>
                        <div className="promo-body">
                            <h3>new station?</h3>
                            <p>complete technical configuration to initialize your enterprise account</p>
                        </div>
                        <button type="button" className="promo-action-btn" onClick={initiateSignUp}>
                            request platform access
                        </button>
                    </div>
                    <footer className="login-page-footer">
                        <p className="text-sm text-secondary">© 2026 IoTank. All rights reserved.</p>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;
