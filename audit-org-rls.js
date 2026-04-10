// audit-org-rls.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function audit() {
    console.log('--- AUDITING ORGANIZATIONS RLS ---');
    
    // We can't see pg_policies from anon, so we'll use a RPC if available, 
    // or just try to query and see the error message.
    
    const { data, error } = await supabase.from('organizations').select('*').limit(1);
    
    if (error) {
        console.error('Query Error:', error.message);
        console.error('Error Code:', error.code);
        console.error('Error Details:', error.details);
    } else {
        console.log('Query Success! Row count:', data.length);
    }
}

audit();
