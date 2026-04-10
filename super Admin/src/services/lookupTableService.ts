import { supabase } from '../config/supabase';

export interface LookupTableEntry {
    id: string;
    tank_type: string;
    dip_mm: number;
    volume_liters: number;
    created_at?: string;
    updated_at?: string;
}

export const lookupTableService = {
    async getAllEntries(): Promise<LookupTableEntry[]> {
        const { data, error } = await supabase
            .from('volume_lookup_tables')
            .select('*')
            .order('tank_type', { ascending: true })
            .order('dip_mm', { ascending: true });

        if (error) {
            console.error('Error fetching lookup tables:', error);
            return [];
        }
        return data || [];
    },

    async getByTankType(tankType: string): Promise<LookupTableEntry[]> {
        const { data, error } = await supabase
            .from('volume_lookup_tables')
            .select('*')
            .eq('tank_type', tankType)
            .order('dip_mm', { ascending: true });

        if (error) {
            console.error(`Error fetching lookup tables for ${tankType}:`, error);
            return [];
        }
        return data || [];
    },

    async upsertEntries(entries: Partial<LookupTableEntry>[]) {
        const { data, error } = await supabase
            .from('volume_lookup_tables')
            .upsert(entries, { onConflict: 'tank_type, dip_mm' }); // Assuming unique constraint on these two

        if (error) {
            console.error('Error upserting lookup tables:', error);
            throw error;
        }
        return data;
    },

    async deleteByTankType(tankType: string) {
        const { error } = await supabase
            .from('volume_lookup_tables')
            .delete()
            .eq('tank_type', tankType);

        if (error) {
            console.error(`Error deleting entries for ${tankType}:`, error);
            throw error;
        }
    },

    async updateEntry(id: string, entry: Partial<LookupTableEntry>) {
        const { error } = await supabase
            .from('volume_lookup_tables')
            .update(entry)
            .eq('id', id);

        if (error) {
            console.error(`Error updating entry ${id}:`, error);
            throw error;
        }
    },

    async clearAll() {
        const { error } = await supabase
            .from('volume_lookup_tables')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
            console.error('Error clearing lookup tables:', error);
            throw error;
        }
    }
};
