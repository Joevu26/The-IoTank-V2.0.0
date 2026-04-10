import { supabase } from '../config/supabase';

export interface BusinessKPIs {
    newClients: { count: number; growth: number };
    totalActive: number;
    churnRate: number;
    cac: number;
    clv: number;
    mrrGrowth: number;
    arr: number;
    arpu: number;
    uptime: number;
    apiSuccess: number;
}

export interface UsageStats {
    totalTanks: number;
    totalFuel: number;
    readings30d: number;
    apiCalls30d: number;
    smsSent30d: number;
    alertsTriggered30d: number;
    featureAdoption: Record<string, number>;
}

export interface ScheduledReport {
    id: string;
    type: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    last_run: string;
    recipients: string[];
    status: 'active' | 'paused';
}

export const analyticsService = {
    async getBusinessKPIs(): Promise<BusinessKPIs> {
        return {
            newClients: { count: 12, growth: 15 },
            totalActive: 156,
            churnRate: 2.1,
            cac: 45000,
            clv: 850000,
            mrrGrowth: 8.4,
            arr: 12450000,
            arpu: 8500,
            uptime: 99.98,
            apiSuccess: 99.95
        };
    },

    async getUsageStats(): Promise<UsageStats> {
        return {
            totalTanks: 420,
            totalFuel: 1250000,
            readings30d: 1450000,
            apiCalls30d: 85000,
            smsSent30d: 12400,
            alertsTriggered30d: 850,
            featureAdoption: {
                '3D Digital Twin': 65,
                'Procurement AI': 42,
                'API Integration': 28,
                'Mobile App': 88,
                'Webhook Alerts': 15
            }
        };
    },

    async getFinancialReports() {
        return [
            { id: '1', name: 'Monthly Revenue - Feb 2026', type: 'Revenue', date: '2026-03-01' },
            { id: '2', name: 'KRA Tax Compliance - Q1', type: 'Tax', date: '2026-03-20' },
            { id: '3', name: 'Debt Aging Analysis', type: 'Debt', date: '2026-03-22' }
        ];
    },

    async getScheduledReports(): Promise<ScheduledReport[]> {
        return [
            { id: '1', type: 'Operational Summary', frequency: 'daily', last_run: '2026-03-21', recipients: ['admin@iotank.co.ke'], status: 'active' },
            { id: '2', type: 'Revenue Growth', frequency: 'weekly', last_run: '2026-03-17', recipients: ['ceo@iotank.co.ke', 'cfo@iotank.co.ke'], status: 'active' }
        ];
    }
};
