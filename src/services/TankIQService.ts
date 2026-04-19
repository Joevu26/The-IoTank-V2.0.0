import { IntelligenceAIService, ChatMessage } from './IntelligenceAIService';
import { TankIQToolset, TANKIQ_TOOLS_METADATA } from './TankIQToolset';

const STORAGE_KEY = 'tankiq_history';
const MAX_HISTORY = 20;

export class TankIQService {
    private aiService: IntelligenceAIService;
    private history: ChatMessage[] = [];
    private stationId: string;

    constructor(stationId: string) {
        this.aiService = new IntelligenceAIService();
        this.stationId = stationId;
        this.loadHistory();
    }

    private loadHistory() {
        const saved = localStorage.getItem(`${STORAGE_KEY}_${this.stationId}`);
        if (saved) {
            try {
                this.history = JSON.parse(saved);
            } catch (e) {
                this.history = [];
            }
        }
    }

    private saveHistory() {
        localStorage.setItem(`${STORAGE_KEY}_${this.stationId}`, JSON.stringify(this.history.slice(-MAX_HISTORY)));
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
        const providers: ('gemini' | 'groq' | 'deepseek')[] = ['gemini', 'groq', 'deepseek'];
        
        // Loop for tool calls (max 3 turns to prevent loops)
        for (let turn = 0; turn < 3; turn++) {
            let response: any = null;
            let currentProvider = providers[retryCount % providers.length];

            try {
                response = await this.aiService.chat(currentProvider, this.history, TANKIQ_TOOLS_METADATA);
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
                    const args = JSON.parse(toolCall.function.arguments);
                    
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
