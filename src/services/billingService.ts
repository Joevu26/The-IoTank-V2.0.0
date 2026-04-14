import { supabase } from '../config/supabase';

export interface ClientBillingSummary {
  station: {
    current_debt: number;
    total_paid: number;
    account_status: string;
    next_billing_date: string | null;
  };
  tanks: {
    id: string;
    name: string;
    fuel_type: string;
    current_volume: number;
    capacity: number;
    fill_percentage: number;
    temperature: number;
    status: string;
  }[];
  unread_alerts: number;
  critical_alerts: number;
}

export const billingService = {
  /**
   * Fetches the dashboard summary for a station using the `get_station_dashboard_summary` RPC function
   */
  async getDashboardSummary(stationId: string): Promise<ClientBillingSummary | null> {
    try {
      if (!stationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stationId)) {
        return null;
      }
      
      const { data, error } = await supabase.rpc('get_station_dashboard_summary', {
        p_station_id: stationId
      });

      if (error) {
        throw error;
      }

      return data as ClientBillingSummary;
    } catch (error) {
      console.error('Error fetching station dashboard summary:', error);
      return null;
    }
  },

  /**
   * Fetches the full billing record for the current user
   */
  async getClientBilling() {
    try {
      const { data, error } = await supabase
        .from('fuel_stations')
        .select('*')
        .single();
        
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching client billing:', error);
      return null;
    }
  },
  
  /**
   * Fetches recent transactions for the current user
   */
  async getTransactions(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return null;
    }
  }
};
