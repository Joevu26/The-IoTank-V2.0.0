import React from 'react';
import { Tank, TankReading } from '@/types';
import { FiDollarSign, FiTrendingDown, FiInfo } from 'react-icons/fi';
import './InventoryValuation.css';

interface InventoryValuationProps {
    tank: Tank;
    latestReading: TankReading | null;
}

export const InventoryValuation: React.FC<InventoryValuationProps> = ({ tank, latestReading }) => {
    // Using station retail prices strictly from settings metadata
    const retailPrice = Number((tank as any).metadata?.retailPrice) || 0;
    const currentVolume = latestReading?.volumeCorrected || latestReading?.volume || 0;

    const totalValue = currentVolume * retailPrice;
    const holdingCost = totalValue * 0.02; // Roughly 2% monthly holding cost
    const capacityValue = (tank.capacity || 1) * retailPrice; // Guard against division by zero

    // Use zero-safe utilization percentage
    const utilizationRate = capacityValue > 0 ? (totalValue / capacityValue) * 100 : 0;

    return (
        <div className="inventory-valuation">
            <div className="valuation-grid">
                <div className="valuation-card primary">
                    <span className="valuation-label">Current Asset Value</span>
                    <span className="valuation-amount">
                        Ksh {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="valuation-subtext">Based on {currentVolume.toLocaleString()}L inventory</span>
                </div>

                <div className="valuation-card">
                    <span className="valuation-label">Estimated Holding Cost</span>
                    <span className="valuation-amount">
                        Ksh {holdingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="valuation-subtext">Monthly insurance & logistics</span>
                </div>
            </div>

            <div className="valuation-price-row">
                <FiDollarSign className="text-secondary" />
                <span className="text-sm text-secondary">Authorized Retail Price: </span>
                <span className="price-value">Ksh {retailPrice.toFixed(2)}/L</span>
                <div className="incentive-badge ml-auto">
                    <FiTrendingDown />
                    <span>Buy Signal: Low</span>
                </div>
            </div>

            <div className="valuation-footer mt-4">
                <div className="flex items-center gap-2 text-xs text-secondary">
                    <FiInfo />
                    <span>Inventory utilization: {utilizationRate.toFixed(1)}% of capital capacity</span>
                </div>
            </div>
        </div>
    );
};
