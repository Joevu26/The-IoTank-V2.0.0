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
exports.proxyDeepSeek = exports.proxyGroq = exports.proxyGemini = void 0;
const functions = __importStar(require("firebase-functions"));
const axios_1 = __importDefault(require("axios"));
// Copying secrets logic here ensures immediate functionality without complex secret injection config setup, 
// while fully hiding the actual API keys from the frontend client.
// The API proxy no longer stores any keys. Keys have been moved to the client-side configuration.
const KEYS = {
    GEMINI: process.env.GEMINI_API_KEY || "",
    GROQ: process.env.GROQ_API_KEY || "",
    DEEPSEEK: process.env.DEEPSEEK_API_KEY || ""
};
exports.proxyGemini = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { endpoint, body } = request.data;
    if (!endpoint || !body) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing endpoint or body');
    }
    try {
        const response = await axios_1.default.post(`https://generativelanguage.googleapis.com/v1/${endpoint}?key=${KEYS.GEMINI}`, body, { headers: { 'Content-Type': 'application/json' } });
        return response.data;
    }
    catch (error) {
        console.error('proxyGemini Error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new functions.https.HttpsError('internal', ((_d = (_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.message) || error.message);
    }
});
exports.proxyGroq = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { body } = request.data;
    if (!body) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing body');
    }
    try {
        const response = await axios_1.default.post('https://api.groq.com/openai/v1/chat/completions', body, {
            headers: {
                'Authorization': `Bearer ${KEYS.GROQ}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
    catch (error) {
        console.error('proxyGroq Error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new functions.https.HttpsError('internal', ((_d = (_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.message) || error.message);
    }
});
exports.proxyDeepSeek = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const { body } = request.data;
    if (!body) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing body');
    }
    try {
        const response = await axios_1.default.post('https://api.deepseek.com/v1/chat/completions', body, {
            headers: {
                'Authorization': `Bearer ${KEYS.DEEPSEEK}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    }
    catch (error) {
        console.error('proxyDeepSeek Error:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw new functions.https.HttpsError('internal', ((_d = (_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.message) || error.message);
    }
});
//# sourceMappingURL=apiProxy.js.map