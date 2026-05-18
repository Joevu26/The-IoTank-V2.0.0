import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/config/supabase';

const EPRA_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const EPRA_SNOOZE_DURATION = 60 * 60 * 1000; // 1 hour snooze

export const useEPRANotifier = () => {
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser) return;

        const checkEPRAPrice = async () => {
            try {
                // Check local storage to see if we are currently snoozing an EPRA alert
                const snoozeUntil = localStorage.getItem('iotank_epra_snooze_until');
                if (snoozeUntil && Date.now() < parseInt(snoozeUntil)) {
                    return; // Still snoozing
                }

                // Query for the latest EPRA market intelligence signal (from market_prices)
                const { data, error } = await supabase
                    .from('market_prices')
                    .select('effective_date, fuel_type, price')
                    .eq('source', 'epra')
                    .order('effective_date', { ascending: false })
                    .limit(1)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('[EPRA Notifier] Failed to fetch latest EPRA notice:', error);
                    return;
                }

                if (!data) return;

                // Check if this specific alert was already acknowledged
                const lastAcknowledgedAlert = localStorage.getItem('iotank_epra_last_acknowledged_time');
                const alertTime = new Date(data.effective_date).getTime();

                if (lastAcknowledgedAlert && parseInt(lastAcknowledgedAlert) >= alertTime) {
                    return; // Already acknowledged
                }

                // If we reach here, we have an unacknowledged EPRA alert and we're not snoozing!
                window.dispatchEvent(new CustomEvent('system-toast', {
                    detail: {
                        title: '⚠️ EPRA MANDATE: RETAIL PRICE UPDATE REQUIRED',
                        message: `The system detected new official EPRA price limits for ${data.fuel_type} (KES ${data.price}).\n\nYou must update your local retail pump prices immediately to maintain operational margin tracking.`,
                        type: 'error',
                        persistent: true,
                        actions: [
                            {
                                label: 'Acknowledge & Update',
                                primary: true,
                                onClick: () => {
                                    // Mark as permanently acknowledged
                                    localStorage.setItem('iotank_epra_last_acknowledged_time', alertTime.toString());
                                    
                                    // Dispatch event to open AutoUpdatePriceModal
                                    window.dispatchEvent(new CustomEvent('system-modal', {
                                        detail: { modalType: 'market_auto_update' }
                                    }));
                                }
                            },
                            {
                                label: 'Remind Me in 1 Hr',
                                onClick: () => {
                                    // Snooze for 1 hour
                                    const nextSnooze = Date.now() + EPRA_SNOOZE_DURATION;
                                    localStorage.setItem('iotank_epra_snooze_until', nextSnooze.toString());
                                }
                            }
                        ]
                    }
                }));

            } catch (err) {
                console.error('[EPRA Notifier] Exception:', err);
            }
        };

        // Initial check
        checkEPRAPrice();

        // Polling interval
        const intervalId = setInterval(checkEPRAPrice, EPRA_CHECK_INTERVAL);

        return () => clearInterval(intervalId);
    }, [currentUser]);
};
