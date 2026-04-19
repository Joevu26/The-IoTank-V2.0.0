import { supabase } from '../config/supabase';

export interface RevenueStats {
    today: number;
    thisWeek: { current: number; previous: number; percentChange: number };
    thisMonth: { current: number; previous: number; percentChange: number };
    thisYear: number;
    mrr: number;
    arr: number;
}

export interface DebtAging {
    zeroToFifteen: { amount: number; count: number };
    sixteenToThirty: { amount: number; count: number };
    thirtyOneToSixty: { amount: number; count: number };
    sixtyPlus: { amount: number; count: number };
    total: number;
}

export const billingService = {
    getRevenueDashboard: async (): Promise<RevenueStats> => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        // 7 days ago
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const { data: txs } = await supabase.from('transactions')
            .select('amount, created_at')
            .in('transaction_type', ['charge', 'usage_charge', 'payment'])
            .eq('payment_status', 'completed');

        if (!txs) return { today: 0, thisWeek: { current: 0, previous: 0, percentChange: 0 }, thisMonth: { current: 0, previous: 0, percentChange: 0 }, thisYear: 0, mrr: 0, arr: 0 };

        const stats = {
            today: 0,
            thisWeek: { current: 0, previous: 0 },
            thisMonth: { current: 0, previous: 0 },
            thisYear: 0,
            mrr: 0, // Monthly recurring revenue from 'charge' types this month
        };

        txs.forEach(tx => {
            const date = new Date(tx.created_at);
            const amt = Number(tx.amount);

            if (date >= startOfToday) stats.today += amt;
            if (date.getFullYear() === now.getFullYear()) stats.thisYear += amt;

            // Week comparison
            if (date >= sevenDaysAgo) stats.thisWeek.current += amt;
            else if (date >= fourteenDaysAgo) stats.thisWeek.previous += amt;

            // Month comparison
            if (date >= startOfThisMonth) {
                stats.thisMonth.current += amt;
                // MRR: Sum of subscription types this month
                // (In a true MRR model, we'd base this on active subscription values in fuel_stations)
            } else if (date >= startOfLastMonth) {
                stats.thisMonth.previous += amt;
            }
        });

        // MRR Calculation from active clients
        const { data: stations } = await supabase.from('fuel_stations').select('current_debt');
        // Simple MRR fallback based on average monthly bill or actual tier values if we had them
        // For now, let's use the Dashboard's logic or a fixed sum of 'charge' transactions this month
        const mrr = txs.filter(tx => new Date(tx.created_at) >= startOfThisMonth).reduce((s, t) => s + Number(t.amount), 0);

        const calcChange = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

        return {
            today: stats.today,
            thisWeek: { ...stats.thisWeek, percentChange: calcChange(stats.thisWeek.current, stats.thisWeek.previous) },
            thisMonth: { ...stats.thisMonth, percentChange: calcChange(stats.thisMonth.current, stats.thisMonth.previous) },
            thisYear: stats.thisYear,
            mrr: mrr,
            arr: mrr * 12
        };
    },

    getDebtAging: async (): Promise<DebtAging> => {
        const { data: stations } = await supabase.from('fuel_stations')
            .select('current_debt, last_payment_date, created_at')
            .gt('current_debt', 0);

        const aging: DebtAging = {
            zeroToFifteen: { amount: 0, count: 0 },
            sixteenToThirty: { amount: 0, count: 0 },
            thirtyOneToSixty: { amount: 0, count: 0 },
            sixtyPlus: { amount: 0, count: 0 },
            total: 0
        };

        if (!stations) return aging;

        const now = new Date();
        stations.forEach(c => {
            const dueDate = new Date(c.last_payment_date || c.created_at);
            const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            const amt = Number(c.current_debt);

            if (diffDays <= 15) { aging.zeroToFifteen.amount += amt; aging.zeroToFifteen.count++; }
            else if (diffDays <= 30) { aging.sixteenToThirty.amount += amt; aging.sixteenToThirty.count++; }
            else if (diffDays <= 60) { aging.thirtyOneToSixty.amount += amt; aging.thirtyOneToSixty.count++; }
            else { aging.sixtyPlus.amount += amt; aging.sixtyPlus.count++; }
            
            aging.total += amt;
        });

        return aging;
    },

    getTransactions: async (filters: any) => {
        let query = supabase.from('transactions').select(`
            *,
            station:fuel_stations!inner(station_name)
        `).order('created_at', { ascending: false });

        if (filters.status) query = query.eq('payment_status', filters.status);
        if (filters.type) query = query.eq('transaction_type', filters.type);

        return await query.limit(50);
    },

    getUsageLogs: async () => {
        return await supabase.from('fuel_stations').select('*').limit(50);
    },

    getInvoices: async () => {
        return await supabase
            .from('invoices')
            .select(`
                *,
                station:fuel_stations!inner(station_name)
            `)
            .order('created_at', { ascending: false })
            .limit(50);
    },


    generateMonthlyInvoices: async () => {
        return await supabase.rpc('process_monthly_invoicing');
    }
};

