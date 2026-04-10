import React, { useState, useEffect } from 'react';
import { Steps } from 'intro.js-react';
import 'intro.js/introjs.css';
import { enableGovernanceConsole } from '@/config/supabase';

export const TourGuide: React.FC = () => {
    const [enabled, setEnabled] = useState(false);
    const [initialStep] = useState(0);

    useEffect(() => {
        // Auto-start tour if strictly first time (simulated via localStorage)
        const hasSeenTour = localStorage.getItem('iotank_tour_seen');
        if (!hasSeenTour) {
            // Delay slightly to ensure elements render
            setTimeout(() => setEnabled(true), 2000);
        }
    }, []);

    const onExit = () => {
        setEnabled(false);
        localStorage.setItem('iotank_tour_seen', 'true');
    };

    const steps = [
        {
            element: '.operator-identity-module',
            intro: 'Welcome to the IoTank Fuel Intelligence Hub! This is your operator profile. Click here to manage your company identity.',
            position: 'right',
        },
        {
            element: '.sidebar',
            intro: 'This is your main navigation menu. Let\'s take a quick sequential tour of the platform capabilities.',
            position: 'right',
        },
        {
            element: 'a[href="/dashboard"]',
            intro: 'Your Command Center. View real-time tank levels, temperature, and volume metrics here.',
            position: 'right',
        },
        {
            element: 'a[href="/inventory"]',
            intro: 'Manage your entire fuel stock. Track incoming deliveries and current tank capacities.',
            position: 'right',
        },
        {
            element: 'a[href="/analytics"]',
            intro: 'Deep dive into data. View consumption trends, forecasting, and performance metrics.',
            position: 'right',
        },
        {
            element: 'a[href="/analytics/history"]',
            intro: 'Analyze past performance and historical data logs for all your connected sites.',
            position: 'right',
        },
        {
            element: 'a[href="/event-log"]',
            intro: 'Review system events. Track all automated actions and user operations sequentially.',
            position: 'right',
        },
        {
            element: 'a[href="/market"]',
            intro: 'Access the Market Lens. View real-time price signals, procurement advisories, and supply chain risks.',
            position: 'right',
        },
        {
            element: 'a[href="/alerts"]',
            intro: 'Stay informed. Manage critical notifications, threshold warnings, and system alerts.',
            position: 'right',
        },
        {
            element: 'a[href="/reporting"]',
            intro: 'Generate compliance documents, audit logs, and scheduled PDF reports.',
            position: 'right',
        },
        {
            element: 'a[href="/users"]',
            intro: 'Manage your Team. Add personnel, assign roles, and handle cross-site access credentials.',
            position: 'right',
        },
        {
            element: 'a[href="/billing"]',
            intro: 'Access your Billing portal to review ongoing subscription plans and invoicing history.',
            position: 'right',
        },
        ...(enableGovernanceConsole ? [{
            element: 'a[href="/governance"]',
            intro: 'Configure AI Governance, manage user roles, and define security policies.',
            position: 'right',
        }] : []),
        {
            element: 'a[href="/settings"]',
            intro: 'Customize your experience. Update your profile, organization details, and preferences.',
            position: 'right',
        },
        {
            element: 'a[href="/help"]',
            intro: 'Need assistance? Access documentation, support channels, and FAQs here.',
            position: 'right',
        },
        {
            element: '.quick-action-btn',
            intro: 'Power user capabilities at your fingertips: Quickly log fuel deliveries, manage shifts, and pull instant reports.',
            position: 'bottom',
        },
        {
            element: 'button[aria-label="Notifications"]',
            intro: 'Real-time alert center. Get notified immediately about critical events or anomalous logic.',
            position: 'bottom',
        },
        {
            element: '.user-menu-container',
            intro: 'Quick access to log out or manage your personal session security credentials.',
            position: 'left',
        }
    ];

    return (
        <Steps
            enabled={enabled}
            steps={steps}
            initialStep={initialStep}
            onExit={onExit}
            options={{
                doneLabel: 'Get Started',
                showProgress: true,
                showBullets: false,
                tooltipClass: 'custom-tour-tooltip',
                highlightClass: 'custom-tour-highlight'
            }}
        />
    );
};
