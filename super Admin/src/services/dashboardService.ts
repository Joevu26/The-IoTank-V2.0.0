import { supabase } from '../config/supabase';

export type SystemHealth = {
    totalUsers: number;
    totalTanks: number;
    totalStations: number;
    uptime: string;
    espDevices: { online: number; total: number };
    apiStatus: { supabase: 'green'|'yellow'|'red'; twilio: 'green'|'yellow'|'red' };
    dbSize: string;
    alertRate: string;
    dataIngestionRate: string;
    queryLatency: string;
    totalOperators: number;
};

export type FinancialSummary = {
    mrr: number;
    arr: number;
    outstandingDebt: number;
    dailySpend: Array<{ station_name: string; amount: number; last_update: string }>;
    billChanges: {
        increased: Array<{ station_name: string; previous: number; current: number; change: number; percentage: number }>;
        decreased: Array<{ station_name: string; previous: number; current: number; change: number; percentage: number }>;
    };
};

export type SupportOps = {
    openTickets: number;
    urgentTickets: number;
    pendingRequests: number;
    pendingAdjustments: number;
};

export type DashboardStats = {
    health: SystemHealth;
    financial: FinancialSummary;
    support: SupportOps;
    recentActivity: any[];
};

export const dashboardService = {
    getPlatformStats: async (): Promise<DashboardStats> => {
        try {
            const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
            
            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }

            // The RPC returns exactly the shape we need, mostly. We just ensure recentActivity exists.
            if (!data.recentActivity || data.recentActivity.length === 0) {
                // Optionally hit a single quick query for audit logs if the RPC didn't fetch full activity stream,
                // or just leave it empty.
                const { data: auditLogs } = await supabase.from('audit_logs').select('*').limit(5).order('created_at', { ascending: false });
                data.recentActivity = (auditLogs || []).map((log: any) => ({
                    id: `audit-${log.id}`,
                    type: 'system',
                    text: log.action,
                    time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    severity: log.severity === 'critical' ? 'danger' : 'info'
                }));
            }

            return data as DashboardStats;

        } catch (error: any) {
            console.error('Dashboard Data Error:', error);
            
            // Check for 404 (Missing RPC), 401 (Auth Issue), 42P01 (Schema Mismatch), or 42703 (Column Mismatch)
            const isInfraMissing = error?.code === 'PGRST104' || error?.status === 404 || error?.message?.includes('404');
            const isAuthError = error?.status === 401 || error?.message?.includes('401');
            const isSchemaMismatch = error?.code === '42P01' || error?.message?.includes('42P01');
            const isColumnMismatch = error?.code === '42703' || error?.message?.includes('42703') || error?.message?.includes('column') && error?.message?.includes('does not exist');

            return {
                health: { 
                    totalUsers: 0, totalTanks: 0, totalStations: 0, uptime: '0%', 
                    espDevices: { online: 0, total: 0 }, 
                    apiStatus: { supabase: 'red', twilio: 'red' }, 
                    dbSize: '0', alertRate: '0', dataIngestionRate: '0', 
                    queryLatency: '0', totalOperators: 0 
                },
                financial: { mrr: 0, arr: 0, outstandingDebt: 0, dailySpend: [], billChanges: { increased: [], decreased: [] } },
                support: { openTickets: 0, urgentTickets: 0, pendingRequests: 0, pendingAdjustments: 0 },
                recentActivity: [],
                error: {
                    type: isColumnMismatch ? 'COLUMN_MISMATCH' : isSchemaMismatch ? 'SCHEMA_MISMATCH' : isInfraMissing ? 'INFRA_MISSING' : isAuthError ? 'AUTH_FAILURE' : 'UNKNOWN',
                    message: error?.message || 'Connection failed'
                }
            } as any;
        }
    }
};
