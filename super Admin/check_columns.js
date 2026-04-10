import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    try {
        const { data, error } = await supabase.from('system_users').select('*').limit(1);
        if (error) {
            console.error('Error fetching system_users:', error);
        } else if (data && data.length > 0) {
            console.log('Columns in system_users:', Object.keys(data[0]));
        } else {
            console.log('No data in system_users to inspect columns.');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkColumns();
