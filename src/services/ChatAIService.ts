/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/config/supabase';


export type AIModel = 'gemini' | 'groq' | 'deepseek';

const SYSTEM_PROMPT = `You are the IoTank Intelligent Operational Assistant (V2.0.0). You provide mission-critical industrial fuel inventory insights and customer support for the IoTank ecosystem.

PROJECT OVERVIEW:
- IoTank V2.0.0 is a cloud-native fuel intelligence hub designed for industrial and commercial fuel management.
- It uses IoT sensors for real-time tank level monitoring and diagnostics.
- Core Features: Real-time tank monitoring, Automated Delivery reconciliation, Leak detection scoring, AI-powered predictive analytics, Forensic shift reporting, and Logistics optimization.
- Market Context: Specialized for the Kenyan and East African markets, adhering to EPRA (Energy & Petroleum Regulatory Authority) and KRA (Kenya Revenue Authority) compliance standards.

OPERATIONAL CONSTRAINTS:
1. Always maintain a professional, helpful, technical, and precise tone.
2. Focus exclusively on industrial fuel management, IoT, and this application. Do NOT discuss unrelated subjects like games, general entertainment, or politics.
3. Use Markdown for structured responses. Be concise but thorough in technical explanations.
4. If you don't have enough context about a specific user's data, ask them to check their local dashboard or contact support at iotank.com@gmail.com.
5. You represent the IoTank engineering and support team.
`;

export class ChatAIService {
    private static modelPriority: AIModel[] = ['gemini', 'groq', 'deepseek'];

    static async getChatResponse(message: string, history: { role: 'user' | 'assistant', content: string }[]): Promise<string> {
        const errors: string[] = [];

        for (const model of this.modelPriority) {
            try {
                console.log(`[ChatAIService] Attempting response with model: ${model}`);
                const response = await this.callModel(model, message, history);
                if (response) return response;

                errors.push(`${model}: Empty response`);
            } catch (error: any) {
                const errorMsg = error?.message || 'Unknown error';
                console.warn(`[ChatAIService] Model ${model} failed in production:`, {
                    message: errorMsg,
                    error: error,
                    timestamp: new Date().toISOString()
                });
                errors.push(`${model}: ${errorMsg}`);

                // Continue to next model
                continue;
            }
        }

        console.error('[ChatAIService] All models failed:', errors);
        return "I'm currently experiencing high demand. Please reach out to us at iotank.com@gmail.com for immediate assistance!";
    }

    private static async callModel(model: AIModel, message: string, history: any[]): Promise<string | null> {
        switch (model) {
            case 'gemini':
                return this.callGemini(message, history);
            case 'groq':
                return this.callGroq(message, history);
            case 'deepseek':
                return this.callDeepSeek(message, history);
            default:
                return null;
        }
    }

    private static async callGemini(message: string, history: any[]): Promise<string | null> {
        const contents = [
            { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${SYSTEM_PROMPT}` }] },
            { role: 'model', parts: [{ text: "Understood. I am now configured as the IoTank Intelligent Operational Assistant. How can I assist with your fuel intelligence hub today?" }] },
            ...history.map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ];

        try {
            const { data, error } = await supabase.functions.invoke('gemini-proxy', {
                body: {
                    action: 'chat',
                    body: { contents },
                    endpoint: 'models/gemini-1.5-flash:generateContent'
                }
            });
            if (error) throw error;
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (error) {
            console.error('Gemini error:', error);
            throw error;
        }
    }

    private static async callGroq(message: string, history: any[]): Promise<string | null> {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: message }
        ];

        try {
            const { data, error } = await supabase.functions.invoke('groq-proxy', {
                body: {
                    action: 'chat',
                    body: {
                        model: 'llama-3.3-70b-versatile',
                        messages,
                        temperature: 0.7
                    }
                }
            });
            if (error) throw error;
            return data.choices?.[0]?.message?.content || null;
        } catch (error) {
            console.error('Groq error:', error);
            throw error;
        }
    }

    private static async callDeepSeek(message: string, history: any[]): Promise<string | null> {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: message }
        ];

        try {
            const { data, error } = await supabase.functions.invoke('deepseek-proxy', {
                body: {
                    action: 'chat',
                    body: {
                        model: 'deepseek-chat',
                        messages,
                        temperature: 0.7
                    }
                }
            });
            if (error) throw error;
            return data.choices?.[0]?.message?.content || null;
        } catch (e) {
            console.error('DeepSeek error:', e);
            throw e;
        }
    }
}
