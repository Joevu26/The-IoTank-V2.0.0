import { supabase } from '../config/supabase';

export interface Announcement {
    id: string;
    date_sent: string;
    subject: string;
    recipients_count: number;
    methods: ('Email' | 'SMS' | 'Dashboard' | 'Push')[];
    open_rate: number;
    click_rate: number;
    status: 'sent' | 'scheduled' | 'draft' | 'cancelled';
}

export interface DashboardBanner {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    target: 'All' | 'Tier' | 'Specific';
    is_dismissible: boolean;
    active: boolean;
}

export interface NewsletterTemplate {
    id: string;
    name: string;
    last_modified: string;
    category: 'Product' | 'Industry' | 'Insights' | 'Custom';
}

export const communicationService = {
    async getAnnouncements(): Promise<Announcement[]> {
        const { data, error } = await supabase
            .from('global_announcements')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching announcements:', error);
            return [];
        }

        return data.map(a => ({
            id: a.id,
            date_sent: new Date(a.created_at).toLocaleString(),
            subject: a.subject,
            recipients_count: a.recipients_count,
            methods: a.channels,
            open_rate: a.open_rate,
            click_rate: a.click_rate,
            status: a.status as any
        }));
    },

    async getActiveBanners(): Promise<DashboardBanner[]> {
        const { data, error } = await supabase
            .from('dashboard_banners')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching banners:', error);
            return [];
        }

        return data.map(b => ({
            id: b.id,
            type: b.type as any,
            message: b.message,
            target: b.target as any,
            is_dismissible: b.is_dismissible,
            active: b.is_active
        }));
    },

    async getNewsletterTemplates(): Promise<NewsletterTemplate[]> {
        const { data, error } = await supabase
            .from('newsletter_templates')
            .select('*')
            .order('last_modified', { ascending: false });

        if (error) {
            console.error('Error fetching newsletter templates:', error);
            return [];
        }

        return data.map(t => ({
            id: t.id,
            name: t.name,
            last_modified: new Date(t.last_modified).toLocaleDateString(),
            category: t.category as any
        }));
    },

    async saveNewsletterTemplate(template: Omit<NewsletterTemplate, 'id' | 'last_modified'>) {
        const { data, error } = await supabase
            .from('newsletter_templates')
            .insert({
                ...template,
                created_by: (await supabase.auth.getUser()).data.user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteNewsletterTemplate(id: string) {
        const { error } = await supabase
            .from('newsletter_templates')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    async sendAnnouncement(data: { subject: string, body: string, channels: string[], target: string }) {
        const { data: result, error } = await supabase
            .from('global_announcements')
            .insert({
                subject: data.subject,
                body: data.body,
                channels: data.channels,
                target_audience: data.target,
                status: 'sent', // Immediate dispatch by default for this UI
                created_by: (await supabase.auth.getUser()).data.user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: result };
    }
};

