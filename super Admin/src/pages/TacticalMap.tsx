import { Device } from '../services/hardwareService';
import { FiTarget } from 'react-icons/fi';


interface TacticalMapProps {
    stationCount: number;
    devices: Device[];
}

const TacticalMap = ({ stationCount, devices }: TacticalMapProps) => {
    // Basic mapping for Kenya bounds (approx: Lat -5 to 5, Lng 34 to 42)
    const mapCoords = (lat: number, lng: number) => {
        const x = ((lng - 34) / 8) * 800; // 34-42 is 8 degrees wide
        const y = 500 - ((lat + 5) / 10) * 500; // -5 to 5 is 10 degrees tall
        return { x, y };
    };

    const latestDevice = devices[0];

    return (
        <div className="tactical-map-container glass-panel">
            <div className="map-scan-line"></div>
            <div className="ornament ornament-tl">GRID_REF::KENYA_REGION</div>
            <div className="ornament ornament-tr">SIGNAL_STRENGTH::OPTIMAL</div>
            <div className="ornament ornament-bl">SYNC_ID::0x42A-Z</div>
            
            <svg viewBox="0 0 800 500" className="w-full h-full opacity-20">
                {/* Simplified Map Outline (Approximate Kenya) */}
                <path 
                    d="M380,50 L450,80 L550,150 L600,300 L550,450 L400,480 L300,450 L250,300 L300,100 Z" 
                    fill="none" 
                    stroke="var(--color-accent-primary)" 
                    strokeWidth="1"
                    strokeDasharray="4 4"
                />
                {/* Tactical Grid */}
                <path d="M0,250 L800,250" stroke="var(--color-divider)" strokeWidth="0.2" />
                <path d="M400,0 L400,500" stroke="var(--color-divider)" strokeWidth="0.2" />
                
                {/* Device Nodes */}
                {devices.map(device => {
                    const { x, y } = mapCoords(device.lat || 0, device.lng || 38);
                    const isOnline = device.status === 'online';
                    return (
                        <g key={device.id}>
                            <circle 
                                cx={x} cy={y} 
                                r={isOnline ? 6 : 4} 
                                fill={isOnline ? "#10b981" : "#ef4444"} 
                                className={isOnline ? "animate-pulse" : ""} 
                            />
                            {isOnline && (
                                <circle 
                                    cx={x} cy={y} 
                                    r={12} 
                                    fill="none" 
                                    stroke="#10b981" 
                                    strokeWidth="1" 
                                    className="animate-ping" 
                                    style={{ animationDuration: '3s' }}
                                />
                            )}
                        </g>
                    );
                })}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <FiTarget size={48} className="text-indigo-600 mb-4 opacity-40" />
                <div className="text-center">
                    <p className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.3em]">Telemetry Active</p>
                    <p className="text-[24px] font-black text-slate-900 tracking-tighter">{stationCount} STAT_HUBS</p>
                </div>
            </div>

            {/* Micro Data Panels */}
            <div className="absolute bottom-6 right-6 flex gap-4">
                <div className="p-2 bg-white/40 backdrop-blur-md rounded-lg border border-white/50">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">LATITUDE</p>
                    <p className="text-[10px] font-black text-slate-900 mono">{latestDevice?.lat?.toFixed(4) || '1.2921'}°</p>
                </div>
                <div className="p-2 bg-white/40 backdrop-blur-md rounded-lg border border-white/50">
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">LONGITUDE</p>
                    <p className="text-[10px] font-black text-slate-900 mono">{latestDevice?.lng?.toFixed(4) || '36.8219'}°</p>
                </div>
            </div>
        </div>
    );
};


export default TacticalMap;
