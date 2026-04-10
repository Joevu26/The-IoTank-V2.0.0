/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Brush,
    ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import { TankReading } from '@/types';
import './TimeSeriesChart.css';

interface TimeSeriesChartProps {
    data: TankReading[];
    title: string;
    dataKey: keyof TankReading;
    color?: string;
    unit?: string;
    height?: number;
    timeDomain?: 'day' | 'week' | 'month';
    minThreshold?: number;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
    data,
    title,
    dataKey,
    color = 'var(--chart-fuel-level)',
    unit = '%',
    height = 300,
    timeDomain = 'day',
    minThreshold,
}) => {
    const formatXAxis = (tickItem: number) => {
        const date = new Date(tickItem);
        if (timeDomain === 'day') return format(date, 'HH:mm');
        return format(date, 'MMM d');
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="chart-tooltip">
                    <p className="tooltip-label">
                        {timeDomain === 'day'
                            ? format(new Date(label), 'HH:mm')
                            : format(new Date(label), 'MMM d, HH:mm')
                        }
                    </p>
                    <p className="tooltip-value" style={{ color }}>
                        {payload[0].value} {unit}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="time-series-chart-container card">
            <div className="chart-header flex flex-col items-center mb-4">
                <h4 className="chart-title mb-4">{title}</h4>
                <div className="chart-legend flex gap-4 text-xs">
                    <div className="legend-item flex items-center gap-2">
                        <span className="legend-dot border-2" style={{ borderColor: color, backgroundColor: 'transparent', borderRadius: '50%', width: '12px', height: '12px' }}></span>
                        <span className="text-secondary">Fuel Volume (L)</span>
                    </div>
                    <div className="legend-item flex items-center gap-2">
                        <span className="legend-dot border-2" style={{ borderColor: 'var(--color-danger)', backgroundColor: 'transparent', borderRadius: '50%', width: '12px', height: '12px' }}></span>
                        <span className="text-secondary">Critical Level (20%)</span>
                    </div>
                    <div className="legend-item flex items-center gap-2">
                        <span className="legend-dot border-2" style={{ borderColor: 'var(--color-warning)', backgroundColor: 'transparent', borderRadius: '50%', width: '12px', height: '12px' }}></span>
                        <span className="text-secondary">Low Level (50%)</span>
                    </div>
                    <div className="legend-item flex items-center gap-2">
                        <span className="legend-dot" style={{ backgroundColor: '#22c55e', borderRadius: '50%', width: '10px', height: '10px' }}></span>
                        <span className="text-secondary font-bold">Refill Event</span>
                    </div>
                </div>
            </div>

            <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="var(--color-divider)"
                        />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatXAxis}
                            stroke="var(--color-text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            domain={unit === '%' ? [0, 100] : ['auto', 'auto']}
                            stroke="var(--color-text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            unit={unit}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="stepAfter"
                            dataKey={dataKey}
                            stroke={color}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#gradient-${dataKey})`}
                            isAnimationActive={true}
                            animationDuration={1500}
                        />
                        {minThreshold && (
                            <ReferenceLine
                                y={minThreshold}
                                stroke="#ef4444"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                label={{
                                    value: 'MIN SAFE LEVEL',
                                    position: 'right',
                                    fill: '#ef4444',
                                    fontSize: 10,
                                    fontWeight: 800
                                }}
                            />
                        )}
                        <Brush
                            dataKey="timestamp"
                            height={30}
                            stroke="var(--color-accent-primary)"
                            fill="var(--color-bg-secondary)"
                            tickFormatter={formatXAxis}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
