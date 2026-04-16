import { MarketSignal, SupplyRisk, RegulatoryNotice, GeminiInsight } from '@/types';
import { supabase } from '@/config/supabase';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: any[];
    tool_call_id?: string;
    name?: string;
}

export interface AIProviderConfig {
    gemini?: { apiKey: string };
    groq?: { apiKey: string };
    deepseek?: { apiKey: string };
}

export class IntelligenceAIService {
    constructor(_config?: AIProviderConfig) {
        // AI proxy securely handles configuration now
    }

    private async getSafeAuthHeaders(): Promise<Record<string, string>> {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const headers: Record<string, string> = { 
            'Content-Type': 'application/json',
            'apikey': anonKey || ''
        };

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const isValidToken = session && (session.expires_at ? session.expires_at > (Date.now() / 1000) + 10 : true);
            
            if (isValidToken && session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        } catch (e) {
            console.warn('[IntelligenceAIService] Auth check failed, proceeding anonymously.');
        }

        return headers;
    }

    async generateInsight(
        signals: MarketSignal[],
        risks: SupplyRisk[],
        notices: RegulatoryNotice[],
        tankId: string = 'fleet'
    ): Promise<GeminiInsight> {
        const context = { signals: signals.slice(0, 5), risks: risks.slice(0, 3), notices: notices.slice(0, 2) };
        const promptLog = JSON.stringify(context);
        const providers: (keyof AIProviderConfig)[] = ['gemini', 'groq', 'deepseek'];

        for (const provider of providers) {
            try {
                const response = await this.callProvider(provider, context);
                if (response) {
                    return this.parseResponse(provider as any, response, promptLog, provider, signals, risks, tankId);
                }
            } catch (error) {
                console.warn(`IntelligenceAIService: ${provider} failed, trying next...`, error);
                continue;
            }
        }

        throw new Error('All AI providers failed to generate insights.');
    }

    /**
     * Generic chat interface with tool support
     */
    async chat(
        provider: keyof AIProviderConfig,
        messages: ChatMessage[],
        tools?: any[]
    ): Promise<any> {
        try {
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch(`https://suifvborodwergtrbjez.supabase.co/functions/v1/${provider}-proxy`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'chat',
                    body: {
                        messages,
                        tools,
                        tool_choice: tools ? 'auto' : undefined
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    console.error(`[IntelligenceAIService] 401 Unauthorized for ${provider}. Token handling might be out of sync.`);
                }
                throw new Error(`${provider} error: ${response.statusText}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`IntelligenceAIService Chat Error (${provider}):`, error);
            throw error;
        }
    }

    private async callProvider(provider: keyof AIProviderConfig, context: any): Promise<string | null> {
        switch (provider) {
            case 'gemini':
                return this.callGemini(context);
            case 'groq':
                return this.callGroq(context);
            case 'deepseek':
                return this.callDeepSeek(context);
            default:
                return null;
        }
    }

    private async callGemini(context: any): Promise<string> {
        try {
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/gemini-proxy', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'intelligence',
                    context,
                    endpoint: 'models/gemini-1.5-flash:generateContent',
                    body: {
                        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(`Gemini error: ${response.statusText}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (error) {
            console.error('Gemini error:', error);
            throw error;
        }
    }

    private async callGroq(context: any): Promise<string> {
        try {
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/groq-proxy', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'intelligence',
                    context,
                    body: {
                        model: 'llama-3.3-70b-versatile',
                        response_format: { type: 'json_object' }
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(`Groq error: ${response.statusText}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('Groq error:', error);
            throw error;
        }
    }

    private async callDeepSeek(context: any): Promise<string> {
        try {
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/deepseek-proxy', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'chat',
                    body: {
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: 'Extract intelligence markers from the provided context in JSON format.' },
                            { role: 'user', content: JSON.stringify(context) }
                        ],
                        temperature: 0.7,
                        response_format: { type: 'json_object' }
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(`DeepSeek error: ${response.statusText}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('DeepSeek error:', error);
            throw error;
        }
    }

    private parseResponse(
        _unused: any,
        text: string,
        prompt: string,
        provider: string,
        signals: MarketSignal[],
        risks: SupplyRisk[],
        tankId: string
    ): GeminiInsight {
        try {
            // Robust JSON Extraction
            let cleanedText = text.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
            }

            let advisory: any;
            try {
                advisory = JSON.parse(cleanedText);
            } catch (jsonErr) {
                const startIndex = cleanedText.indexOf('{');
                const endIndex = cleanedText.lastIndexOf('}');
                
                if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                    const jsonCandidate = cleanedText.substring(startIndex, endIndex + 1);
                    advisory = JSON.parse(jsonCandidate);
                } else {
                    throw jsonErr;
                }
            }

            return {
                id: `ai-${Date.now()}-${provider}`,
                tankId,
                type: 'procurement',
                title: advisory.title || 'Strategic Intel',
                summary: advisory.summary || 'Market intelligence update.',
                recommendation: advisory.explanation || advisory.recommendation || 'Monitor market conditions.',
                timestamp: Date.now(),
                prompt,
                response: text,
                confidence: advisory.confidenceScore || 0.8,
                modelVersion: `${provider}-failover-engine`,
                supportingData: { signals, risks, keyFactors: advisory.keyFactors || [] }
            };
        } catch (e) {
            console.error(`[IntelligenceAIService] Critical parsing failure for ${provider}:`, e, "Raw response:", text);
            throw new Error(`AI response format invalid for ${provider}`);
        }
    }
}
