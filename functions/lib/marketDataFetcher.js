"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMarketData = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const axios_1 = __importDefault(require("axios"));
const supabase_1 = require("./supabase");
// API Keys - For Firebase Spark (free) plan compatibility
// These will be read from .env file during local development
// For production, set them in Firebase Functions environment config
const EIA_API_KEY = process.env.EIA_API_KEY || '';
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || '';
const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY || '';
/**
 * Scheduled function to fetch commodity data from EIA and Alpha Vantage.
 * Runs every hour to stay current with global markets.
 *
 * For Firebase Spark (free) plan:
 * - API keys stored in .env file for local development
 * - For production, hardcode temporarily or upgrade to Blaze plan
 */
exports.fetchMarketData = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
    console.log('Starting Market Data Fetch Cycle...');
    // Validate API keys are present (Exchange Rate is optional but recommended)
    if (!EIA_API_KEY || !ALPHA_VANTAGE_KEY) {
        console.error('API keys not configured. Check .env file or environment variables.');
        return;
    }
    try {
        await fetchEIAData(EIA_API_KEY);
        await fetchAlphaVantageData(ALPHA_VANTAGE_KEY);
        if (EXCHANGE_RATE_API_KEY) {
            await fetchExchangeRateData(EXCHANGE_RATE_API_KEY);
        }
        console.log('Market Data Fetch Cycle Completed Successfully.');
    }
    catch (error) {
        console.error('Error in Market Data Fetch Cycle:', error);
        throw error;
    }
});
/**
 * Fetches crude oil and refined product prices from EIA.
 * Focuses on Brent and WTI benchmarks relevant to Kenya's import parity pricing.
 */
async function fetchEIAData(EIA_API_KEY) {
    var _a, _b, _c;
    try {
        // EIA v2 API Endpoint Construction for Petroleum Prices
        // Note: Simplified fetch for demonstration. Real implementation needs specific series IDs.
        // Kenya benchmarks against Brent (Europe) and Murban (ADNOC), but Brent is the global proxy.
        // Example: Brent Crude Oil Spot Price
        const brentUrl = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${EIA_API_KEY}&frequency=daily&data[0]=value&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`;
        const response = await axios_1.default.get(brentUrl);
        const data = (_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c[0];
        if (data) {
            const { error } = await supabase_1.supabase.from('market_signals').insert({
                source: 'EIA',
                source_url: 'https://www.eia.gov/petroleum/',
                category: 'commodity',
                title: 'Brent Crude Spot Price Update',
                summary: `Latest spot price: $${data.value} per barrel.`,
                confidence: 1.0,
                validated: true,
                data_points: {
                    price: parseFloat(data.value),
                    unit: 'USD/bbl',
                    period: data.period
                },
                source_type: 'API',
                attribution: 'US Energy Information Administration'
            });
            if (error)
                throw error;
            console.log('EIA Brent Data saved to Supabase.');
        }
    }
    catch (error) {
        console.error('Failed to fetch EIA Data:', error);
    }
}
/**
 * Fetches forex and additional commodity signals from Alpha Vantage.
 * Uses 'Global Quote' and 'Commodity' endpoints.
 */
async function fetchAlphaVantageData(ALPHA_VANTAGE_KEY) {
    var _a, _b;
    try {
        // 1. Fetch WTI Crude as a secondary benchmark
        const wtiUrl = `https://www.alphavantage.co/query?function=WTI&interval=monthly&apikey=${ALPHA_VANTAGE_KEY}`;
        const wtiResponse = await axios_1.default.get(wtiUrl);
        if ((_b = (_a = wtiResponse.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0]) {
            const wtiData = wtiResponse.data.data[0];
            const { error } = await supabase_1.supabase.from('market_signals').insert({
                source: 'AlphaVantage',
                source_url: 'https://www.alphavantage.co/',
                category: 'commodity',
                title: 'WTI Crude Benchmark',
                summary: `WTI Crude monthly value: $${wtiData.value}.`,
                confidence: 0.9,
                validated: true,
                data_points: {
                    price: parseFloat(wtiData.value),
                    unit: 'USD/bbl',
                    date: wtiData.date
                },
                source_type: 'API',
                attribution: 'Alpha Vantage Data'
            });
            if (error)
                throw error;
            console.log('Alpha Vantage Data saved to Supabase.');
        }
    }
    catch (error) {
        console.error('Failed to fetch Alpha Vantage Data:', error);
    }
}
/**
 * Fetches USD/KES exchange rate which directly impacts fuel import costs.
 */
async function fetchExchangeRateData(apiKey) {
    try {
        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
        const response = await axios_1.default.get(url);
        if (response.data && response.data.result === 'success') {
            const kesRate = response.data.conversion_rates.KES;
            const { error } = await supabase_1.supabase.from('market_signals').insert({
                source: 'ExchangeRateAPI',
                source_url: 'https://www.exchangerate-api.com/',
                category: 'forex',
                title: 'USD/KES Exchange Rate',
                summary: `Current exchange rate: 1 USD = ${kesRate} KES.`,
                confidence: 1.0,
                validated: true,
                data_points: {
                    price: parseFloat(kesRate),
                    unit: 'KES/USD',
                    base: 'USD',
                },
                source_type: 'API',
                attribution: 'ExchangeRate-API'
            });
            if (error)
                throw error;
            console.log('Exchange Rate Data saved to Supabase.');
        }
    }
    catch (error) {
        console.error('Failed to fetch Exchange Rate Data:', error);
    }
}
//# sourceMappingURL=marketDataFetcher.js.map