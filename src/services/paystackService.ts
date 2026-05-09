import { supabase } from '../config/supabase';

export interface PaystackTransaction {
    id: string;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    channel: string;
    created_at: string;
    customer_email: string;
    metadata?: any;
}

export interface PaystackCustomer {
    id: string;
    customer_code: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    metadata?: any;
}

export const paystackService = {
    /**
     * Fetches transactions from the database (synced via webhooks)
     */
    async getTransactions(limit = 10): Promise<PaystackTransaction[]> {
        try {
            const { data, error } = await supabase
                .from('transactions') // We use the existing transactions table but map it
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching Paystack transactions:', error);
            return [];
        }
    },

    /**
     * Fetches customers from the database
     */
    async getCustomers(limit = 10): Promise<PaystackCustomer[]> {
        try {
            const { data, error } = await supabase
                .from('billing_customers')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching Paystack customers:', error);
            return [];
        }
    },

    /**
     * Saves Paystack configuration for the station
     */
    async saveConfig(config: {
        test_secret_key: string;
        test_public_key: string;
        live_secret_key: string;
        live_public_key: string;
        is_live_mode: boolean;
    }, stationId: string) {
        try {
            const { error } = await supabase
                .from('paystack_config')
                .upsert({
                    station_id: stationId,
                    ...config,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Fetches Paystack configuration
     */
    async getConfig(stationId: string) {
        try {
            const { data, error } = await supabase
                .from('paystack_config')
                .select('*')
                .eq('station_id', stationId)
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching Paystack config:', error);
            return null;
        }
    }
};
