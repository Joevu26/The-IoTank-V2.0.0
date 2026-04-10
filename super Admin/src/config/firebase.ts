import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getFunctions } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import { getPerformance } from 'firebase/performance';
import { getAnalytics } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';

// Helper to get config from localStorage if it exists
const getStoredFirebaseConfig = () => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem('iotank_firebase_config');
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.error('Error reading dynamic Firebase config:', e);
        return null;
    }
};

const storedConfig = getStoredFirebaseConfig();

// Firebase configuration priority: localStorage > env variables
export const firebaseConfig = storedConfig || {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "the-iotank-project.web.app",
    projectId: "the-iotank-project",
    storageBucket: "the-iotank-project.firebasestorage.app",
    messagingSenderId: "876275277280",
    appId: "1:876275277280:web:e57baa4a7ed2bc76321f85",
    measurementId: "G-TN245B9S56"
};

// Validate configuration
const validateConfig = () => {
    const requiredFields = ['apiKey', 'authDomain', 'projectId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

    if (missingFields.length > 0) {
        console.error('Missing Firebase configuration:', missingFields);
        console.info('Please create a .env file based on .env.example and add your Firebase credentials.');
    }
};

validateConfig();

// Initialize Firebase app
let app: any = null;
let functions: any = null;
let performance: any = null;
let analytics: any = null;

// Check if we have valid config
const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;

if (hasConfig) {
    try {
        // Handle HMR (Hot Module Replacement) during dev
        // If app already exists, use it to avoid "Firebase App named '[DEFAULT]' already exists" error
        app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

        if (!functions) functions = getFunctions(app);

        // Performance monitoring and Analytics
        if (typeof window !== 'undefined') {
            if (!performance) performance = getPerformance(app);
            if (!analytics) analytics = getAnalytics(app);
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
} else {
    console.warn('RUNNING IN MOCK MODE: Firebase configuration is missing.');
}

export const isMockMode = !hasConfig;

// Export Firebase instances
export { app, functions, performance, analytics };

// Export types for type safety
export type { FirebaseApp, Functions, Analytics };
