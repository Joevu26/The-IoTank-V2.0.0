import { MarketSignal, SupplyRisk, RegulatoryNotice, GeminiInsight } from '@/types';
import { supabase } from '@/config/supabase';

export interface AIProviderConfig {
    gemini?: { apiKey: string };
    groq?: { apiKey: string };
    deepseek?: { apiKey: string };
}

export class IntelligenceAIService {
    constructor(_config?: AIProviderConfig) {
        // AI proxy securely handles configuration now
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
                    return this.parseResponse(response, promptLog, provider, signals, risks, tankId);
                }
            } catch (error) {
                console.warn(`IntelligenceAIService: ${provider} failed, trying next...`, error);
                continue;
            }
        }

        throw new Error('All AI providers failed to generate insights.');
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
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: {
                    action: 'intelligence',
                    context,
                    endpoint: 'models/gemini-1.5-flash:generateContent',
                    body: {
                        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
                    }
                }
            });
            if (error) throw error;
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (error) {
            console.error('Gemini error:', error);
            throw error;
        }
    }

    private async callGroq(context: any): Promise<string> {
        try {
            const { data, error } = await supabase.functions.invoke('groq-proxy', {
                body: {
                    action: 'intelligence',
                    context,
                    body: {
                        model: 'llama-3.3-70b-versatile',
                        response_format: { type: 'json_object' }
                    }
                }
            });
            if (error) throw error;
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('Groq error:', error);
            throw error;
        }
    }

    private async callDeepSeek(context: any): Promise<string> {
        try {
            const { data, error } = await supabase.functions.invoke('deepseek-proxy', {
                body: {
                    action: 'intelligence',
                    context,
                    body: {
                        model: 'deepseek-chat',
                        response_format: { type: 'json_object' }
                    }
                }
            });
            if (error) throw error;
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('DeepSeek error:', error);
            throw error;
        }
    }

    private parseResponse(
        text: string,
        prompt: string,
        provider: string,
        signals: MarketSignal[],
        risks: SupplyRisk[],
        tankId: string
    ): GeminiInsight {
        try {
            // Robust JSON Extraction: 
            // 1. Try direct parse first
            // 2. Try to find the first '{' and last '}'
            // 3. Clean common markdown bloat
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
