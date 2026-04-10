/**
 * Maps Auth error codes to user-friendly messages.
 */
export const getAuthFriendlyErrorMessage = (error: any): string => {
    const code = error?.code || error?.status;
    const message = error?.message || '';

    // Supabase / GoTrue common errors
    if (message.includes('Invalid login credentials')) {
        return 'The password or email are incorrect, enter valid credentials.';
    }
    if (message.includes('Email not confirmed')) {
        return 'Please confirm your email address before signing in.';
    }
    if (message.includes('User not found')) {
        return 'The password or email are incorrect, enter valid credentials.';
    }
    if (code === 'over_confirmation_rate_limit' || message.includes('rate limit')) {
        return 'Too many attempts. Please try again later.';
    }

    // Legacy or generic mappings
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'invalid_credentials':
            return 'The password or email are incorrect, enter valid credentials.';
        case 'auth/email-already-in-use':
            return 'This email is already registered. Try signing in instead.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'PGRST116':
            return 'Access denied. Your profile could not be found or you do not have permission to access it.';
        default:
            return message || `Authentication error (${code || 'unknown'}). Please try again.`;
    }
};

