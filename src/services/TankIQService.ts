import { IntelligenceAIService, ChatMessage } from './IntelligenceAIService';
import { TankIQToolset, TANKIQ_TOOLS_METADATA } from './TankIQToolset';

const STORAGE_KEY = 'tankiq_history';
const MAX_HISTORY = 20;
const MAX_TOOL_TURNS = 5; // Increased from 3 for deeper forensic analysis

export class TankIQService {
    private aiService: IntelligenceAIService;
    private history: ChatMessage[] = [];
    private sessionId: string;
    private stationId: string;

    constructor(stationId: string, sessionId: string = 'default') {
        this.aiService = new IntelligenceAIService();
        this.stationId = stationId;
        this.sessionId = sessionId;
        this.loadHistory();
    }

    private loadHistory() {
        const saved = localStorage.getItem(`${STORAGE_KEY}_${this.stationId}_${this.sessionId}`);
        if (saved) {
            try {
                this.history = JSON.parse(saved);
            } catch (e) {
                this.history = [];
            }
        }
    }

    private saveHistory() {
        localStorage.setItem(`${STORAGE_KEY}_${this.stationId}_${this.sessionId}`, JSON.stringify(this.history.slice(-MAX_HISTORY)));
    }

    getHistory() {
        return this.history;
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
    }

    async sendMessage(text: string, onUpdate: (history: ChatMessage[]) => void) {
        // Add user message
        const userMsg: ChatMessage = { role: 'user', content: text };
        this.history.push(userMsg);
        onUpdate([...this.history]);

        let retryCount = 0;
        const providers: ('gemini' | 'groq' | 'deepseek')[] = ['groq', 'gemini', 'deepseek'];
        
        const systemMessage: ChatMessage = {
            role: 'system',
            content: `You are TankIQ, the AI operations assistant for the IoTank fuel management platform. You have access to live tools to query specific fuel station telemetry, consumption analytics, deliveries, and market context.
ALWAYS use the 'get_station_summary' tool to fetch live telemetry readings, real-time sensor data, and current tank levels before answering questions about tank status. NEVER say you don't have a function for live telemetry - use your tools! Provide concise, operational, and data-driven answers.`
        };

        // Loop for tool calls (prevent infinite loops)
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
            let response: any = null;
            let currentProvider = providers[retryCount % providers.length];

            const messagesToSend = [systemMessage, ...this.history];

            try {
                response = await this.aiService.chat(currentProvider, messagesToSend, TANKIQ_TOOLS_METADATA);
            } catch (err) {
                console.warn(`TankIQ: Provider ${currentProvider} failed, retrying...`, err);
                retryCount++;
                if (retryCount >= providers.length) throw new Error('All AI providers failed.');
                turn--; // Retry the same turn with new provider
                continue;
            }

            const message = response.message;
            if (!message) throw new Error('Invalid AI response format.');

            // Add assistant message to history
            this.history.push(message);
            onUpdate([...this.history]);

            if (message.tool_calls && message.tool_calls.length > 0) {
                // Execute tools
                for (const toolCall of message.tool_calls) {
                    const toolName = toolCall.function.name;
                    let args = {};
                    try {
                        args = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        console.error('[TankIQ] Tool argument parse failed:', e);
                        this.history.push({
                            role: 'tool',
                            content: JSON.stringify({ error: "Invalid JSON in function arguments. Please retry with valid JSON." }),
                            tool_call_id: toolCall.id,
                            name: toolName
                        });
                        continue;
                    }
                    
                    let toolResult;
                    if (toolName === 'get_station_summary') {
                        toolResult = await TankIQToolset.get_station_summary(this.stationId);
                    } else if (toolName === 'get_consumption_analytics') {
                        toolResult = await TankIQToolset.get_consumption_analytics(this.stationId, args);
                    } else if (toolName === 'get_delivery_logs') {
                        toolResult = await TankIQToolset.get_delivery_logs(this.stationId, args);
                    } else if (toolName === 'get_market_context') {
                        toolResult = await TankIQToolset.get_market_context();
                    } else {
                        toolResult = { error: 'Unknown tool.' };
                    }

                    this.history.push({
                        role: 'tool',
                        content: JSON.stringify(toolResult),
                        tool_call_id: toolCall.id,
                        name: toolName
                    });
                }
                onUpdate([...this.history]);
                // Continue loop to send tool results back to AI
                continue;
            } else {
                // Final response received
                break;
            }
        }

        this.saveHistory();
    }
}
