import { supabase } from '../config/supabase';

export interface KnowledgeArticle {
    id: string;
    title: string;
    category: string;
    content: string;
    views: number;
    helpful_count: number;
    is_published: boolean;
    created_at: string;
}

export const helpCenterService = {
    async getArticles(category?: string): Promise<KnowledgeArticle[]> {
        let query = supabase
            .from('knowledge_base')
            .select('*')
            .eq('is_published', true)
            .order('created_at', { ascending: false });

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching articles:', error);
            return [];
        }

        return data as KnowledgeArticle[];
    },

    async searchArticles(query: string): Promise<KnowledgeArticle[]> {
        if (!query.trim()) return this.getArticles();

        // Use PostgreSQL full-text search if configured, else fallback to ilike
        const { data, error } = await supabase
            .from('knowledge_base')
            .select('*')
            .eq('is_published', true)
            .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
            .order('views', { ascending: false });

        if (error) {
            console.error('Search error:', error);
            return [];
        }

        return data as KnowledgeArticle[];
    },

    async incrementViews(id: string) {
        const { error } = await supabase.rpc('increment_article_views', { article_id: id });
        if (error) {
            // Fallback if RPC doesn't exist
            const { data } = await supabase.from('knowledge_base').select('views').eq('id', id).single();
            await supabase.from('knowledge_base').update({ views: (data?.views || 0) + 1 }).eq('id', id);
        }
    }
};
