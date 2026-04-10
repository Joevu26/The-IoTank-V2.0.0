import { supabase } from '../config/supabase';

export interface FuelStation {
  station_id: string;
  email: string;
  phone: string;
  station_name: string;
  station_location: string;
  county: string;
  current_debt: number;
  total_paid: number;
  lifetime_revenue: number;
  subscription_status: 'active' | 'suspended' | 'cancelled' | 'trial';
  account_status: 'active' | 'suspended' | 'delinquent' | 'closed';
  created_at: string;
}

export const clientsService = {
  async getAllClients() {
    const { data, error } = await supabase
      .from('fuel_stations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as FuelStation[];
  },

  async getRegisteredStations() {
    const { data, error } = await supabase
      .from('fuel_stations')
      .select('*, tanks(*)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getClientById(id: string) {
    const { data, error } = await supabase
      .from('fuel_stations')
      .select('*, tanks(*), transactions(*), sites(*)')
      .eq('station_id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async adjustDebt(stationId: string, amount: number, reason: string) {
    const { data, error } = await supabase.rpc('admin_adjust_station_debt', {
      p_station_id: stationId,
      p_adjustment_amount: amount,
      p_reason: reason
    });

    if (error) throw error;
    return data;
  },

  async suspendClient(stationId: string, reason: string) {
    const { data, error } = await supabase.rpc('admin_suspend_station', {
      p_station_id: stationId,
      p_reason: reason
    });

    if (error) throw error;
    return data;
  },

  async addTank(tank: { station_id: string; site_id: string; tank_name: string; fuel_type: string; tank_capacity: number }) {
    const { data, error } = await supabase
      .from('tanks')
      .insert([tank])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
