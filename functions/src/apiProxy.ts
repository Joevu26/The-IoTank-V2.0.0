import * as functions from 'firebase-functions';
import axios from 'axios';

// Copying secrets logic here ensures immediate functionality without complex secret injection config setup, 
// while fully hiding the actual API keys from the frontend client.
// The API proxy no longer stores any keys. Keys have been moved to the client-side configuration.

const KEYS = {
    GEMINI: process.env.GEMINI_API_KEY || "",
    GROQ: process.env.GROQ_API_KEY || "",
    DEEPSEEK: process.env.DEEPSEEK_API_KEY || ""
};

export const proxyGemini = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { endpoint, body } = request.data;

    if (!endpoint || !body) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing endpoint or body');
    }

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/${endpoint}?key=${KEYS.GEMINI}`,
            body,
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error: any) {
        console.error('proxyGemini Error:', error.response?.data || error.message);
        throw new functions.https.HttpsError('internal', error.response?.data?.error?.message || error.message);
    }
});

export const proxyGroq = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { body } = request.data;

    if (!body) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing body');
    }

    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            body,
            {
                headers: {
                    'Authorization': `Bearer ${KEYS.GROQ}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error('proxyGroq Error:', error.response?.data || error.message);
        throw new functions.https.HttpsError('internal', error.response?.data?.error?.message || error.message);
    }
});

export const proxyDeepSeek = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { body } = request.data;

    if (!body) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing body');
    }

    try {
        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            body,
            {
                headers: {
                    'Authorization': `Bearer ${KEYS.DEEPSEEK}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error: any) {
        console.error('proxyDeepSeek Error:', error.response?.data || error.message);
        throw new functions.https.HttpsError('internal', error.response?.data?.error?.message || error.message);
    }
});
