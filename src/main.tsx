import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@/config/i18n';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker
const updateSW = registerSW({
    onNeedRefresh() {
        if (confirm('New version available. Refresh now?')) {
            updateSW(true);
        }
    },
    onOfflineReady() {
        // IoTank Fuel Hub is ready for offline operation.
    },
});

// Remove preload class to enable theme transitions
setTimeout(() => {
    document.body.classList.remove('preload');
}, 100);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
