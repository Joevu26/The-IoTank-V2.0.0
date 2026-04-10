import React from 'react';
import { FiMoon, FiAlertTriangle } from 'react-icons/fi';

export const ShrinkageHeatmap: React.FC = () => {
    // 24 hours x 7 days mock heatmap grid
    // Rows = Days, Cols = Hours
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Mock data: higher numbers = more shrinkage detected in that hour
    const getShrinkageIntensity = (day: string, hour: number) => {
        // Mocking nocturnal activity suspicion
        if (hour >= 23 || hour <= 4) {
            if (day === 'Sat' || day === 'Sun') return Math.random() * 0.8 + 0.2; // High nocturnal weekend
            return Math.random() * 0.4;
        }
        return Math.random() * 0.2;
    };

    return (
        <div className="acp-card mt-6">
            <div className="acp-card-header mb-4">
                <div className="acp-card-title">
                    <div className="acp-section-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><FiAlertTriangle /></div>
                    <h3 className="text-slate-800">Forensic Shrinkage Heatmap</h3>
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-2">
                    <FiMoon className="text-indigo-400" /> Nocturnal Detection Active
                </div>
            </div>

            <div className="heatmap-container overflow-x-auto">
                <div className="min-w-[500px]">
                    <div className="flex mb-1">
                        <div className="w-10"></div>
                        <div className="flex-1 flex justify-between px-2 text-[8px] text-slate-400 font-bold">
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>23:00</span>
                        </div>
                    </div>

                    {days.map(day => (
                        <div key={day} className="flex items-center gap-2 mb-1">
                            <span className="w-10 text-[10px] font-bold text-slate-500">{day}</span>
                            <div className="flex-1 flex gap-1">
                                {hours.map(h => {
                                    const intensity = getShrinkageIntensity(day, h);
                                    let bgColor = '#f8fafc';
                                    if (intensity > 0.7) bgColor = '#4c1d95'; // Deep Plum
                                    else if (intensity > 0.5) bgColor = '#7c3aed'; // Rich Violet
                                    else if (intensity > 0.3) bgColor = '#a855f7'; // Vibrant Amethyst
                                    else if (intensity > 0.1) bgColor = '#e9d5ff'; // Light Lavender

                                    return (
                                        <div
                                            key={h}
                                            className="flex-1 h-6 rounded-sm transition-all hover:scale-110 cursor-pointer"
                                            style={{ backgroundColor: bgColor }}
                                            title={`${day} ${h}:00 - Intensity: ${(intensity * 100).toFixed(0)}%`}
                                        ></div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}></div>
                        <span className="text-slate-500 italic uppercase font-bold">No Activity</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4c1d95' }}></div>
                        <span className="text-slate-500 italic uppercase font-bold">High Variance</span>
                    </div>
                </div>
                <div className="p-2 font-black uppercase tracking-tighter" style={{ background: 'rgba(124, 58, 237, 0.05)', color: '#7c3aed', borderRadius: '4px', border: '1px solid rgba(124, 58, 237, 0.1)' }}>
                    Pattern Alert: Recursive loss detected between 01:00 - 04:00 on Weekends.
                </div>
            </div>
        </div>
    );
};
