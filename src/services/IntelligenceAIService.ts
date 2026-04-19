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

export interface ArticleAIDirective {
    status: 'CRITICAL' | 'CAUTION' | 'STABLE';
    recommendation: string;
    actionRequired: boolean;
    actionDetails?: string;
    confidence: number;
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
                const response = await this.callProvider(provider, context, 'intelligence');
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
     * TankIQ: Generate a specific directive for a new market signal based on tank levels
     */
    async generateArticleDirective(
        article: any,
        tanks: any[]
    ): Promise<ArticleAIDirective> {
        const tankData = (tanks || []).map(t => ({ 
            id: t.id, 
            name: t.name, 
            fuel: t.fuelType, 
            level: t.currentLevel 
        }));

        const context = {
            signal: {
                title: article.title,
                summary: article.summary,
                source: article.feedSource,
                category: article.implicationCategory
            },
            inventory: tankData,
            timestamp: Date.now()
        };

        const providers: (keyof AIProviderConfig)[] = ['gemini', 'groq', 'deepseek'];

        for (const provider of providers) {
            try {
                const response = await this.callProvider(provider, context, 'directive');
                if (response) {
                    return this.parseDirectiveResponse(provider, response);
                }
            } catch (error) {
                console.warn(`TankIQ (${provider}): Failed to generate directive, falling back...`, error);
                continue;
            }
        }

        // Final Fallback: Return a safe neutral directive if all AI fails
        return {
            status: 'STABLE',
            recommendation: 'Market signal detected. AI failover exhausted. Monitor manually.',
            actionRequired: false,
            confidence: 0
        };
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
            let body: any;

            if (provider === 'gemini') {
                // Map to Google Generative AI format
                body = {
                    contents: messages.map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content }]
                    })),
                    tools: tools ? [{
                        function_declarations: tools.map(t => ({
                            name: t.function.name,
                            description: t.function.description,
                            parameters: t.function.parameters
                        }))
                    }] : undefined,
                    tool_config: tools ? {
                        function_calling_config: { mode: 'AUTO' }
                    } : undefined
                };
            } else {
                // OpenAI-compatible format (Groq, DeepSeek)
                body = {
                    messages,
                    tools,
                    tool_choice: tools ? 'auto' : undefined
                };
            }

            const response = await fetch(`https://suifvborodwergtrbjez.supabase.co/functions/v1/${provider}-proxy`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'chat',
                    body
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(`${provider} error: ${response.statusText}${errorBody.error ? ` - ${errorBody.error}` : ''}`);
            }

            const data = await response.json();
            
            // Normalize Response to OpenAI format
            if (provider === 'gemini') {
                const candidate = data.candidates?.[0];
                const content = candidate?.content;
                const parts = content?.parts || [];
                
                const textPart = parts.find((p: any) => p.text);
                const callParts = parts.filter((p: any) => p.functionCall);
                
                return {
                    message: {
                        role: 'assistant',
                        content: textPart?.text || '',
                        tool_calls: callParts.length > 0 ? callParts.map((p: any, idx: number) => ({
                            id: `call_${Date.now()}_${idx}`,
                            type: 'function',
                            function: {
                                name: p.functionCall.name,
                                arguments: JSON.stringify(p.functionCall.args || {})
                            }
                        })) : undefined
                    }
                };
            }

            // OpenAI compatible (Groq, DeepSeek)
            return {
                message: data.choices?.[0]?.message || { role: 'assistant', content: '' }
            };
        } catch (error) {
            console.error(`IntelligenceAIService Chat Error (${provider}):`, error);
            throw error;
        }
    }

    private async callProvider(
        provider: keyof AIProviderConfig, 
        context: any, 
        type: 'intelligence' | 'directive'
    ): Promise<string | null> {
        const endpoint = type === 'directive' ? 'directive' : 'intelligence';
        
        switch (provider) {
            case 'gemini':
                return this.callGemini(context, endpoint);
            case 'groq':
                return this.callGroq(context, endpoint);
            case 'deepseek':
                return this.callDeepSeek(context, endpoint);
            default:
                return null;
        }
    }

    private async callGemini(context: any, actionType: string = 'intelligence'): Promise<string> {
        try {
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/gemini-proxy', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: actionType === 'directive' ? 'intelligence' : actionType,
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

    private async callGroq(context: any, actionType: string = 'intelligence'): Promise<string> {
        try {
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/groq-proxy', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: actionType === 'directive' ? 'intelligence' : actionType,
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

    private async callDeepSeek(context: any, actionType: string = 'intelligence'): Promise<string> {
        try {
            const headers = await this.getSafeAuthHeaders();
            const response = await fetch('https://suifvborodwergtrbjez.supabase.co/functions/v1/deepseek-proxy', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: actionType === 'directive' ? 'intelligence' : (actionType === 'intelligence' ? 'intelligence' : 'chat'),
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

    private parseDirectiveResponse(provider: string, text: string): ArticleAIDirective {
        try {
            const cleanedText = this.cleanJSONResponse(text);
            const data = JSON.parse(cleanedText);
            
            return {
                status: (data.status || 'STABLE').toUpperCase() as any,
                recommendation: data.recommendation || data.text || 'Monitor market conditions.',
                actionRequired: !!data.actionRequired || !!data.suggestsAction,
                actionDetails: data.actionDetails || data.details,
                confidence: data.confidence || 0.85
            };
        } catch (e) {
            console.error(`[IntelligenceAIService] Directive parsing failure for ${provider}:`, e);
            throw new Error('AI response format invalid for directive');
        }
    }

    private cleanJSONResponse(text: string): string {
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const startIndex = cleanedText.indexOf('{');
        const endIndex = cleanedText.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            return cleanedText.substring(startIndex, endIndex + 1);
        }
        return cleanedText;
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
            const cleanedText = this.cleanJSONResponse(text);
            const advisory = JSON.parse(cleanedText);

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
