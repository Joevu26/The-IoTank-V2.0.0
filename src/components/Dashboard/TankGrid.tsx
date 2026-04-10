import React from 'react';
import { Tank, TankReading } from '@/types';
import { TankCard } from './TankCard';
import '../Common/DesignSystemCards.css';
import './TankGrid.css';

interface TankGridProps {
    tanks: Tank[];
    stationId: string;
    readings: Record<string, TankReading>;
}

export const TankGrid: React.FC<TankGridProps> = ({ tanks, stationId, readings }) => {
    return (
        <div className="tank-grid">
            {tanks.map(tank => (
                <TankCard 
                    key={tank.id} 
                    tank={tank} 
                    stationId={stationId} 
                    initialReading={readings[tank.id]} 
                />
            ))}
        </div>
    );
};
