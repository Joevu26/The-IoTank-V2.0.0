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
        return [
            {
                id: '1',
                date_sent: '2026-03-20 09:00',
                subject: 'Planned Maintenance: March 25th',
                recipients_count: 1250,
                methods: ['Email', 'Dashboard'],
                open_rate: 68,
                click_rate: 12,
                status: 'sent'
            },
            {
                id: '2',
                date_sent: '2026-03-15 14:30',
                subject: 'New Feature: 3D Digital Twin Hub',
                recipients_count: 840,
                methods: ['Email', 'Push'],
                open_rate: 45,
                click_rate: 28,
                status: 'sent'
            }
        ];
    },

    async getActiveBanners(): Promise<DashboardBanner[]> {
        return [
            {
                id: 'B1',
                type: 'warning',
                message: 'Scheduled maintenance on March 25, 3-5 AM EAT',
                target: 'All',
                is_dismissible: true,
                active: true
            },
            {
                id: 'B2',
                type: 'error',
                message: 'M-Pesa payment gateway temporarily unavailable, use bank transfer',
                target: 'All',
                is_dismissible: false,
                active: true
            }
        ];
    },

    async getNewsletterTemplates(): Promise<NewsletterTemplate[]> {
        return [
            { id: 'T1', name: 'Monthly Product Update', last_modified: '2026-03-01', category: 'Product' },
            { id: 'T2', name: 'Fuel Market Insights Q1', last_modified: '2026-02-15', category: 'Insights' }
        ];
    },

    async sendAnnouncement(data: any) {

        return { success: true };
    }
};
