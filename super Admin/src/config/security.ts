export const SECURITY_CONFIG = {
    // Do not hardcode secrets in source code.
    MASTER_ACCESS_PASSWORD: import.meta.env.VITE_MASTER_ACCESS_PASSWORD || '',

    // Future security configurations can be added here
    MAX_LOGIN_ATTEMPTS: 5,
    SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
};
