import { supabase } from '@/config/supabase';
import { MarketSignal } from '@/types';

/**
 * Service to handle real-time news delivery.
 * Listens to the 'market_news' table and dispatches events to the UI.
 */
export class NewsService {
    private static channel: any = null;

    /**
     * Start listening for live news updates.
     */
    static startListening() {
        if (this.channel) {
            console.log('[DEBUG_LOG] NewsService: Listener already active. Skipping.');
            return;
        }

        console.log('Initializing Real-time News Listener...');

        this.channel = supabase
            .channel('public:market_news')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'market_news'
                },
                (payload) => {
                    this.dispatchNews(payload.new);
                }
            )
            .subscribe();
    }

    /**
     * Fetch the most recent news from the database for initial hydration.
     */
    static async fetchRecentNews(limit: number = 10): Promise<MarketSignal[]> {
        const { data, error } = await supabase
            .from('market_news')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Failed to fetch historical news:', error);
            return [];
        }

        return (data || []).map(item => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
            sourceType: item.source_type || 'system',
            attribution: item.attribution || 'IoTank Core',
            priority: item.priority || 3,
            timestamp: new Date(item.created_at).getTime(),
            metadata: item.metadata || {}
        }));
    }

    /**
     * Stop listening.
     */
    static stopListening() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
    }

    /**
     * Dispatches a custom event that hooks/UI components listen for.
     */
    private static dispatchNews(data: any) {
        const signal: MarketSignal = {
            id: data.id,
            title: data.title,
            summary: data.summary,
            sourceType: data.source_type || 'system',
            attribution: data.attribution || 'IoTank Core',
            priority: data.priority || 3,
            timestamp: new Date(data.created_at).getTime(),
            metadata: data.metadata || {}
        };

        const event = new CustomEvent('market-news-update', { detail: signal });
        window.dispatchEvent(event);
    }
}
