import { supabase } from '@/config/supabase';
import { MarketSignal } from '@/types';

/**
 * Service to handle real-time news delivery.
 * Listens to the 'market_news' table and dispatches events to the UI.
 */
export class NewsService {
    private static channel: any = null;
    private static isInitializing = false;
    private static listenerCount = 0;

    /**
     * Start listening for live news updates.
     */
    static async startListening() {
        this.listenerCount++;
        
        // If already connected or initializing, just increment count and skip
        if (this.isInitializing || (this.channel && (this.channel.state === 'joined' || this.channel.state === 'joining'))) {
            return;
        }

        this.isInitializing = true;
        
        // Cleanup existing channel if it's in a bad state (but count is 1)
        if (this.channel && this.listenerCount === 1) {
            this.stopListening(true);
        }

        const { logger } = await import('@/utils/logger');
        
        // Re-check after async import
        if (this.channel) {
            this.isInitializing = false;
            return;
        }

        // Only log at debug level to reduce noise
        logger.debug('Initializing Real-time News Listener...', { listeners: this.listenerCount }, 'NEWS_SERVICE');

        // Create channel and add listeners BEFORE calling subscribe
        const newChannel = supabase.channel('public:market_news');
        
        newChannel.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'market_news'
            },
            (payload) => {
                this.dispatchNews(payload.new);
            }
        );

        this.channel = newChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                this.isInitializing = false;
                logger.info('Market News Live Sync Active', { listeners: this.listenerCount }, 'NEWS_SERVICE');
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                this.isInitializing = false;
                this.channel = null;
            }
        });
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
     * @param force Force stop regardless of listener count (internal use)
     */
    static stopListening(force: boolean = false) {
        if (!force) {
            this.listenerCount = Math.max(0, this.listenerCount - 1);
        }

        if (force || this.listenerCount === 0) {
            if (this.channel) {
                supabase.removeChannel(this.channel);
                this.channel = null;
            }
            this.isInitializing = false;
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
