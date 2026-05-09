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

import { seoDefaults, structuredData } from '@/config/seo';

// 1. DYNAMIC SEO & JSON-LD INJECTION
// Standardizing security: Removing inline scripts from index.html
const injectSEO = () => {
    document.title = seoDefaults.title;

    const setMeta = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', name);
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
    };

    setMeta('description', seoDefaults.description);
    setMeta('keywords', seoDefaults.keywords);

    // Inject JSON-LD
    let script = document.querySelector('script[type="application/ld+json"]');
    if (!script) {
        script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);
};

injectSEO();

// Remove preload class to enable theme transitions
setTimeout(() => {
    document.body.classList.remove('preload');
}, 100);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
);
