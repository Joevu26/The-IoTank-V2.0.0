
// Export market data fetchers
import { fetchMarketData } from './marketDataFetcher';
import { fetchNonApiIntelligence } from './nonApiDataAcquisition';
import { smoothreadings } from './smoothing';
import { detectLeaks } from './leakDetection';
import { connectivityWatchdog } from './watchdog';
import { dailyRollup } from './rollup';
import { verifyRecaptcha } from './recaptcha';
import { proxyGemini, proxyGroq, proxyDeepSeek } from './apiProxy';
import { proxyNewsAPI, proxyEIA, proxyAlphaVantage } from './marketProxy';

export {
    fetchMarketData,
    fetchNonApiIntelligence,
    smoothreadings,
    detectLeaks,
    connectivityWatchdog,
    dailyRollup,
    verifyRecaptcha,
    proxyGemini,
    proxyGroq,
    proxyDeepSeek,
    proxyNewsAPI,
    proxyEIA,
    proxyAlphaVantage
};
