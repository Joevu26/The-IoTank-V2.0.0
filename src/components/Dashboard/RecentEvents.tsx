import React from 'react';
import { FiClock, FiActivity, FiShield, FiTrendingDown, FiLock, FiInfo, FiUserPlus } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/config/supabase';
import '../Common/DesignSystemCards.css';

interface EventItem {
    id: string;
    type: 'shift' | 'delivery' | 'refill' | 'alert' | 'system' | 'ai' | 'user';
    message: string;
    timestamp: string;
}

export const RecentEvents: React.FC = () => {
    const { currentUser } = useAuth();
    const [events, setEvents] = React.useState<EventItem[]>([]);

    React.useEffect(() => {
        const fetchEvents = async () => {
            if (!currentUser?.stationId) return;
            const { data } = await supabase
                .from('audit_logs')
                .select('id, action, details, created_at')
                .eq('station_id', currentUser.stationId)
                .order('created_at', { ascending: false })
                .limit(5);

            const toRelative = (iso: string) => {
                const ms = Date.now() - new Date(iso).getTime();
                const mins = Math.floor(ms / 60000);
                if (mins < 60) return `${Math.max(mins, 1)} mins ago`;
                const hours = Math.floor(mins / 60);
                if (hours < 24) return `${hours} hours ago`;
                const days = Math.floor(hours / 24);
                return `${days} days ago`;
            };

            const mapped: EventItem[] = (data || []).map((row: any) => {
                let type: EventItem['type'] = 'system';
                const action = (row.action || '').toUpperCase();
                
                if (action.includes('SECURITY') || action.includes('ALERT')) type = 'alert';
                else if (action.includes('SHIFT') || action.includes('MANUAL_ADJUSTMENT')) type = 'shift';
                else if (action.includes('INVITE') || action.includes('MEMBER') || action.includes('ROLE') || action.includes('USER') || action.includes('LOGIN') || action.includes('LOGOUT')) type = 'user';
                else if (action.includes('DELIVERY') || action.includes('ORDER') || action.includes('REFILL')) type = 'delivery';
                else if (action.includes('AI') || action.includes('FORECAST')) type = 'ai';

                let rawTypeDisplay = action.replace(/_/g, ' ').toLowerCase();

                return {
                    id: row.id,
                    type,
                    message: row.details || 'System notification',
                    timestamp: row.created_at ? toRelative(row.created_at) : 'just now',
                    rawTypeDisplay
                };
            });
            setEvents(mapped as any);
        };

        fetchEvents();
    }, [currentUser?.stationId]);

    const getIcon = (type: EventItem['type']) => {
        switch (type) {
            case 'shift': return <FiClock className="text-indigo-500" />;
            case 'delivery':
            case 'refill': return <FiTrendingDown className="text-emerald-500" />;
            case 'alert': return <FiShield className="text-rose-500" />;
            case 'system': return <FiLock className="text-slate-500" />;
            case 'user': return <FiUserPlus className="text-amber-500" />;
            case 'ai': return <FiActivity className="text-purple-500" />;
            default: return <FiInfo className="text-slate-400" />;
        }
    };

    return (
        <div style={{
            background: '#fff',
            borderRadius: '20px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 24px -8px rgba(30,27,75,0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '16px',
            height: '360px'
        }}>
            {/* ── Premium Header ── */}
            <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiActivity size={16} style={{ color: '#c4b5fd', strokeWidth: 2.5 }} />
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                        Recent Events
                    </span>
                </div>
                <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Global Log
                    </span>
                </div>
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '8px 0', position: 'relative' }} className="custom-scrollbar">
                {/* Vertical line connecting events */}
                {events.length > 0 && <div style={{ position: 'absolute', left: '33px', top: '24px', bottom: '24px', width: '2px', background: '#f1f5f9', zIndex: 0 }}></div>}

                {events.map((event) => (
                    <div 
                        key={event.id} 
                        style={{ 
                            display: 'flex', 
                            gap: '12px', 
                            position: 'relative', 
                            zIndex: 10, 
                            padding: '12px 20px',
                            transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <div style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '50%', 
                            background: '#fff', 
                            border: '2px solid #e2e8f0', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                            {React.cloneElement(getIcon(event.type) as React.ReactElement, { size: 14, strokeWidth: 2.5 })}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
                            <p style={{ fontSize: '13px', color: '#334155', fontWeight: 600, lineHeight: '1.4', marginBottom: '6px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                {event.message}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {event.timestamp}
                                </span>
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }}></span>
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {event.type}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {events.length === 0 && (
                    <div style={{ padding: '30px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8' }}>
                         <span style={{ fontSize: '12px', fontWeight: 600, fontStyle: 'italic' }}>No recent events found.</span>
                    </div>
                )}
            </div>
        </div>
    );
};
