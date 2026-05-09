const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://suifvborodwergtrbjez.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1aWZ2Ym9yb2R3ZXJndHJiamV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjA3NDAsImV4cCI6MjA4OTMzNjc0MH0.MNRIzdkr3w7AbhYcp7zdDT4waltCMO33e_vTxZtu8W0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testLogin() {
    console.log('[1] Logging in...');
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'joereademm@gmail.com',
        password: 'Joe@26$.s'
    });

    if (error) {
        console.error('Login failed:', error);
        return;
    }

    console.log('[2] Login successful! User ID:', data.user.id);
    
    console.time('get_user_bundle_v2');
    console.log('[3] Fetching get_user_bundle_v2...');
    const { data: bundle, error: bundleError } = await supabase.rpc('get_user_bundle_v2');
    console.timeEnd('get_user_bundle_v2');

    if (bundleError) {
        console.error('RPC failed:', bundleError);
    } else {
        console.log('[4] RPC returned successfully! Identity Type:', bundle?.identity_type);
    }

    console.time('listFactors');
    console.log('[5] Fetching MFA listFactors...');
    const { data: factors, error: mfaError } = await supabase.auth.mfa.listFactors();
    console.timeEnd('listFactors');

    if (mfaError) {
        console.error('MFA listFactors failed:', mfaError);
    } else {
        console.log('[6] MFA listFactors returned successfully! Found factors:', factors?.totp?.length || 0);
    }
}

testLogin();
