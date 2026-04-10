
import React, { useId } from 'react';

interface TemperatureGaugeProps {
    temperature: number;
    min: number;
    max: number;
    optimal: { min: number; max: number };
    safe: { min: number; max: number };
    criticalHigh: number;
    criticalLow: number;
    size?: number;
}

export const TemperatureGauge: React.FC<TemperatureGaugeProps> = ({
    temperature,
    min = -10,
    max = 40,
    safe,
    criticalHigh,
    criticalLow,
    size = 120
}) => {
    // 1. Safety Checks & defaults
    const safeSize = size > 0 ? size : 120;
    // Handle NaN or undefined temperature gracefully
    const safeTemp = (typeof temperature === 'number' && !isNaN(temperature)) ? temperature : min;

    // Gauge configuration
    const strokeWidth = 12; // Thicker for better visibility
    const padding = 20;
    const radius = (safeSize - strokeWidth - padding) / 2;
    const center = safeSize / 2;

    // Standard Gauge Angles: Top Arch
    // Start at 135 deg leads to 9h (180), 12h (270), 3h (360), ends at 405.
    // This creates an arc that opens at the bottom.
    const startAngle = 135;
    const endAngle = 405;
    const angleRange = endAngle - startAngle;

    // Helper to map value to angle
    const valueToAngle = (value: number) => {
        if (max === min) return startAngle;
        const clamped = Math.min(Math.max(value, min), max);
        const percent = (clamped - min) / (max - min);
        return startAngle + (percent * angleRange);
    };

    const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
        return {
            x: centerX + (r * Math.cos(angleInRadians)),
            y: centerY + (r * Math.sin(angleInRadians))
        };
    };

    // Helper to calculate SVG path for an arc
    const describeArc = (x: number, y: number, r: number, startAng: number, endAng: number) => {
        const start = polarToCartesian(x, y, r, startAng);
        const end = polarToCartesian(x, y, r, endAng);

        // Large arc for >180 deg
        const largeArcFlag = endAng - startAng <= 180 ? "0" : "1";

        if (isNaN(start.x) || isNaN(start.y) || isNaN(end.x) || isNaN(end.y)) return "";

        return [
            "M", start.x, start.y,
            "A", r, r, 0, largeArcFlag, 1, end.x, end.y
        ].join(" ");
    };


    // Calculate progress angle
    const currentAngle = valueToAngle(safeTemp);

    // Stable ID for gradient
    const gradientId = useId();
    const gradUrl = `url(#${gradientId})`;

    // Indicator Dot Position
    const dotPos = polarToCartesian(center, center, radius, currentAngle);

    // Label Positions
    const minPos = polarToCartesian(center, center, radius + 15, startAngle);
    const maxPos = polarToCartesian(center, center, radius + 15, endAngle);

    return (
        <div className="relative flex items-center justify-center select-none" style={{ width: safeSize, height: safeSize }}>
            <svg width={safeSize} height={safeSize} style={{ overflow: 'visible', zIndex: 10 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" /> {/* Critical Low */}
                        <stop offset="30%" stopColor="#f59e0b" /> {/* Warning */}
                        <stop offset="50%" stopColor="#10b981" /> {/* Safe (Top) */}
                        <stop offset="70%" stopColor="#f59e0b" /> {/* Warning */}
                        <stop offset="100%" stopColor="#ef4444" /> {/* Critical High */}
                    </linearGradient>
                </defs>

                {/* Background Track - Faint */}
                <path
                    d={describeArc(center, center, radius, startAngle, endAngle)}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Progress Arc with Gradient - Always visible full track for "thermostat" feel? 
                    User asked to "design well", usually means seeing the full colored scale.
                    Let's draw the FULL gradient track as background, and then an indicator?
                    Or draw gradient UP TO current temp?
                    User said "color codes must be placed on the top part... safe point at top... critical sides".
                    This implies the SCALE should show these colors, not just the progress bar.
                    So I will draw the FULL TRACK with Gradient, and use the Dot to indicate position.
                */}
                <path
                    d={describeArc(center, center, radius, startAngle, endAngle)}
                    fill="none"
                    stroke={gradUrl}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.1))' }}
                />

                {/* Ticks/Decorations (Optional - simple ticks at quadrants) */}
                {(() => {
                    // Top Tick (Safe Point)
                    const topPosStart = polarToCartesian(center, center, radius - 8, 270);
                    const topPosEnd = polarToCartesian(center, center, radius - 2, 270);
                    return <line x1={topPosStart.x} y1={topPosStart.y} x2={topPosEnd.x} y2={topPosEnd.y} stroke="#fff" strokeWidth="2" opacity="0.8" />;
                })()}
            </svg>

            {/* Indicator Dot - Large Marker */}
            <div
                className="absolute w-5 h-5 bg-white rounded-full border-2 shadow-md z-30 transition-all duration-500 ease-out flex items-center justify-center"
                style={{
                    borderColor: '#374151',
                    left: dotPos.x,
                    top: dotPos.y,
                    transform: 'translate(-50%, -50%)'
                }}
            >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
            </div>

            {/* Center Content - High Z-Index */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pt-4">
                <span className="text-3xl font-bold text-slate-800 leading-none tracking-tight">
                    {Math.round(safeTemp)}°
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full ${safeTemp >= criticalHigh || safeTemp <= criticalLow ? 'text-red-700 bg-red-100' :
                    safeTemp > safe.max || safeTemp < safe.min ? 'text-amber-700 bg-amber-100' : 'text-emerald-700 bg-emerald-100'
                    }`}>
                    {safeTemp >= criticalHigh || safeTemp <= criticalLow ? 'Critical' :
                        safeTemp > safe.max || safeTemp < safe.min ? 'Warning' : 'Normal'}
                </span>
            </div>

            {/* Min/Max Labels */}
            <div
                className="absolute text-[10px] font-bold text-slate-400 z-20"
                style={{
                    left: minPos.x,
                    top: minPos.y,
                    transform: 'translate(-50%, -50%)'
                }}
            >
                {min}°
            </div>
            <div
                className="absolute text-[10px] font-bold text-slate-400 z-20"
                style={{
                    left: maxPos.x,
                    top: maxPos.y,
                    transform: 'translate(-50%, -50%)'
                }}
            >
                {max}°
            </div>
        </div>
    );
};
