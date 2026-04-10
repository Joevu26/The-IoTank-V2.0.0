import { 
    FiDatabase, FiCpu, FiActivity, FiFileText 
} from 'react-icons/fi';
import React from 'react';

export const FAQ_CATEGORIES = [
    {
        name: 'Tanks & Calibration',
        icon: React.createElement(FiDatabase),
        items: [
            { id: 1, question: "Calibration frequency?", answer: "Every 6 months or post-maintenance. IoTank auto-drift handles minor shifts by comparing physical dips against ultrasonic telemetry every 24 hours." },
            { id: 2, question: "Standardized Volume?", answer: "All volumetric data is corrected to the international standard of 15.6°C (60°F). This eliminates thermal expansion variances between noon and midnight shifts." },
            { id: 10, question: "Dip Variance?", answer: "A variance of up to 0.5% (EPRA standard) is considered nominal during massive fuel deliveries due to surface turbulence and air entrapment." }
        ]
    },
    {
        name: 'Telemetry & Hardware',
        icon: React.createElement(FiCpu),
        items: [
            { id: 3, question: "Node Offline?", answer: "1. verify the power supply (240V industrial). 2. Ensure Wi-Fi signal is >-75dBm. 3. Restart the node. If issues persist, trigger a System Diagnostics scan." },
            { id: 4, question: "Battery Life?", answer: "IoTank industrial nodes typically last 18-24 months per charge cycle. Low battery alerts trigger automatically at 15% charge capacity." },
            { id: 11, question: "Ultrasonic Interference?", answer: "Foaming during fast-fill can cause temporary 'echo-lost' signals. The system uses a moving-average filter to maintain display stability until the foam settles." }
        ]
    },
    {
        name: 'AI & Forecasting',
        icon: React.createElement(FiActivity),
        items: [
            { id: 5, question: "Forecast Accuracy?", answer: "The Gemini AI engine achieves >95% accuracy after 72 hours of baseline data. High-volatility cycles (e.g. OTS reviews) may cause temporary index shifts." },
            { id: 12, question: "Strategic Buy Signals?", answer: "Buy signals are triggered when 'Strategic Risk' is HIGH and EPRA price projections indicate a >KES 5.00/L upward movement." }
        ]
    },
    {
        name: 'Compliance',
        icon: React.createElement(FiFileText),
        items: [
            { id: 6, question: "Is data audit-ready?", answer: "Yes. Every inventory record is cryptographically signed. Any attempted manual override in the database will be flagged during OTS audits." },
            { id: 13, question: "EPRA Reporting?", answer: "Weekly reports are formatted to align with EPRA gazetted cycles, allowing one-click export for regulatory compliance." }
        ]
    }
];
