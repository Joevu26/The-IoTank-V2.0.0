import React from 'react';
import { useHistoricalReadings } from '@/hooks/useSupabase';
import { FiActivity, FiArrowDownRight, FiArrowUpRight, FiClock } from 'react-icons/fi';
import { format } from 'date-fns';
import '../Common/DesignSystemCards.css';

interface LiveFeedProps {
    orgId: string;
    tankId: string;
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ orgId, tankId }) => {
    // Get last 24 hours of readings for the immediate feed
    const timeWindow = { start: Date.now() - 24 * 60 * 60 * 1000, end: Date.now() };
    const { readings, loading } = useHistoricalReadings(orgId, tankId, timeWindow, 50, 'day');
    
    // Supabase returns readings in ASCENDING order for charts. 
    // This logic expects DESCENDING to calculate deltas between i and i+1 correctly.
    const sortedReadings = [...readings].reverse();

    if (loading) {
        return <div className="p-6 text-center text-secondary">Connecting to telemetry feed...</div>;
    }

    // Calculate volume deltas between consecutive readings to show dispenses/refills
    const events = [];
    for (let i = 0; i < sortedReadings.length - 1; i++) {
        const current = sortedReadings[i];
        const prev = sortedReadings[i + 1]; 
        const delta = (current.volumeCorrected ?? current.volume ?? 0) - (prev.volumeCorrected ?? prev.volume ?? 0);

        // Only show significant events (> 5L change)
        if (Math.abs(delta) > 5) {
            events.push({
                id: current.id,
                timestamp: current.timestamp,
                type: delta > 0 ? 'refill' : 'dispense',
                amount: Math.abs(delta)
            });
        }
    }

    // Sort descending by time
    events.sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="ds-card ds-card-panel p-6 h-full">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <FiActivity className="text-primary animate-pulse" /> Live Telemetry Feed
                </h3>
                <span className="text-xs font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-1 rounded">Real-time</span>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {events.slice(0, 15).map((event) => (
                    <div key={event.id} className="flex justify-between items-center p-3 bg-secondary rounded-lg text-sm border-l-4" style={{ borderLeftColor: event.type === 'refill' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${event.type === 'refill' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                                {event.type === 'refill' ? <FiArrowDownRight /> : <FiArrowUpRight />}
                            </div>
                            <div>
                                <div className="font-bold capitalize">{event.type} Detected</div>
                                <div className="text-xs text-secondary flex items-center gap-1">
                                    <FiClock size={10} /> {format(event.timestamp, 'HH:mm:ss')}
                                </div>
                            </div>
                        </div>
                        <div className={`font-bold ${event.type === 'refill' ? 'text-success' : 'text-warning'}`}>
                            {event.type === 'refill' ? '+' : '-'}{event.amount.toFixed(1)} L
                        </div>
                    </div>
                ))}

                {events.length === 0 && (
                    <div className="text-center text-secondary py-8 italic flex flex-col items-center gap-2">
                        <FiActivity size={24} className="opacity-50" />
                        No significant volume anomalies detected recently.
                    </div>
                )}
            </div>
        </div>
    );
};
