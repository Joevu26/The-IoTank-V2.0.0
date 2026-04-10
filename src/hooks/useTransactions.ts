import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { FuelTransaction } from '@/types';

export function useTransactions(orgId: string, tankId?: string) {
    const [transactions, setTransactions] = useState<FuelTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    const logTransaction = async (data: Omit<FuelTransaction, 'id' | 'timestamp'>) => {
        try {
            const { error } = await supabase
                .from('fuel_transactions')
                .insert({
                    station_id: orgId,
                    tank_id: data.tankId,
                    transaction_type: data.type,
                    amount: data.amount,
                    performed_by_uid: data.performedBy,
                    metadata: data.metadata || {}
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error logging transaction:', error);
            throw error;
        }
    };

    useEffect(() => {
        if (!orgId) return;

        const fetchTransactions = async () => {
            try {
                let query = supabase
                    .from('fuel_transactions')
                    .select('*');
                
                if (orgId !== 'SYSTEM_GOVERNANCE') {
                    query = query.eq('station_id', orgId);
                }
                
                query = query
                    .order('timestamp', { ascending: false })
                    .limit(50);

                if (tankId) {
                    query = query.eq('tank_id', tankId);
                }

                const { data, error } = await query;
                if (error) throw error;

                setTransactions((data || []).map(t => ({
                    id: t.id,
                    type: t.transaction_type,
                    tankId: t.tank_id,
                    amount: Number(t.amount),
                    timestamp: new Date(t.timestamp).getTime(),
                    performedBy: t.performed_by_uid,
                    metadata: t.metadata
                } as FuelTransaction)));
            } catch (err) {
                console.error('Error fetching transactions:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();

        const channelFilter = orgId !== 'SYSTEM_GOVERNANCE' ? `station_id=eq.${orgId}` : undefined;
        const channel = supabase
            .channel(`fuel_transactions:${orgId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'fuel_transactions', filter: channelFilter }, () => {
                fetchTransactions();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orgId, tankId]);

    return { transactions, logTransaction, loading };
}
