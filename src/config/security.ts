export const SECURITY_CONFIG = {
    // Master Access Password used for Landing page login and Settings admin gate
    // DEPRECATED: Use account-level password verification via Supabase Auth instead.
    MASTER_ACCESS_PASSWORD: import.meta.env.VITE_MASTER_ACCESS_PASSWORD || '',

    // MED-006: Hardcoded fallback removed — key MUST be set in .env / .env.production.
    // If missing in production, reCAPTCHA will fail and the login form will surface an error.
    RECAPTCHA_V3_SITEKEY: import.meta.env.VITE_RECAPTCHA_V3_SITEKEY as string,
    RECAPTCHA_V3_SCORE_THRESHOLD: 0.5, // Score 0.0 - 1.0, reject if below this

    // Future security configurations can be added here
    MAX_LOGIN_ATTEMPTS: 5,
    SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
};
