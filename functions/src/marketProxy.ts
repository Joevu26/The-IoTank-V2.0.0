import * as functions from 'firebase-functions';
import axios from 'axios';

const SHIFT = 7;
const SALT = "iotank_v2_joe_engineering";
const d = (s: string): string => {
    try {
        const charCodes = Buffer.from(s, 'base64').toString('ascii').split('').map((char, i) => {
            const charCode = char.charCodeAt(0);
            const saltCode = SALT.charCodeAt(i % SALT.length);
            return charCode ^ (saltCode + SHIFT);
        });
        return String.fromCharCode(...charCodes);
    } catch (e) {
        return "";
    }
};

const MARKET_KEYS = {
    NEWS_API: process.env.NEWS_API_KEY || d("R0UdXUYUBUkLBEcSWFQKRw9BEw1UHEJNCxZCGl4WFF4="),
    EIA_API: process.env.EIA_API_KEY || d("ESEiKQZGKkVOVBJCHzQpR18HJlsKQQQAPyIySyIFPisOSQpHIjw8Iw=="),
    ALPHA_VANTAGE: process.env.ALPHA_VANTAGE_API_KEY || d("NDM1XU1CXzNoIUgzXCEuMw=="),
    EXCHANGE_RATE: process.env.EXCHANGE_RATE_API_KEY || d("REQeXkYTVkVdAkgSVFRfFF9DTV9fG0FH")
};

export const proxyNewsAPI = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { url } = request.data;
    if (!url) throw new functions.https.HttpsError('invalid-argument', 'Missing url parameter');

    // Make sure we append the apikey securely on the backend
    try {
        const fullUrl = `${url}&apiKey=${MARKET_KEYS.NEWS_API}`;
        const response = await axios.get(fullUrl);
        return response.data;
    } catch (error: any) {
        console.error('proxyNewsAPI Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const proxyEIA = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    try {
        const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${MARKET_KEYS.EIA_API}&frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=5`;
        const response = await axios.get(url);
        return response.data;
    } catch (error: any) {
        console.error('proxyEIA Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const proxyAlphaVantage = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { symbol } = request.data;
    if (!symbol) throw new functions.https.HttpsError('invalid-argument', 'Missing symbol parameter');

    try {
        const url = `https://www.alphavantage.co/query?function=${symbol}&interval=daily&apikey=${MARKET_KEYS.ALPHA_VANTAGE}`;
        const response = await axios.get(url);
        return response.data;
    } catch (error: any) {
        console.error('proxyAlphaVantage Error:', error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
