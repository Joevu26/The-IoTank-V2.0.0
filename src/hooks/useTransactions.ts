import { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';
import { FuelTransaction } from '@/types';
import { validateUUID } from '@/utils/sanitization';

export function useTransactions(stationId: string, tankId?: string) {
    const [transactions, setTransactions] = useState<FuelTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    const logTransaction = async (data: Omit<FuelTransaction, 'id' | 'timestamp'>) => {
        try {
            const { error } = await supabase
                .from('fuel_transactions')
                .insert({
                    station_id: stationId,
                    tank_id: data.tankId,
                    transaction_type: data.type,
                    amount: data.amount,
                    performed_by_auth_id: data.performedBy,
                    metadata: data.metadata || {}
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error logging transaction:', error);
            throw error;
        }
    };

    useEffect(() => {
        if (!stationId || (stationId !== 'SYSTEM_GOVERNANCE' && !validateUUID(stationId))) return;

        const fetchTransactions = async () => {
            try {
                let query = supabase
                    .from('fuel_transactions')
                    .select('*');
                
                if (stationId !== 'SYSTEM_GOVERNANCE') {
                    query = query.eq('station_id', stationId);
                }
                
                query = query
                    .order('timestamp', { ascending: false })
                    .limit(50); // Capped — analytics uses dedicated consumption hooks, not this poller

                if (tankId && validateUUID(tankId)) {
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
                    performedBy: t.performed_by_auth_id,
                    metadata: t.metadata
                } as FuelTransaction)));
            } catch (err) {
                console.error('Error fetching transactions:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();

        // Relaxed polling — shifts + Realtime channel handle instant updates
        const pollInterval = setInterval(fetchTransactions, 30000);

        return () => {
            clearInterval(pollInterval);
        };
    }, [stationId, tankId]);

    return { transactions, logTransaction, loading };
}
