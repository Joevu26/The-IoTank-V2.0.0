require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('system_users')
        .update({ auth_user_id: null })
        .eq('email', 'josezvundi@gmail.com')
        .select();
        
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Successfully updated rows:', data);
    }
}
run();
