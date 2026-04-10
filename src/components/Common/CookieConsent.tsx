import React, { useState, useEffect } from 'react';
import './CookieConsent.css';
import { FiShield, FiSettings, FiCheck } from 'react-icons/fi';

export const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [preferences, setPreferences] = useState({
        essential: true, // Always true
        analytics: true,
        marketing: false,
    });

    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            // Slight delay before showing for better UX
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        } else {
            setPreferences(JSON.parse(consent));
        }
    }, []);

    const handleAcceptAll = () => {
        const allStats = { essential: true, analytics: true, marketing: true };
        saveConsent(allStats);
    };

    const handleAcceptEssential = () => {
        const essentialStats = { essential: true, analytics: false, marketing: false };
        saveConsent(essentialStats);
    };

    const handleSavePreferences = () => {
        saveConsent(preferences);
    };

    const saveConsent = (stats: typeof preferences) => {
        localStorage.setItem('cookie-consent', JSON.stringify(stats));
        setIsVisible(false);
        setShowSettings(false);
        // Optional: Dispatch event if other components need to know
        window.dispatchEvent(new Event('cookie-consent-updated'));
    };

    if (!isVisible) return null;

    return (
        <div className={`cookie-consent-container ${showSettings ? 'expanded' : ''}`}>
            <div className="cookie-consent-card animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="cookie-consent-inner">
                    <div className="cookie-main-content">
                        <div className="cookie-icon-wrapper">
                            <FiShield className="cookie-icon" />
                        </div>
                        <div className="cookie-text-content">
                            <h3>We Value Your Privacy</h3>
                            <p>
                                We use cookies to enhance your experience. <strong>Login data is never stored in cookies.</strong>
                                {!showSettings && " By clicking \"Accept All\", you agree to the storing of cookies to enhance site navigation and analyze site usage."}
                            </p>
                        </div>
                        {!showSettings && (
                            <button className="settings-trigger-icon" onClick={() => setShowSettings(true)} aria-label="Cookie Settings">
                                <FiSettings size={18} />
                            </button>
                        )}
                    </div>

                    {!showSettings ? (
                        <div className="cookie-consent-actions">
                            <button className="cookie-btn-outline" onClick={handleAcceptEssential}>
                                Essential Only
                            </button>
                            <button className="cookie-btn-outline" onClick={handleAcceptAll}>
                                Accept All
                            </button>
                        </div>
                    ) : (
                        <div className="cookie-consent-settings animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="settings-list">
                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Strictly Necessary</label>
                                        <p>Required for basic site functionality. Cannot be disabled.</p>
                                    </div>
                                    <div className="setting-toggle disabled">
                                        <div className="toggle-track active">
                                            <FiCheck className="toggle-check" />
                                        </div>
                                    </div>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Analytics & Performance</label>
                                        <p>Help us improve by understanding how you use the site.</p>
                                    </div>
                                    <div className="setting-toggle" onClick={() => setPreferences(prev => ({ ...prev, analytics: !prev.analytics }))}>
                                        <div className={`toggle-track ${preferences.analytics ? 'active' : ''}`}>
                                            {preferences.analytics && <FiCheck className="toggle-check" />}
                                        </div>
                                    </div>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-info">
                                        <label>Marketing & Personalization</label>
                                        <p>Used to provide relevant updates and service news.</p>
                                    </div>
                                    <div className="setting-toggle" onClick={() => setPreferences(prev => ({ ...prev, marketing: !prev.marketing }))}>
                                        <div className={`toggle-track ${preferences.marketing ? 'active' : ''}`}>
                                            {preferences.marketing && <FiCheck className="toggle-check" />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="cookie-consent-actions settings-actions">
                                <button className="cookie-btn-text" onClick={() => setShowSettings(false)}>
                                    Back
                                </button>
                                <button className="cookie-btn-outline" onClick={handleSavePreferences}>
                                    Save Preferences
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
