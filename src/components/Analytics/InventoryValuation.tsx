import React from 'react';
import { Tank, TankReading } from '@/types';
import { FiDollarSign, FiTrendingDown, FiInfo } from 'react-icons/fi';
import './InventoryValuation.css';

interface InventoryValuationProps {
    tank: Tank;
    latestReading: TankReading | null;
}

export const InventoryValuation: React.FC<InventoryValuationProps> = ({ tank, latestReading }) => {
    // Mock Market Price (In real app, this would come from an API/Hook)
    const marketPrice = tank.fuelType === 'diesel' ? 1.42 : 1.58; // USD per Liter
    const currentVolume = latestReading?.volumeCorrected || 0;

    const totalValue = currentVolume * marketPrice;
    const holdingCost = totalValue * 0.02; // Roughly 2% monthly holding cost
    const capacityValue = tank.capacity * marketPrice;

    return (
        <div className="inventory-valuation">
            <div className="valuation-grid">
                <div className="valuation-card primary">
                    <span className="valuation-label">Current Asset Value</span>
                    <span className="valuation-amount">
                        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="valuation-subtext">Based on {currentVolume.toLocaleString()}L inventory</span>
                </div>

                <div className="valuation-card">
                    <span className="valuation-label">Estimated Holding Cost</span>
                    <span className="valuation-amount">
                        ${holdingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="valuation-subtext">Monthly insurance & logistics</span>
                </div>
            </div>

            <div className="price-indicator">
                <FiDollarSign className="text-secondary" />
                <span className="text-sm text-secondary">Reference Market Price: </span>
                <span className="price-value">${marketPrice}/L</span>
                <div className="incentive-badge ml-auto">
                    <FiTrendingDown />
                    <span>Buy Signal: Low</span>
                </div>
            </div>

            <div className="valuation-footer mt-4">
                <div className="flex items-center gap-2 text-xs text-secondary">
                    <FiInfo />
                    <span>Inventory utilization: {((totalValue / capacityValue) * 100).toFixed(1)}% of capital capacity</span>
                </div>
            </div>
        </div>
    );
};
