import React from 'react';
import { Tank } from '@/types';
import './TankSelectorTabs.css';

interface TankSelectorTabsProps {
    tanks: Tank[];
    selectedTankId: string;
    onSelectTank: (id: string) => void;
}

export const TankSelectorTabs: React.FC<TankSelectorTabsProps> = ({
    tanks,
    selectedTankId,
    onSelectTank
}) => {
    return (
        <div className="tank-selector-tabs">
            {tanks.map(tank => (
                <button
                    key={tank.id}
                    className={`tank-tab-btn ${tank.id === selectedTankId ? 'active' : ''}`}
                    onClick={() => onSelectTank(tank.id)}
                >
                    <span className="tab-tank-name">{tank.name}</span>
                    <span className="tab-tank-fuel">{tank.fuelType}</span>
                </button>
            ))}
        </div>
    );
};
